/**
 * Ensamblado del PDF definitivo del documento de cliente.
 *
 * `DocumentoPdf` (react-pdf) solo dibuja el cuerpo: el alcance, los bloques,
 * la inversión y los supuestos. Las piezas de marca —portada, condiciones
 * generales y tapa— son PDF cerrados diseñados fuera y no se reconstruyen
 * aquí: se concatenan tal cual, para que el documento que firma el cliente
 * sea idéntico al que aprobó diseño.
 *
 * Orden final:
 *   1  Portada (con el cliente, la referencia y la fecha sobreimpresos)
 *   2..n  Cuerpo generado
 *   n+1  Condiciones generales (1 de 2)
 *   n+2  Condiciones generales (2 de 2)
 *   n+3  Tapa
 */
import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage, RGB } from "pdf-lib";
import type { Pieza } from "./estaticos";

const TINTA = rgb(0.16, 0.19, 0.24);
const SUAVE = rgb(0.42, 0.45, 0.5);
const ACENTO = rgb(0.78, 0.33, 0.24);

/**
 * Las fuentes estándar del PDF se codifican en WinAnsi, que cubre los acentos
 * del español y del català pero no todo Unicode. Un nombre de empresa con un
 * carácter raro no puede tumbar la descarga: se limpia antes de dibujar.
 */
function winAnsi(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "");
}

/**
 * `drawText` de pdf-lib no tiene opción de tracking, así que el espaciado del
 * rótulo se dibuja letra a letra avanzando la x a mano.
 */
function dibujarEspaciado(
  pagina: PDFPage,
  texto: string,
  { x, y, size, font, color, espacio }: {
    x: number; y: number; size: number; font: PDFFont; color: RGB; espacio: number;
  },
) {
  let cursor = x;
  for (const letra of texto) {
    pagina.drawText(letra, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(letra, size) + espacio;
  }
}

export type Marca = {
  empresa: string;
  referencia: string;
  fecha: string;
};

export async function ensamblarDocumento({
  cuerpo,
  piezas,
  marca,
}: {
  cuerpo: Uint8Array;
  piezas: Record<Pieza, Uint8Array>;
  marca: Marca;
}): Promise<Uint8Array> {
  const salida = await PDFDocument.create();

  salida.setTitle(`Propuesta Advantys · ${marca.empresa}`);
  salida.setAuthor("Advantys AI SL");
  salida.setSubject(marca.referencia);
  salida.setProducer("Advantys AI SL");
  salida.setCreationDate(new Date());

  async function anexar(bytes: Uint8Array) {
    const origen = await PDFDocument.load(bytes);
    const paginas = await salida.copyPages(origen, origen.getPageIndices());
    paginas.forEach((pagina) => salida.addPage(pagina));
    return paginas;
  }

  const [portada] = await anexar(piezas.portada);
  await sellarPortada(salida, portada, marca);

  await anexar(cuerpo);
  await anexar(piezas.condiciones1);
  await anexar(piezas.condiciones2);
  await anexar(piezas.tapa);

  return salida.save();
}

/**
 * Sobreimprime el cliente sobre la portada, en el hueco blanco que queda
 * justo encima de la palabra «Propuesta». Las coordenadas van en puntos desde
 * la esquina inferior izquierda, sobre una página de 595,5 × 842,25 pt.
 *
 * Si algo falla aquí, se devuelve la portada limpia: es preferible una
 * propuesta sin el nombre del cliente a una descarga rota.
 */
async function sellarPortada(
  salida: PDFDocument,
  portada: PDFPage,
  marca: Marca,
) {
  try {
    const negrita = await salida.embedFont(StandardFonts.HelveticaBold);
    const normal = await salida.embedFont(StandardFonts.Helvetica);

    dibujarEspaciado(portada, "PREPARADA PARA", {
      x: 40, y: 322, size: 8, font: negrita, color: ACENTO, espacio: 1.6,
    });

    // El nombre se encoge si es largo, para no invadir el rostro de la imagen.
    const empresa = winAnsi(marca.empresa);
    const ancho = 300;
    let cuerpo = 18;
    while (cuerpo > 11 && negrita.widthOfTextAtSize(empresa, cuerpo) > ancho) cuerpo -= 0.5;

    portada.drawText(empresa, { x: 40, y: 296, size: cuerpo, font: negrita, color: TINTA });

    portada.drawText(winAnsi(`${marca.referencia}  ·  ${marca.fecha}`), {
      x: 40, y: 278, size: 9.5, font: normal, color: SUAVE,
    });
  } catch (error) {
    console.error("No se ha podido sellar la portada", error);
  }
}