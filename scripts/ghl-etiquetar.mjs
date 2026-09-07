/**
 * Comprueba que añadir una etiqueta NO borra las que ya tiene el contacto.
 *
 * Es la suposición sobre la que se apoya `etiquetarContacto()`: que
 * `POST /contacts/:id/tags` añade en vez de reemplazar. Si reemplazara, cada
 * alta desde la app borraría el `hot` y el resto de etiquetas que ponen los
 * workflows, y nadie se daría cuenta hasta que fallara una segmentación.
 *
 * Uso (desde la raíz del repo):
 *   node --env-file=.env.local scripts/ghl-etiquetar.mjs <contactoId>
 *
 * Usa un contacto de prueba: deja puesta la etiqueta `prueba-etiquetado`.
 *
 * Requiere en .env.local: GHL_TOKEN.
 */
const BASE = "https://services.leadconnectorhq.com";
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";

const contactoId = process.argv[2];

if (!contactoId) {
  console.error(
    "Falta el id del contacto.\n" +
      "Uso: node --env-file=.env.local scripts/ghl-etiquetar.mjs <contactoId>",
  );
  process.exit(1);
}

const token = process.env.GHL_TOKEN;
if (!token) {
  console.error("Falta GHL_TOKEN en .env.local");
  process.exit(1);
}

const cabeceras = {
  Authorization: `Bearer ${token}`,
  Version: VERSION,
  Accept: "application/json",
};

async function leerEtiquetas() {
  const res = await fetch(`${BASE}/contacts/${contactoId}`, { headers: cabeceras });
  const texto = await res.text();
  if (!res.ok) {
    console.error(`No se pudo leer el contacto: HTTP ${res.status}`);
    console.error(texto.slice(0, 300));
    process.exit(1);
  }
  return JSON.parse(texto).contact?.tags ?? [];
}

const antes = await leerEtiquetas();
console.log(`\nEtiquetas antes : ${antes.length ? antes.join(", ") : "(ninguna)"}`);

const res = await fetch(`${BASE}/contacts/${contactoId}/tags`, {
  method: "POST",
  headers: { ...cabeceras, "Content-Type": "application/json" },
  body: JSON.stringify({ tags: ["prueba-etiquetado"] }),
});

const texto = await res.text();
console.log(`Añadir etiqueta : HTTP ${res.status}`);
if (!res.ok) {
  console.error(texto.slice(0, 400));
  process.exit(1);
}

const despues = await leerEtiquetas();
console.log(`Etiquetas después: ${despues.length ? despues.join(", ") : "(ninguna)"}`);

const perdidas = antes.filter((t) => !despues.includes(t));

console.log("");
if (perdidas.length > 0) {
  console.log(`OJO: se han perdido etiquetas: ${perdidas.join(", ")}`);
  console.log("   El endpoint REEMPLAZA. Hay que leer y concatenar antes de escribir.");
  process.exit(1);
}
if (!despues.includes("prueba-etiquetado")) {
  console.log("OJO: la etiqueta no se ha aplicado aunque la respuesta fue correcta.");
  process.exit(1);
}
console.log("Correcto: la etiqueta nueva está y no se ha perdido ninguna de las anteriores.");
console.log("Acuérdate de quitar `prueba-etiquetado` del contacto de prueba.");
