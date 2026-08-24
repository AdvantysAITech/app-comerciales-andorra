begin;

create table if not exists documentos (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  comercial_id  uuid not null,

  -- Trazabilidad completa (7.7): con qué se generó cada documento.
  modelo          text not null,
  version_prompt  text not null,
  entrada         jsonb not null,
  salida_cruda    text  not null,
  alcance         jsonb not null,
  tokens_entrada  integer,
  tokens_salida   integer,

  -- Control de coherencia (7.5).
  baseline_horas    numeric,
  estimado_horas    numeric,
  desviacion        numeric,

  -- El documento de cliente NO se descarga hasta que Jacob valida (7.6).
  validado_por  uuid,
  validado_en   timestamptz,

  creado_en     timestamptz not null default now()
);

alter table documentos enable row level security;

-- El comercial ve sus documentos, pero la descarga del de cliente se
-- comprueba en el endpoint, no aquí: leer la fila no es descargar el PDF.
create policy documentos_select on documentos
  for select to authenticated
  using (
    comercial_id = auth.uid()
    or exists (
      select 1 from permisos
      where profile_id = auth.uid()
        and modulo_clave = 'captacion'
        and alcance in ('equipo', 'total')
    )
  );

create policy documentos_insert on documentos
  for insert to authenticated
  with check (comercial_id = auth.uid());

commit;