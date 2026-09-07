/**
 * Comprueba QUÉ devuelve GHL al preguntar por un registro que no existe.
 *
 * Existe porque toda la sincronización se apoya en una suposición: que un
 * registro borrado da 404 y no otra cosa. Antes de dejar que un cron marque
 * leads en base a eso, se comprueba. Es el mismo camino que se siguió con la
 * subida de documentos.
 *
 * Uso (desde la raíz del repo):
 *   node --env-file=.env.local scripts/ghl-comprobar-existencia.mjs <oportunidadIdReal> [contactoIdReal]
 *
 * Hace tres llamadas:
 *   1. Una oportunidad que SÍ existe   -> se espera 200
 *   2. Un id inventado con forma válida -> se espera 404
 *   3. Un id con forma inválida         -> se mira qué contesta
 *
 * Si la 2 no devuelve 404, NO despliegues el cron: la regla de marcado no
 * vale y hay que ajustarla al código que salga.
 *
 * Requiere en .env.local: GHL_TOKEN.
 */
const BASE = "https://services.leadconnectorhq.com";
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";

const oportunidadId = process.argv[2];

if (!oportunidadId) {
  console.error(
    "Falta el id de una oportunidad REAL, para comparar.\n" +
      "Uso: node --env-file=.env.local scripts/ghl-comprobar-existencia.mjs <oportunidadId>",
  );
  process.exit(1);
}

const token = process.env.GHL_TOKEN;
if (!token) {
  console.error("Falta GHL_TOKEN en .env.local");
  process.exit(1);
}

async function probar(etiqueta, ruta) {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Version: VERSION,
      Accept: "application/json",
    },
  });
  const texto = await res.text();
  console.log(`${etiqueta.padEnd(28)} HTTP ${res.status}`);
  if (!res.ok) console.log(`   ${texto.slice(0, 300)}`);
  return res.status;
}

console.log("");
const existente = await probar("1) Oportunidad real", `/opportunities/${oportunidadId}`);

// Misma longitud y alfabeto que un id de GHL, pero inventado.
const inventado = "zzzzzzzzzzzzzzzzzzzz";
const inexistente = await probar("2) Id inventado", `/opportunities/${inventado}`);

await probar("3) Id con forma inválida", "/opportunities/no-es-un-id");

/* --- Contactos: lo que se comprueba en los borradores ---------------- */
//
// Un borrador no tiene oportunidad, solo contacto. Si los contactos no
// contestaran 404 al no existir, la pasada de borradores no marcaría nada.

let contactoOk = true;
const contactoId = process.argv[3];

if (contactoId) {
  console.log("");
  const real = await probar("4) Contacto real", `/contacts/${contactoId}`);
  const falso = await probar("5) Contacto inventado", "/contacts/zzzzzzzzzzzzzzzzzzzz");
  contactoOk = real === 200 && falso === 404;
} else {
  console.log("\n(Sin id de contacto: no se ha comprobado la vía de los borradores.)");
}

console.log("");
if (existente === 200 && inexistente === 404 && contactoOk) {
  console.log("Correcto: 200 para lo que existe, 404 para lo que no.");
  console.log("La regla del cron —solo el 404 marca— es válida.");
} else {
  console.log("OJO: no sale lo esperado.");
  console.log(`   Real: ${existente} · Inventado: ${inexistente}`);
  console.log("   Ajusta la regla en lib/leads/sincronizar-crm.ts antes de desplegar.");
  process.exit(1);
}

