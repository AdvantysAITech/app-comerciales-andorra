-- ============================================================================
-- Proteger las columnas de `documentos` que solo puede escribir el servidor.
-- 28/09/2026
-- ============================================================================
--
-- EL PROBLEMA
--
-- `documentos_update` filtra FILAS (quién puede tocar qué propuesta), no
-- COLUMNAS. El navegador tiene la anon key y la sesión del usuario, así que un
-- comercial con alcance `propio` podía hacer desde las herramientas del
-- navegador:
--
--   PATCH /rest/v1/documentos?id=eq.<su propuesta>
--   { "validado_en": "...", "validado_version": <ediciones> }
--
-- y luego pulsar «Reintentar envío al CRM». La propuesta subía a la
-- oportunidad de GHL como validada sin que nadie la hubiera revisado. Igual con
-- `precio_editado` después de una validación real (sin subir `ediciones`), o
-- apuntando `pdf_ruta` al PDF de otra propuesta.
--
-- LA REGLA
--
-- Con la sesión de un usuario (roles `authenticated` / `anon`):
--   · INSERT: prohibido. Las propuestas las crea el servidor con la
--     service_role key (app/api/leads/[id]/documento).
--   · UPDATE: solo las columnas de la edición —edicion, precio_editado,
--     editado_por, editado_en, ediciones— y `ghl_error` solo para vaciarlo.
--     `ediciones` solo puede subir de uno en uno, cambiar el texto o el precio
--     obliga a subirla, y `editado_por` tiene que ser quien edita. Todo lo demás (validado_*, pdf_*, alcance, lead_id,
--     comercial_id, ghl_*…) queda para el servidor.
--
-- El servidor (service_role) y el editor SQL de Supabase (postgres) no pasan
-- por estas comprobaciones.
--
-- Se compara la fila entera en jsonb quitando las columnas permitidas, así que
-- cualquier columna que se añada en el futuro queda protegida por defecto.
--
-- ANTES DE EJECUTAR: la app tiene que estar desplegada con la rama
-- fix/freno-sync-crm, que ya crea las propuestas con la service_role key. Con
-- el código anterior, «Generar propuesta» fallaría al insertar.
-- ============================================================================

begin;

create or replace function proteger_documentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol text := coalesce(auth.role(), '');
  editables constant text[] := array[
    'edicion', 'precio_editado', 'editado_por', 'editado_en', 'ediciones', 'ghl_error'
  ];
begin
  -- Solo se vigila a quien llega con la sesión del navegador.
  if rol not in ('authenticated', 'anon') then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Las propuestas solo las crea el servidor.'
      using errcode = '42501';
  end if;

  if (to_jsonb(new) - editables) is distinct from (to_jsonb(old) - editables) then
    raise exception 'Esa columna de la propuesta solo la puede cambiar el servidor.'
      using errcode = '42501';
  end if;

  if new.ediciones is distinct from old.ediciones
     and new.ediciones is distinct from coalesce(old.ediciones, 0) + 1 then
    raise exception 'La versión de la propuesta solo puede subir de una en una.'
      using errcode = '42501';
  end if;

  -- Cambiar el contenido obliga a subir de versión. Si no, un precio tocado
  -- después de validar seguiría contando como la versión validada.
  if (new.edicion is distinct from old.edicion
      or new.precio_editado is distinct from old.precio_editado)
     and new.ediciones is not distinct from old.ediciones then
    raise exception 'Cambiar la propuesta crea una versión nueva: hay que subir ediciones.'
      using errcode = '42501';
  end if;

  if new.editado_por is distinct from old.editado_por
     and new.editado_por is distinct from auth.uid() then
    raise exception 'editado_por tiene que ser quien edita.'
      using errcode = '42501';
  end if;

  if new.ghl_error is distinct from old.ghl_error and new.ghl_error is not null then
    raise exception 'ghl_error solo se puede vaciar desde la sesión de usuario.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_documentos on documentos;

create trigger proteger_documentos
  before insert or update on documentos
  for each row execute function proteger_documentos();

commit;

-- ============================================================================
-- COMPROBACIÓN (solo lectura). Ejecutar aparte y revisar el resultado:
-- cualquier tabla con `rls_activada = false` es legible y escribible por
-- cualquiera con sesión —y, según los permisos, con la anon key—. En
-- particular `permisos`: si no tiene RLS, un comercial puede subirse a sí
-- mismo el alcance a `total`.
-- ============================================================================
--
-- select c.relname                as tabla,
--        c.relrowsecurity         as rls_activada,
--        p.polname                as politica,
--        case p.polcmd when 'r' then 'select' when 'a' then 'insert'
--                      when 'w' then 'update' when 'd' then 'delete'
--                      when '*' then 'todas' end as operacion
-- from pg_class c
-- join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
-- left join pg_policy p on p.polrelid = c.oid
-- where c.relkind = 'r'
-- order by c.relname, p.polname;
