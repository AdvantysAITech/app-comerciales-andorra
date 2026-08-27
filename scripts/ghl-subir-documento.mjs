/**
 * Valida el ciclo completo de adjuntar un PDF al campo «Documentacion».
 *
 * Son dos llamadas, no una:
 *   1. POST /locations/:id/customFields/upload  -> deja el archivo y da su URL.
 *      NO toca la oportunidad: con esto solo, el campo se queda vacio.
 *   2. PUT  /opportunities/:id                  -> apunta el campo a esa URL.
 *Q
 * El formato del valor no esta documentado; se saco leyendo una oportunidad
 * con un archivo subido a mano:
 *   [{ url, meta: { mimetype, name, size }, deleted: false }]
 *
 * Uso (desde la raiz del repo):
 *   node --env-file=.env.local scripts/ghl-subir-documento.mjs <oportunidadId> [ruta.pdf]
 *
 * Requiere en .env.local: GHL_TOKEN y GHL_LOCATION_ID.
 */
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

const CAMPO_DOCUMENTACION = "8x98MVDlYSPA591T82LR";
const BASE = "https://services.leadconnectorhq.com";
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";

const oportunidadId = process.argv[2];
const rutaPdf = process.argv[3];

if (!oportunidadId) {
  console.error(
    "Falta el id de la oportunidad.\n" +
      "Uso: node --env-file=.env.local scripts/ghl-subir-documento.mjs <oportunidadId> [ruta.pdf]",
  );
  process.exit(1);
}

const token = process.env.GHL_TOKEN;
const location = process.env.GHL_LOCATION_ID;
if (!token || !location) {
  console.error("Faltan GHL_TOKEN o GHL_LOCATION_ID en .env.local");
  process.exit(1);
}

/** PDF valido minimo, por si no se pasa uno. Una pagina en blanco. */
function pdfDePrueba() {
  const cuerpo = [
    "%PDF-1.4",
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj",
    "trailer<</Root 1 0 R>>",
    "%%EOF",
  ].join("\n");
  return new TextEncoder().encode(cuerpo);
}

const bytes = rutaPdf ? new Uint8Array(await readFile(rutaPdf)) : pdfDePrueba();
const nombre = rutaPdf ? rutaPdf.split(/[\\/]/).pop() : "prueba-advantys.pdf";

console.log(`Oportunidad : ${oportunidadId}`);
console.log(`Archivo     : ${nombre} (${bytes.byteLength} bytes)`);
console.log("");

/* ------------------------------------------------------------------ */
/* 1. Subir                                                            */
/* ------------------------------------------------------------------ */

const form = new FormData();
form.append("id", oportunidadId);
form.append("maxFiles", "1");
form.append(
  `${CAMPO_DOCUMENTACION}_${randomUUID()}`,
  new Blob([bytes], { type: "application/pdf" }),
  nombre,
);

// Sin Content-Type a mano: fetch lo genera con el boundary correcto.
const resSubida = await fetch(`${BASE}/locations/${location}/customFields/upload`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, Version: "v3", Accept: "application/json" },
  body: form,
});

const textoSubida = await resSubida.text();
console.log(`1) Subida        HTTP ${resSubida.status}`);
if (!resSubida.ok) {
  console.error(textoSubida);
  process.exit(1);
}

const datosSubida = JSON.parse(textoSubida);
const url =
  datosSubida.meta?.[0]?.url ?? Object.values(datosSubida.uploadedFiles ?? {})[0];

if (!url) {
  console.error("Aceptada, pero sin URL en la respuesta:");
  console.error(textoSubida);
  process.exit(1);
}
console.log(`   URL: ${url}`);

/* ------------------------------------------------------------------ */
/* 2. Apuntar el campo                                                 */
/* ------------------------------------------------------------------ */

const archivo = {
  url,
  meta: { mimetype: "application/pdf", name: nombre, size: bytes.byteLength },
  deleted: false,
};

const resPut = await fetch(`${BASE}/opportunities/${oportunidadId}`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${token}`,
    Version: VERSION,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    customFields: [{ id: CAMPO_DOCUMENTACION, field_value: [archivo] }],
  }),
});

const textoPut = await resPut.text();
console.log(`2) Asignacion    HTTP ${resPut.status}`);
if (!resPut.ok) {
  console.error(textoPut);
  console.log("");
  console.log("Si falla aqui, el archivo YA esta subido pero el campo sigue");
  console.log("vacio. Pasa esta respuesta entera para ajustar el formato.");
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* 3. Releer para confirmar                                            */
/* ------------------------------------------------------------------ */

const resLeer = await fetch(`${BASE}/opportunities/${oportunidadId}`, {
  headers: { Authorization: `Bearer ${token}`, Version: VERSION, Accept: "application/json" },
});

const datos = JSON.parse(await resLeer.text());
const op = datos.opportunity ?? datos;
const campo = (op.customFields ?? []).find(
  (c) => (c.id ?? c.fieldId) === CAMPO_DOCUMENTACION,
);

console.log(`3) Verificacion  HTTP ${resLeer.status}`);
console.log("");

if (!campo) {
  console.log("El campo sigue VACIO tras el PUT. El formato del valor no es el");
  console.log("correcto. Pasa esta salida para ajustarlo.");
  process.exit(1);
}

console.log("── Campo «Documentacion» tras el PUT ──");
console.log(JSON.stringify(campo, null, 2));
console.log("");
console.log("Confirmalo tambien abriendo la oportunidad en el CRM.");
