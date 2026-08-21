-- Captación: idempotencia, caché de spin-offs y renombrado de la línea ISO.
-- Aplicado en producción el 21/08/2026.

begin;

-- 1. Clave interna estable de la línea ISO (antes `auditoria_iso42001`).
alter table leads drop constraint leads_linea_negocio_check;

update leads
set linea_negocio = 'iso42001'
where linea_negocio = 'auditoria_iso42001';

alter table leads add constraint leads_linea_negocio_check
  check (linea_negocio = any (array['consultoria', 'jv_builder', 'iso42001']));

-- 2. Estado `en_curso`: la reserva previa a escribir en GHL.
--    `bloqueado_wf16` se conserva por las filas históricas; WF-16 ya no existe.
alter table leads drop constraint leads_resultado_check;

alter table leads add constraint leads_resultado_check
  check (resultado = any (array['en_curso', 'creado', 'error', 'bloqueado_wf16']));

-- 3. Idempotencia. Admite nulos: las filas anteriores no tienen UUID.
alter table leads add column uuid_origen uuid;
create unique index leads_uuid_origen_key on leads (uuid_origen);

-- 4. Caché de spin-offs. La clave de negocio es `clave_interna`, no el id de GHL.
create table spinoffs_cache (
  clave_interna text primary key,
  ghl_id        text not null unique,
  nombre        text not null,
  estado        text,
  ronda_activa_id        text,
  ronda_activa_estado    text,
  ronda_capital_objetivo numeric,
  actualizado_en timestamptz not null default now()
);

alter table spinoffs_cache enable row level security;

create policy leer_spinoffs on spinoffs_cache
  for select to authenticated using (true);

alter table leads add column spinoff_clave text;

commit;