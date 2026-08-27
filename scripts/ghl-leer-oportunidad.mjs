/**
 * Lee una oportunidad de GHL y vuelca sus campos personalizados en crudo.
 *
 * Sirve para una cosa concreta: averiguar en que formato guarda GHL el valor
 * de un campo FILE_UPLOAD. La documentacion no lo dice, y hay varios formatos
 * plausibles (array de urls, url suelta, array de objetos). En vez de probar a
 * ciegas contra la API, se sube un archivo A MANO desde el CRM y se lee aqui
 * como ha quedado. Lo que devuelva esto es la verdad.
 *
 * Uso (desde la raiz del repo):
 *   node --env-file=.env.local scripts/ghl-leer-oportunidad.mjs <oportunidadId>
 *
 * Requiere en .env.local: GHL_TOKEN y GHL_LOCATION_ID.
 */
const BASE = "https://services.leadconnectorhq.com";
const CAMPO_DOCUMENTACION = "8x98MVDlYSPA591T82LR";

const oportunidadId = process.argv[2];
if (!oportunidadId) {
  console.error(
    "Falta el id de la oportunidad.\n" +
      "Uso: node --env-file=.env.local scripts/ghl-leer-oportunidad.mjs <oportunidadId>",
  );
  process.exit(1);
}

const token = process.env.GHL_TOKEN;
if (!token) {
  console.error("Falta GHL_TOKEN en .env.local");
  process.exit(1);
}

const res = await fetch(`${BASE}/opportunities/${oportunidadId}`, {
  headers: {
    Authorization: `Bearer ${token}`,
    Version: process.env.GHL_API_VERSION ?? "2021-07-28",
    Accept: "application/json",
  },
});

const texto = await res.text();
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(texto);
  process.exit(1);
}

const data = JSON.parse(texto);
const op = data.opportunity ?? data;

console.log(`Oportunidad : ${op.name ?? "(sin nombre)"}`);
console.log(`Propietario : ${op.assignedTo ?? "(sin asignar)"}`);
console.log("");

const campos = op.customFields ?? [];
if (campos.length === 0) {
  console.log("La oportunidad no tiene ningun campo personalizado con valor.");
  process.exit(0);
}

console.log("── Todos los campos con valor ──");
for (const c of campos) {
  const id = c.id ?? c.fieldId;
  console.log(`  ${id}  ${JSON.stringify(c.fieldValue ?? c.field_value ?? c.value)}`);
}

const doc = campos.find((c) => (c.id ?? c.fieldId) === CAMPO_DOCUMENTACION);

console.log("");
console.log("── Campo «Documentacion» ──");
if (!doc) {
  console.log("  Vacio. Sube un PDF A MANO desde el CRM (arrastrandolo al");
  console.log("  campo), guarda, y vuelve a ejecutar este script.");
} else {
  // El objeto entero, sin filtrar: la clave que lleva el valor cambia segun
  // la version de la API y es justo lo que queremos ver.
  console.log(JSON.stringify(doc, null, 2));
}
