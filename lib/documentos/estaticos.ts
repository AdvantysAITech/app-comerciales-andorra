import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

const CARPETA = path.join(process.cwd(), "assets", "plantillas");

export const PIEZAS = {
  portada: "portada.pdf",
  condiciones1: "condiciones-generales-1.pdf",
  condiciones2: "condiciones-generales-2.pdf",
  tapa: "tapa.pdf",
} as const;

export type Pieza = keyof typeof PIEZAS;

const cache = new Map<string, Uint8Array>();

async function leer(fichero: string): Promise<Uint8Array> {
  const previo = cache.get(fichero);
  if (previo) return previo;

  const ruta = path.join(CARPETA, fichero);

  let contenido: Buffer;
  try {
    contenido = await readFile(ruta);
  } catch {
    throw new Error(
      `Falta la pieza ${fichero} en assets/plantillas. ` +
        "Si el error solo aparece en producción, revisa outputFileTracingIncludes en next.config.ts.",
    );
  }

  const bytes = new Uint8Array(contenido);

  const cabecera = String.fromCharCode(...bytes.slice(0, 5));
  if (cabecera !== "%PDF-") {
    throw new Error(`La pieza ${fichero} no es un PDF válido (empieza por «${cabecera}»).`);
  }

  cache.set(fichero, bytes);
  return bytes;
}

export async function cargarPiezas(): Promise<Record<Pieza, Uint8Array>> {
  const nombres = Object.keys(PIEZAS) as Pieza[];
  const bytes = await Promise.all(nombres.map((nombre) => leer(PIEZAS[nombre])));

  return Object.fromEntries(
    nombres.map((nombre, i) => [nombre, bytes[i]]),
  ) as Record<Pieza, Uint8Array>;
}