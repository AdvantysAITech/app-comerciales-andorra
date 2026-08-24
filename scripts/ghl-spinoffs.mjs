/**
 * Vuelca los registros crudos del objeto Spin-off.
 *   npm run ghl:spinoffs
 *
 * Existe porque `sincronizarSpinoffs()` falla con un mensaje que dice QUÉ pasa
 * ("ninguna con clave interna") pero no POR QUÉ. Aquí se ven las propiedades
 * tal como las devuelve GHL, con su clave literal, y se acabó el adivinar.
 */
const TOKEN = process.env.GHL_TOKEN;
const LOC = process.env.GHL_LOCATION_ID;
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";
const OBJETO = "custom_objects.spin_offs";

if (!TOKEN || !LOC) {
  console.error("Faltan GHL_TOKEN o GHL_LOCATION_ID en .env.local");
  process.exit(1);
}

const res = await fetch(
  `https://services.leadconnectorhq.com/objects/${OBJETO}/records/search`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locationId: LOC,
      page: 1,
      pageLimit: 50,
      query: "",
      searchAfter: [],
    }),
  },
);

const texto = await res.text();
console.log(`\nHTTP ${res.status}\n`);

let data;
try {
  data = JSON.parse(texto);
} catch {
  console.log(texto.slice(0, 2000));
  process.exit(1);
}

const registros = data.records ?? [];
console.log(`Registros devueltos: ${registros.length}\n`);

if (registros.length === 0) {
  console.log("GHL no devuelve ningún registro. Revisa que el objeto tenga");
  console.log("registros creados y que el token tenga el scope objects/record.readonly");
  process.exit(0);
}

for (const r of registros) {
  console.log(`── registro ${r.id} ──`);
  const props = r.properties ?? {};
  const claves = Object.keys(props);
  if (claves.length === 0) {
    console.log("  (sin properties)");
  }
  for (const k of claves) {
    console.log(`  ${k.padEnd(50)} = ${JSON.stringify(props[k])}`);
  }
  console.log("");
}

const tieneClave = registros.some((r) => {
  const p = r.properties ?? {};
  return p["clave_interna"] || p[`${OBJETO}.clave_interna`];
});

console.log(
  tieneClave
    ? "✓ Al menos un registro trae clave_interna."
    : "✗ NINGÚN registro trae clave_interna. Hay que crear la propiedad en GHL\n" +
      "  y rellenarla en los cuatro registros. Mira arriba qué claves SÍ llegan:\n" +
      "  si aparece con otro nombre, el arreglo es en el código, no en GHL.",
);