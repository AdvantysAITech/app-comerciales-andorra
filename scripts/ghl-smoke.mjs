/**
 * Prueba de humo contra GHL. Lee spin-offs y, con --write, crea un lead
 * de prueba completo (contacto + oportunidad + asociación).
 *
 *   npm run ghl:smoke
 *   npm run ghl:smoke -- --write
 */
const TOKEN = process.env.GHL_TOKEN;
const LOC = process.env.GHL_LOCATION_ID;
const VERSION = process.env.GHL_API_VERSION ?? "2021-07-28";
const BASE = "https://services.leadconnectorhq.com";
const ESCRIBIR = process.argv.includes("--write");

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
    payload = texto.slice(0, 600);
  }
  if (!res.ok) {
    console.error(`\n✗ ${method} ${path} → ${res.status}`);
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
  }
  console.log(`✓ ${method} ${path}`);
  return payload;
}

// 1. Spin-offs
const spinoffs = await call(`/objects/custom_objects.spin_offs/records/search`, {
  method: "POST",
  body: { locationId: LOC, page: 1, pageLimit: 50, query: "", searchAfter: [] },
});
console.log("\n── Spin-offs ──");
for (const r of spinoffs.records ?? []) {
  console.log(`  ${r.id}`);
  console.log(`    ${JSON.stringify(r.properties)}`);
}

if (!ESCRIBIR) {
  console.log("\nSolo lectura. Añade --write para crear un lead de prueba.");
  process.exit(0);
}

// 2. Contacto
const sello = Date.now();
const contacto = await call("/contacts/upsert", {
  method: "POST",
  body: {
    locationId: LOC,
    firstName: "Prueba",
    lastName: "App Comercial",
    name: "Prueba App Comercial",
    email: `prueba.appcomercial+${sello}@advantys.ai`,
    phone: "+376600000",
    companyName: "Empresa de Prueba SL",
    city: "Andorra la Vella",
    source: "App Comercial · Prueba",
  },
});
const contactoId = contacto.contact?.id;
console.log(`  contactoId: ${contactoId}  (nuevo: ${contacto.new})`);

// 3. Oportunidad en Cliente Final — Spin-offs
const oportunidad = await call("/opportunities/", {
  method: "POST",
  body: {
    locationId: LOC,
    pipelineId: "v9TkoUZkqFTigFnDTBHg",
    pipelineStageId: "16cbbc2a-8471-4a29-ab03-5c3e20f03fdc",
    name: "Empresa de Prueba SL — PRUEBA — Cliente Final",
    status: "open",
    contactId: contactoId,
    monetaryValue: 1234,
    customFields: [
      { id: "MRoqR8q4UT7L0YOMpotJ", field_value: "Joint Venture Builder" },
      { id: "lfgwNeKAU142WF0dRK95", field_value: "Cliente Final" },
    ],
  },
});
const oportunidadId = oportunidad.opportunity?.id;
console.log(`  oportunidadId: ${oportunidadId}`);

// 4. Asociación con la primera spin-off
const primera = spinoffs.records?.[0];
if (primera) {
  await call("/associations/relations", {
    method: "POST",
    body: {
      locationId: LOC,
      associationId: "6a7dc7507ce3df2087c4b6cc",
      firstRecordId: primera.id,
      secondRecordId: oportunidadId,
    },
  });
  console.log(`  spin-off vinculada: ${primera.id}`);
}

console.log("\n→ Lead de prueba creado. Bórralo desde GHL cuando lo hayas revisado.");