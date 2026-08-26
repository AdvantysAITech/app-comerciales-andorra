-- RUTA 7 · Inversores.
--
-- El comercial marca en el paso de Revisión si el inversor quiere recibir el
-- dossier. El dato se guarda aquí ADEMÁS de escribirse en GHL: si el campo de
-- GHL todavía no existe, o la escritura falla, la intención del inversor no se
-- pierde y se puede reenviar desde la app.

begin;

alter table leads
  add column if not exists info_inversores boolean not null default false;

comment on column leads.info_inversores is
  'RUTA 7: el inversor ha pedido recibir información de inversión. Dispara la automatización de GHL al crearse la oportunidad.';

commit;
