begin;
alter table leads add column if not exists servicio  text;
alter table leads add column if not exists modalidad text;
commit;