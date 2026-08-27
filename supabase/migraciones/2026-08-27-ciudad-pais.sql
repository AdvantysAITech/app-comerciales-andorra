-- Separar «Ciudad y país» en dos columnas.
--
-- Hasta ahora el comercial escribía «Andorra la Vella, Andorra» en un solo
-- campo, y ese texto entero se mandaba al campo `city` de GHL. Es decir: el
-- país acababa metido dentro de la ciudad, y filtrar por país en el CRM era
-- imposible.
--
-- El backfill parte por la ÚLTIMA coma. Acierta en el formato normal
-- («Ciudad, País») y también con ciudades compuestas («Sant Julià de Lòria,
-- Andorra»). Falla si alguien escribió solo la ciudad, sin coma: en ese caso
-- todo el texto se queda en `ciudad` y `pais` sale vacío, que es preferible a
-- inventarse un país.
--
-- REVISA los datos migrados antes de dar esto por bueno:
--   select ciudad, pais from leads order by creado_en desc;

begin;

alter table leads
  add column if not exists ciudad text,
  add column if not exists pais   text;

update leads
set
  ciudad = case
    when position(',' in ciudad_pais) > 0
      then btrim(left(ciudad_pais, length(ciudad_pais) - position(',' in reverse(ciudad_pais))))
    else btrim(ciudad_pais)
  end,
  pais = case
    when position(',' in ciudad_pais) > 0
      then btrim(right(ciudad_pais, position(',' in reverse(ciudad_pais)) - 1))
    else null
  end
where ciudad_pais is not null
  and ciudad is null;

comment on column leads.ciudad is 'Ciudad del contacto. Va al campo `city` de GHL.';
comment on column leads.pais is
  'País en texto libre. Se traduce a código ISO alpha-2 en lib/ghl/contactos.ts antes de mandarlo a GHL; si no se reconoce, GHL no recibe país.';

-- `ciudad_pais` NO se borra todavía a propósito. Si el backfill ha partido mal
-- algún registro, la única copia del dato original está ahí. Bórrala en una
-- migración posterior, cuando hayas revisado los datos:
--
--   alter table leads drop column ciudad_pais;

commit;