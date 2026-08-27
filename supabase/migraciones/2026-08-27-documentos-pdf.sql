-- Documentos · almacenamiento del PDF.
--
-- Hasta ahora el PDF no existía como archivo: `GET /api/documentos/[id]/pdf`
-- lo ensamblaba en cada descarga y lo tiraba. Eso tenía dos consecuencias:
--
--   1. No había nada que subir a GHL (campo «Documentacion»).
--   2. El precio se RECALCULA en cada renderizado, así que dos descargas
--      separadas por un cambio de tarifas devolvían PDF distintos con la
--      misma referencia. El que tiene el cliente y el que ves tú dejaban de
--      coincidir sin que nadie se enterara.
--
-- A partir de aquí el PDF se genera una vez, se guarda en Storage y todas las
-- descargas sirven ese mismo archivo.

begin;

/* ------------------------------------------------------------------ */
/* 1. Columnas                                                         */
/* ------------------------------------------------------------------ */

alter table documentos
  add column if not exists pdf_ruta        text,
  add column if not exists pdf_generado_en timestamptz,
  add column if not exists ghl_subido_en   timestamptz,
  add column if not exists ghl_error       text;

comment on column documentos.pdf_ruta is
  'Ruta dentro del bucket `documentos` de Storage. Null = todavía sin generar.';

comment on column documentos.ghl_subido_en is
  'Momento en que el PDF se adjuntó al campo «Documentacion» de la oportunidad.';

comment on column documentos.ghl_error is
  'Último fallo al subir a GHL. Se guarda en vez de tragárselo: el documento es válido aunque el CRM no lo tenga, y así se sabe cuál reintentar.';

/* ------------------------------------------------------------------ */
/* 2. Bucket privado                                                   */
/* ------------------------------------------------------------------ */

-- Privado a propósito. Un presupuesto lleva precios y alcance de un cliente
-- concreto; con el bucket público bastaría adivinar la ruta para leerlo. El
-- acceso va siempre por la app, que ya comprueba sesión y RLS.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

/* ------------------------------------------------------------------ */
/* 3. Acceso al bucket                                                 */
/* ------------------------------------------------------------------ */

-- La escritura la hace SIEMPRE el servidor con la service_role key, que se
-- salta RLS. Por eso no hay política de insert para `authenticated`: nadie
-- sube nada desde el navegador.
--
-- La lectura tampoco se abre aquí. `GET /api/documentos/[id]/pdf` ya valida
-- la sesión y lee la fila de `documentos` bajo su propia RLS; si puede leer
-- la fila, el endpoint le sirve el archivo. Duplicar la regla en Storage
-- significaría mantener la misma condición en dos sitios y que se separen.

commit;