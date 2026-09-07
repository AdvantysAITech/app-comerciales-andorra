import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { construirDocumentoCliente } from "@/lib/documentos/cliente";
import { DocumentoPdf } from "@/lib/documentos/pdf";
import { cargarPiezas } from "@/lib/documentos/estaticos";
import { ensamblarDocumento } from "@/lib/documentos/ensamblar";
import type { Alcance } from "@/lib/ia/salida";
import type { Ruta } from "@/lib/domain/rutas";
import type { EdicionDocumento } from "@/lib/documentos/edicion";

/**
 * Ensamblado del PDF, extraído de la ruta de descarga.
 *
 * Vivía dentro de `GET /api/documentos/[id]/pdf`, y eso lo hacía inalcanzable
 * desde cualquier sitio que no estuviera sirviendo esa petición concreta. La
 * generación necesita los mismos bytes sin que nadie los haya pedido: para
 * guardarlos en Storage y para subirlos al CRM.
 *
 * `baseUrl` es obligatorio y no tiene valor por defecto a propósito: el logo se
 * lee por HTTP desde la propia app —los ficheros de /public no siempre están en
 * el sistema de archivos de una función serverless, pero la CDN siempre los
 * sirve— y una URL relativa aquí produce un PDF sin logo que nadie mira hasta
 * que ya está en manos del cliente.
 */
export async function renderizarPdf(args: {
  alcance: Alcance;
  ruta: Ruta;
  uuid: string;
  empresa: string;
  precio: number | null;
  /** Modificaciones hechas a mano sobre la propuesta, si las hay. Sin esto el
   *  PDF saldría con el texto original mientras la pantalla muestra el
   *  editado, que es justo lo que no puede pasar. */
  edicion?: EdicionDocumento | null;
  /** URL absoluta de la app. En una ruta, `request.url` vale. */
  baseUrl: string;
}): Promise<{ pdf: Uint8Array; nombreArchivo: string; referencia: string }> {
  const documento = construirDocumentoCliente({
    alcance: args.alcance,
    ruta: args.ruta,
    uuid: args.uuid,
    empresa: args.empresa,
    precio: args.precio,
    edicion: args.edicion,
  });

  const logo = new URL("/logo-advantys.png", args.baseUrl).toString();

  // El cuerpo y las piezas se preparan a la vez: son independientes entre sí.
  const [cuerpo, piezas] = await Promise.all([
    renderToBuffer(<DocumentoPdf doc={documento} logo={logo} />),
    cargarPiezas(),
  ]);

  const pdf = await ensamblarDocumento({
    cuerpo: new Uint8Array(cuerpo),
    piezas,
    marca: {
      empresa: documento.empresa,
      referencia: documento.referencia,
      fecha: documento.fecha,
    },
  });

  return {
    pdf: new Uint8Array(pdf),
    nombreArchivo: nombreDeArchivo(documento.empresa, documento.referencia),
    referencia: documento.referencia,
  };
}

/** Sin acentos ni espacios: viaja en cabeceras HTTP y en rutas de Storage. */
export function nombreDeArchivo(empresa: string, referencia: string): string {
  const limpio = empresa
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `Propuesta-Advantys-${limpio}-${referencia}.pdf`;
}