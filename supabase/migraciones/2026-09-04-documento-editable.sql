-- Documentos · propuesta editable.
--
-- Decision de Jacob (04/09/2026): el presupuesto ya generado se puede
-- modificar —textos y precio— desde la pantalla del documento, y el PDF se
-- regenera con los cambios.
--
-- Tres decisiones que condicionan este esquema:
--
--   1. El precio es LIBRE, sin suelo ni tope. No se bloquea nada. A cambio se
--      guarda el precio calculado por el motor junto al introducido a mano,
--      para poder medir después cuánto se está bajando de precio.
--   2. La referencia NO cambia al editar: se sobrescribe. Eso significa que
--      `ADV-2026-…` deja de identificar un documento único, así que cada
--      edición archiva el estado anterior en `documentos_ediciones` y copia el
--      PDF previo a `historial/` dentro del bucket. La referencia se repite,
--      pero siempre se puede reconstruir qué decía cada versión.
--   3. `alcance` NO se toca nunca. Es la trazabilidad de lo que generó la IA
--      (7.7). Las modificaciones viven aparte, en `edicion`, como capa que se
--      aplica encima al construir el documento.

begin;

/* ------------------------------------------------------------------ */
/* 1. Columnas de edición                                              */
/* ------------------------------------------------------------------ */

alter table documentos
  add column if not exists edicion        jsonb,
  add column if not exists precio_editado numeric,
  add column if not exists editado_por    uuid,
  add column if not exists editado_en     timestamptz,
  add column if not exists ediciones      integer not null default 0;

comment on column documentos.edicion is
  'Capa de modificaciones sobre el alcance original. Null = documento sin editar. Solo textos que ve el cliente: el esquema de lib/documentos/edicion.ts no admite horas, así que un bloque editado no puede reintroducir el dato que 7.6 saca del documento de cliente.';

comment on column documentos.precio_editado is
  'Precio introducido a mano. Null = vale el calculado (leads.precio_presentado). Se guarda aparte y no dentro de `edicion` para poder consultarlo en SQL sin abrir el jsonb.';

comment on column documentos.ediciones is
  'Numero de version. Coincide con `documentos_ediciones.version` de la ultima fila archivada.';

/* ------------------------------------------------------------------ */
/* 2. Historial                                                        */
/* ------------------------------------------------------------------ */

-- Se archiva el estado PREVIO a cada guardado, no el nuevo: el nuevo ya está
-- en `documentos`. Reconstruir la version N significa leer la fila N+1 del
-- historial, o la propia `documentos` si es la ultima.
create table if not exists documentos_ediciones (
  id             uuid primary key default gen_random_uuid(),
  documento_id   uuid not null references documentos(id) on delete cascade,
  version        integer not null,

  edicion_previa jsonb,
  precio_previo  numeric,

  -- El precio que calculó el motor, congelado en cada edición. Es la columna
  -- que responde a «cuánto estamos descontando a mano» cuando entre el motor
  -- nuevo de tarifas.
  precio_calculado numeric,

  pdf_ruta_previa  text,

  editado_por    uuid not null,
  editado_en     timestamptz not null default now(),

  unique (documento_id, version)
);

alter table documentos_ediciones enable row level security;

-- La lectura se hereda de `documentos`: el `exists` se evalúa bajo la RLS del
-- que pregunta, así que si no puede ver el documento tampoco ve su historial.
-- Sin duplicar aquí la condición de `permisos`, que se separaría con el tiempo.
drop policy if exists documentos_ediciones_select on documentos_ediciones;

create policy documentos_ediciones_select on documentos_ediciones
  for select to authenticated
  using (
    exists (select 1 from documentos d where d.id = documento_id)
  );

-- Sin política de insert, update ni delete a propósito: el historial lo
-- escribe siempre el servidor con la service_role key. Un comercial no puede
-- reescribir el registro de lo que él mismo cambió.

/* ------------------------------------------------------------------ */
/* 3. Política de UPDATE sobre documentos                              */
/* ------------------------------------------------------------------ */

-- Hasta ahora `documentos` solo tenía select e insert: nadie modificaba una
-- fila desde la app.
--
-- La condición es LA MISMA que la de `documentos_select`, a propósito: quien
-- puede leer una propuesta puede editarla. Cada comercial la suya; quien tenga
-- alcance equipo o total, cualquiera.
--
-- Y NO se escribe `comercial_id = auth.uid()` a secas, que es lo que dejó
-- fuera a los usuarios con alcance total la última vez que se tocó una
-- política de esta tabla.
drop policy if exists documentos_update on documentos;

create policy documentos_update on documentos
  for update to authenticated
  using (
    comercial_id = auth.uid()
    or exists (
      select 1 from permisos
      where profile_id = auth.uid()
        and modulo_clave = 'captacion'
        and alcance in ('equipo', 'total')
    )
  )
  with check (
    comercial_id = auth.uid()
    or exists (
      select 1 from permisos
      where profile_id = auth.uid()
        and modulo_clave = 'captacion'
        and alcance in ('equipo', 'total')
    )
  );

-- El `with check` con la misma condición impide además cambiar de dueño: un
-- comercial con alcance `propio` no puede reasignar el documento a otro,
-- porque la fila resultante ya no cumpliría la política.

commit;
