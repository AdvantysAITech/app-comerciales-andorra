/**
 * Vuelca una oportunidad de GHL con los campos personalizados ya traducidos.
 *   npm run ghl:oportunidad -- <id>
 *
 * El endpoint devuelve los customFields indexados por id, que son cadenas
 * opacas. Aquí se cruzan contra ghl-discovery.json para que el volcado se lea.
 */
import { readFileSync } from "node:fs";

const TOKEN = process.env.GHL_TOKEN;
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";
const ID = process.argv[2];

if (!TOKEN) {
  console.error("Falta GHL_TOKEN en .env.local");
  process.exit(1);
}
if (!ID) {
  console.error("Uso: npm run ghl:oportunidad -- <id de la oportunidad>");
  process.exit(1);
}

/** id de campo → { nombre, tipo }, desde el volcado del discovery. */
function catalogoCampos() {
  try {
    const discovery = JSON.parse(readFileSync("ghl-discovery.json", "utf8"));
    const bloque = discovery.find((r) => r.path.includes("model=opportunity"));
    const mapa = new Map();
    for (const c of bloque?.body?.customFields ?? []) {
      mapa.set(c.id, { nombre: c.name, tipo: c.dataType });
    }
    return mapa;
  } catch {
    console.warn("No pude leer ghl-discovery.json: los campos saldrán por id.\n");
    return new Map();
  }
}

const res = await fetch(`https://services.leadconnectorhq.com/opportunities/${ID}`, {
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Version: VERSION,
    Accept: "application/json",
  },
});

const texto = await res.text();
console.log(`HTTP ${res.status}\n`);

let data;
try {
  data = JSON.parse(texto);
} catch {
  console.log(texto.slice(0, 2000));
  process.exit(1);
}

const o = data.opportunity ?? data;

console.log("── OPORTUNIDAD ──");
console.log(`  nombre        : ${o.name}`);
console.log(`  valor         : ${o.monetaryValue}`);
console.log(`  estado        : ${o.status}`);
console.log(`  pipelineId    : ${o.pipelineId}`);
console.log(`  faseId        : ${o.pipelineStageId}`);
console.log(`  contactId     : ${o.contactId ?? o.contact?.id}`);
console.log(`  creada        : ${o.createdAt}`);

const campos = catalogoCampos();
const personalizados = o.customFields ?? [];

console.log(`\n── CAMPOS PERSONALIZADOS (${personalizados.length}) ──`);
for (const c of personalizados) {
  const meta = campos.get(c.id);
  const valor = c.fieldValue ?? c.value ?? c.fieldValueString ?? c.fieldValueArray;
  const etiqueta = meta ? `${meta.nombre}  [${meta.tipo}]` : `(id ${c.id})`;
  console.log(`  ${etiqueta}\n      = ${JSON.stringify(valor)}`);
}

// Un campo que la app cree haber escrito y no aparezca aquí es el fallo
// silencioso clásico: GHL ignora la opción que no reconoce y no devuelve nada.
const escritos = new Set(personalizados.map((c) => c.id));
const esperados = ["Servicio", "Modalidad", "Estado del presupuesto", "UUID App Comercial",
                   "Línea de negocio", "Rol en oportunidad JV", "BANT Score total"];

console.log("\n── COMPROBACIÓN ──");
for (const nombre of esperados) {
  const entrada = [...campos.entries()].find(([, m]) => m.nombre === nombre);
  if (!entrada) continue;
  console.log(`  ${escritos.has(entrada[0]) ? "✓" : "· vacío"}  ${nombre}`);
}

console.log("\n── CRUDO ──");
console.log(JSON.stringify(o, null, 2));