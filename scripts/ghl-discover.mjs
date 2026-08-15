/**
 * Vuelca los IDs internos de la sub-cuenta de GHL.
 *   npm run ghl:discover
 * Imprime el status de cada endpoint por separado: un 401 o 403 significa
 * que al Private Integration Token le falta ese scope.
 */
import { writeFileSync } from "node:fs";

const TOKEN = process.env.GHL_TOKEN;
const LOC = process.env.GHL_LOCATION_ID;
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";
const BASE = "https://services.leadconnectorhq.com";

if (!TOKEN || !LOC) {
  console.error("Faltan GHL_TOKEN o GHL_LOCATION_ID. ¿Has rellenado .env.local?");
  process.exit(1);
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Version: VERSION,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  let payload;
  try {
    payload = texto ? JSON.parse(texto) : null;
  } catch {
    payload = texto.slice(0, 800);
  }
  console.log(`${String(res.status).padEnd(4)} ${method} ${path}`);
  return { path, method, status: res.status, body: payload };
}

const resultados = [];
resultados.push(await call(`/opportunities/pipelines?locationId=${LOC}`));
resultados.push(await call(`/locations/${LOC}/customFields`));
resultados.push(await call(`/locations/${LOC}/customFields?model=opportunity`));
resultados.push(await call(`/objects/?locationId=${LOC}`));
resultados.push(await call(`/users/?locationId=${LOC}`));
resultados.push(await call(`/associations/?locationId=${LOC}&skip=0&limit=100`));

writeFileSync("ghl-discovery.json", JSON.stringify(resultados, null, 2));

// Resumen legible: es lo que copiaremos a lib/ghl/ids.ts en el paso siguiente.
const pipelines = resultados.find((r) => r.path.includes("/pipelines"))?.body?.pipelines;
if (Array.isArray(pipelines)) {
  console.log("\n── Pipelines y primera fase ──");
  for (const p of pipelines) {
    const primera = p.stages?.[0];
    console.log(`\n${p.name}`);
    console.log(`  pipelineId : ${p.id}`);
    console.log(`  primeraFase: ${primera?.id}  (${primera?.name})`);
  }
}

const campos = resultados.find((r) => r.path.includes("/customFields"))?.body?.customFields;
if (Array.isArray(campos)) {
  console.log("\n── Campos personalizados de Contacto ──");
  for (const c of campos) console.log(`  ${c.id}  ${c.name}`);
}

const camposOpp = resultados.find((r) => r.path.includes("model=opportunity"))?.body?.customFields;
if (Array.isArray(camposOpp)) {
  console.log("\n── Campos personalizados de Oportunidad ──");
  for (const c of camposOpp) console.log(`  ${c.id}  ${c.name}`);
}

const objetos = resultados.find((r) => r.path.startsWith("/objects/"))?.body;
console.log("\n── Objetos de la sub-cuenta ──");
console.log(JSON.stringify(objetos, null, 2));

const asociaciones = resultados.find((r) => r.path.startsWith("/associations/"))?.body;
console.log("\n── Asociaciones ──");
console.log(JSON.stringify(asociaciones, null, 2));

console.log("\n→ ghl-discovery.json escrito con la respuesta completa.");