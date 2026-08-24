/**
 * Lee ghl-discovery.json y escupe, en TypeScript ya formateado, los IDs de los
 * campos y el texto EXACTO de cada opción.
 *
 *   npm run ghl:campos
 *   npm run ghl:campos -- presupuesto servicio modalidad
 *
 * El motivo de existir de este script: las etiquetas de GHL se han copiado a
 * mano tres veces y las tres han salido mal (`Web Advantys` por `Web`,
 * `Cliente Final` por `Cliente final`, `Finanzas` por `Recurrente`). GHL no da
 * error cuando recibe una opción que no existe: guarda el campo vacío y sigue.
 * Copiar de aquí en vez de teclear elimina la clase entera de fallo.
 */
import { readFileSync } from "node:fs";

const DISCOVERY = "ghl-discovery.json";

let resultados;
try {
  resultados = JSON.parse(readFileSync(DISCOVERY, "utf8"));
} catch {
  console.error(`No encuentro ${DISCOVERY}. Ejecuta antes: npm run ghl:discover`);
  process.exit(1);
}

/** Los filtros de la línea de comandos, en minúsculas y sin acentos. */
const filtros = process.argv.slice(2).map(normalizar);

function normalizar(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Las opciones vienen unas veces como strings y otras como {key,label} o
 *  {value,label}, según el tipo de campo y la versión de la API. */
function opcionesDe(campo) {
  const brutas = campo.picklistOptions ?? campo.options ?? campo.picklistImageOptions ?? [];
  return brutas
    .map((o) => (typeof o === "string" ? o : (o.label ?? o.value ?? o.key ?? "")))
    .filter(Boolean);
}

function volcar(titulo, campos) {
  if (!Array.isArray(campos) || campos.length === 0) {
    console.log(`\n── ${titulo} ──\n  (sin datos en el volcado)`);
    return;
  }

  const visibles = filtros.length
    ? campos.filter((c) => filtros.some((f) => normalizar(c.name).includes(f)))
    : campos;

  console.log(`\n── ${titulo} ── ${visibles.length} de ${campos.length}`);

  for (const c of visibles) {
    const opciones = opcionesDe(c);
    console.log(`\n  /* ${c.name}${c.dataType ? `  ·  ${c.dataType}` : ""} */`);
    console.log(`  ${claveTs(c.name)}: "${c.id}",`);

    if (opciones.length) {
      // Se imprimen entre comillas y con el texto literal: los acentos y las
      // mayúsculas de aquí son los que hay que copiar, sin retocar nada.
      console.log(`  //   opciones (texto EXACTO, cópialo tal cual):`);
      for (const o of opciones) console.log(`  //     "${o}"`);
    }

    // Los CHECKBOX exigen array en la API v2. Mandarles una cadena no da error,
    // deja el campo vacío. En el código hay que usar campoCheckbox(), no campo().
    if (c.dataType === "CHECKBOX") {
      console.log(`  //   ⚠ CHECKBOX → usa campoCheckbox(), no campo()`);
    }
  }
}

/** Nombre de GHL a clave de TypeScript: sin acentos, sin signos, snake_case. */
function claveTs(nombre) {
  return normalizar(nombre)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const busca = (fragmento) => resultados.find((r) => r.path.includes(fragmento));

volcar("Campos de OPORTUNIDAD", busca("model=opportunity")?.body?.customFields);

// El endpoint de contacto es el mismo path sin el model, así que se busca por
// exclusión para no quedarse con el de oportunidad.
const contacto = resultados.find(
  (r) => r.path.includes("/customFields") && !r.path.includes("model=opportunity"),
);
volcar("Campos de CONTACTO", contacto?.body?.customFields);

const pipelines = busca("/pipelines")?.body?.pipelines;
if (Array.isArray(pipelines)) {
  console.log(`\n── PIPELINES ──`);
  for (const p of pipelines) {
    console.log(`\n  /* ${p.name} */`);
    console.log(`  ${claveTs(p.name)}: {`);
    console.log(`    id: "${p.id}",`);
    for (const s of p.stages ?? []) {
      console.log(`    // fase "${s.name}": "${s.id}"`);
    }
    console.log(`  },`);
  }
}

console.log("");