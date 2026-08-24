begin;

alter table leads add column if not exists ruta               text;
alter table leads add column if not exists checklist          jsonb default '{}'::jsonb;
alter table leads add column if not exists arbol              jsonb default '{}'::jsonb;
alter table leads add column if not exists precio_presentado  numeric;
alter table leads add column if not exists precio_suelo       numeric;
alter table leads add column if not exists precio_desglose    jsonb;
alter table leads add column if not exists precio_version     text;
alter table leads add column if not exists estado_presupuesto text;
alter table leads add column if not exists motivos_revision   jsonb;

commit;