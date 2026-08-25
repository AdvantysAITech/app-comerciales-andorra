const { SYSTEM, construirPrompt } = await import("../lib/ia/prompt.ts");
const KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-sonnet-5";

if (!KEY) {
  console.error("Falta ANTHROPIC_API_KEY en .env.local");
  process.exit(1);
}

/** Dos casos: uno pequeño y uno grande, para ver cómo escala el tiempo. */
const CASOS = {
  ruta_1: {
    ruta: "RUTA_1",
    servicio: "Consultoría Sistema Advantys",
    cliente: {
      empresa: "Distribuciones Pirineo SL",
      sector: "Retail",
      empleados: "De 11 a 50",
      facturacion: "Entre 2 y 10M",
      ciudadPais: "Andorra la Vella, Andorra",
    },
    bant: { score: 7.5, clasificacion: "WARM" },
    checklist: {
      "¿Qué áreas hay que analizar?": ["Marketing", "Venta", "Posventa", "Gestión"],
      "¿Cuántas personas hay que entrevistar?": "4-8",
      "¿Tiene documentados sus procesos actuales?": "Parcial o desactualizado",
      "¿Qué tiene montado hoy?": "Herramientas sueltas sin conectar",
      "Modalidad de las sesiones": "Todo online",
    },
    contexto_libre:
      "Llevan tres años creciendo y el comercial va con hojas de cálculo. " +
      "Pierden seguimientos, no saben cuántos presupuestos tienen abiertos y " +
      "el gerente dice que factura por inercia, no por gestión. Probaron un CRM " +
      "hace dos años y lo abandonaron en seis meses porque nadie lo rellenaba.",
    precio_calculado: 4300,
  },

  ruta_3: {
    ruta: "RUTA_3",
    servicio: "Implantación Sistema Advantys",
    cliente: {
      empresa: "Grupo Hotelero Vallnord SA",
      sector: "Hostelería / Turismo",
      empleados: "De 101 a 200",
      facturacion: "Entre 10 y 50M",
      ciudadPais: "Encamp, Andorra",
    },
    bant: { score: 8.6, clasificacion: "HOT" },
    checklist: {
      "¿Qué módulos necesita?": [
        "Web corporativa y landings", "Embudos de captación",
        "Formularios y captura de leads", "Campañas de email y SMS",
        "Nurturing automatizado", "CRM: pipelines, fases y automatizaciones",
        "Calendario y reserva de reuniones", "Propuestas y firma digital",
        "Dashboard comercial", "Bot de soporte con IA", "Sistema de tickets",
      ],
      "¿Con cuántos sistemas externos hay que integrarse?": 3,
      "¿Cuáles?": "PMS hotelero, pasarela de pago Redsys, contabilidad",
      "¿Tiene ya algo montado?": "Un CRM que hay que migrar",
      "Volumen de datos a migrar": "Más de 10.000",
      "Usuarios que van a usar el sistema": "21-50",
      "¿En cuántos idiomas tiene que funcionar el sistema?": 3,
      "Formación y acompañamiento": "Plan de formación por rol",
      "Plazo que pide el cliente": "2 meses",
    },
    contexto_libre:
      "Cuatro hoteles y dos restaurantes. Cada establecimiento gestiona sus " +
      "reservas directas de forma distinta y el grupo no tiene visión conjunta. " +
      "El director comercial quiere saber cuánto vale un cliente que repite y " +
      "hoy no puede. Además pierden reservas directas frente a las OTAs porque " +
      "no hacen ningún seguimiento posterior a la estancia.",
    precio_calculado: 32100,
    referencia: {
      nombre: "Plataforma Advantys (sistema propio)",
      horas: 200,
      alcance: "Sistema completo, 15 módulos, 4 áreas, montado sobre snapshot",
    },
  },
};

const clave = process.argv[2] ?? "ruta_1";
const entrada = CASOS[clave];
if (!entrada) {
  console.error(`Caso desconocido. Usa: ${Object.keys(CASOS).join(" | ")}`);
  process.exit(1);
}

const prompt = construirPrompt(entrada);

console.log(`Caso: ${clave} · modelo: ${MODELO}\nLlamando…\n`);
const t0 = Date.now();

const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: MODELO,
    max_tokens: 8000,
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
  }),
});

const segundos = ((Date.now() - t0) / 1000).toFixed(1);
const data = await res.json();

console.log(`HTTP ${res.status} · ${segundos} s\n`);

if (!res.ok) {
  console.error(JSON.stringify(data, null, 2));
  process.exit(1);
}

const texto = (data.content ?? [])
  .filter((b) => b.type === "text")
  .map((b) => b.text)
  .join("\n");

console.log(`Tokens: ${data.usage?.input_tokens} entrada · ${data.usage?.output_tokens} salida`);
console.log(`stop_reason: ${data.stop_reason}\n`);

// Lo que de verdad se comprueba aquí no es que responda, sino que responda
// JSON limpio: si devuelve preámbulo o backticks, el parseo estricto de
// salida.ts lo rechazará y el alta fallará.
let alcance;
try {
  alcance = JSON.parse(texto.trim());
  console.log("✓ JSON válido sin necesidad de limpiar\n");
} catch {
  const i = texto.indexOf("{"), f = texto.lastIndexOf("}");
  try {
    alcance = JSON.parse(texto.slice(i, f + 1));
    console.log("⚠ JSON válido SOLO tras recortar. Revisa el prompt.\n");
  } catch {
    console.error("✗ No devolvió JSON interpretable:\n");
    console.log(texto.slice(0, 1500));
    process.exit(1);
  }
}

const faltan = [
  "resumen_ejecutivo", "contexto", "objetivos", "alcance_incluido",
  "alcance_excluido", "supuestos", "riesgos", "entregables",
  "plazo_estimado_semanas", "confianza", "avisos",
].filter((c) => alcance[c] === undefined);

console.log(faltan.length ? `✗ Faltan campos: ${faltan.join(", ")}` : "✓ Esquema completo");
console.log(`  confianza : ${alcance.confianza}`);
console.log(`  bloques   : ${alcance.alcance_incluido?.length}`);
console.log(`  horas     : ${alcance.alcance_incluido?.reduce((s, b) => s + (b.horas_min + b.horas_max) / 2, 0)}`);
console.log(`  avisos    : ${alcance.avisos?.length ?? 0}`);

// El precio es la regla que más importa: si aparece un euro en el texto, el
// prompt ha fallado en lo único que no puede fallar.
const conEuros = JSON.stringify(alcance).match(/\d[\d.,]*\s*(?:€|euros)/gi);
console.log(conEuros ? `\n⚠ MENCIONA IMPORTES: ${conEuros.join(", ")}` : "\n✓ Sin importes en el texto");

console.log("\n── SALIDA ──\n");
console.log(JSON.stringify(alcance, null, 2));