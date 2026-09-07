import "server-only";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";
import type { EdicionDocumento } from "./edicion";

export type Hito = { concepto: string; porcentaje: number };

/** Forma de pago por defecto (7.6). ISO 42001 tiene su propio calendario
 *  porque sus hitos no son de desarrollo sino de sistema documentado y
 *  auditoría interna. */
export function formaDePago(ruta: Ruta): Hito[] {
  if (ruta === "ruta_5") {
    return [
      { concepto: "A la firma", porcentaje: 30 },
      { concepto: "Con el sistema documentado", porcentaje: 40 },
      { concepto: "Tras la auditoría interna", porcentaje: 30 },
    ];
  }
  return [
    { concepto: "A la firma", porcentaje: 30 },
    { concepto: "A mitad de proyecto", porcentaje: 40 },
    { concepto: "A la entrega", porcentaje: 30 },
  ];
}

export const DIAS_VALIDEZ = 30;

export type DocumentoCliente = {
  referencia: string;
  fecha: string;
  validoHasta: string;
  /** La misma fecha en ISO. La pantalla de edición necesita rellenar un
   *  `<input type="date">`, y de «4 de octubre de 2026» no se vuelve atrás. */
  validoHastaIso: string;
  empresa: string;
  resumen: string;
  contexto: string;
  objetivos: string[];
  /** Sin horas: solo bloque y descripción. */
  incluido: { bloque: string; descripcion: string }[];
  excluido: string[];
  entregables: string[];
  plazoSemanas: { min: number; max: number };
  precio: number | null;
  hitos: Hito[];
  supuestos: string[];
  /** Nota fiscal andorrana y avisos que sí afectan al cliente. */
  notas: string[];
};

/** Referencia legible: ADV-2026-0824-A3F2. Corta, ordenable y sin exponer
 *  el UUID entero en la portada de un documento que circula por email. */
export function referencia(uuid: string, fecha: Date): string {
  const d = fecha.toISOString().slice(0, 10).replace(/-/g, "").slice(2);
  return `ADV-${d}-${uuid.slice(0, 4).toUpperCase()}`;
}

export function construirDocumentoCliente(args: {
  alcance: Alcance;
  ruta: Ruta;
  uuid: string;
  empresa: string;
  precio: number | null;
  fecha?: Date;
  /**
   * Modificaciones hechas a mano sobre la propuesta. Se aplican AL FINAL,
   * campo por campo: lo que no se haya tocado sigue saliendo del alcance
   * original, que nunca se sobrescribe en base de datos.
   */
  edicion?: EdicionDocumento | null;
}): DocumentoCliente {
  const fecha = args.fecha ?? new Date();
  const vence = new Date(fecha);
  vence.setDate(vence.getDate() + DIAS_VALIDEZ);

  const e = args.edicion ?? {};

  const fmt = (d: Date) =>
    d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });

  // La fecha editada se interpreta a mediodía UTC, no a medianoche: a
  // medianoche, cualquier huso al oeste de Greenwich devuelve el día anterior
  // y la propuesta caduca un día antes de lo que puso el comercial.
  const venceFinal = e.validoHasta ? new Date(`${e.validoHasta}T12:00:00Z`) : vence;
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const notas: string[] = [
    "Advantys AI SL es una entidad andorrana. Las facturas se emiten sin IVA " +
      "español ni retención de IRPF. A clientes andorranos se aplica IGI del 4,5%.",
  ];

  if (args.ruta === "ruta_5") {
    notas.push(
      "La tasa del organismo certificador no está incluida en este importe. " +
        "La cobra un tercero independiente y ronda los 6.000-12.000 € para la " +
        "auditoría inicial.",
    );
    notas.push("Servicio en reserva: la ejecución comienza en enero de 2027.");
  }

  if (args.ruta === "ruta_1") {
    notas.push(
      "El importe de esta consultoría se descuenta íntegramente si se contrata " +
        "la implantación dentro de los 60 días siguientes a la entrega.",
    );
  }

  return {
    // Referencia y fecha de emisión no son editables: el documento se
    // sobrescribe, pero al menos estas dos siguen siendo las que fueron.
    referencia: referencia(args.uuid, fecha),
    fecha: fmt(fecha),
    validoHasta: fmt(venceFinal),
    validoHastaIso: iso(venceFinal),
    empresa: e.empresa ?? args.empresa,
    resumen: e.resumen ?? args.alcance.resumen_ejecutivo,
    contexto: e.contexto ?? args.alcance.contexto,
    objetivos: e.objetivos ?? args.alcance.objetivos,
    // Aquí se caen las horas. Es la línea que no se puede tocar. La versión
    // editada tampoco puede reintroducirlas: `edicionSchema` no tiene ese
    // campo, así que un bloque modificado solo lleva título y descripción.
    incluido:
      e.incluido ??
      args.alcance.alcance_incluido.map(({ bloque, descripcion }) => ({
        bloque,
        descripcion,
      })),
    excluido: e.excluido ?? args.alcance.alcance_excluido,
    entregables: e.entregables ?? args.alcance.entregables,
    plazoSemanas: e.plazoSemanas ?? args.alcance.plazo_estimado_semanas,
    // El precio efectivo lo resuelve quien llama (`precio_editado` manda sobre
    // `precio_presentado`), para que la regla viva en un solo sitio.
    precio: args.precio,
    hitos: e.hitos ?? formaDePago(args.ruta),
    supuestos: e.supuestos ?? args.alcance.supuestos,
    notas,
    // `riesgos` y `avisos` NO se incluyen: la sección 7.6 dice que al cliente
    // solo van los riesgos que le afectan, y esa criba la hace Jacob al
    // validar, no un filtro automático que no sabe distinguirlos.
  };
}