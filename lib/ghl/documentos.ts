import "server-only";
import { randomUUID } from "node:crypto";
import { ghl, ghlSubida, locationId } from "./client";
import { CAMPO_OPORTUNIDAD } from "./ids";

type RespuestaSubida = {
  uploadedFiles?: Record<string, string>;
  meta?: { originalname?: string; mimetype?: string; size?: number; url?: string }[];
};

/**
 * Forma exacta con la que GHL guarda un campo FILE_UPLOAD.
 *
 * No está documentada. Se obtuvo subiendo un PDF a mano desde el CRM y leyendo
 * la oportunidad con `scripts/ghl-leer-oportunidad.mjs`. Si alguna vez deja de
 * funcionar, ese es el camino para volver a averiguarla: subir a mano y leer.
 */
type ArchivoGhl = {
  url: string;
  meta: { mimetype: string; name: string; size: number };
  deleted: boolean;
};

/**
 * Adjunta un PDF al campo «Documentacion» de una oportunidad.
 *
 * Son DOS llamadas, y esa es la parte que no se ve venir:
 *
 *  1. `POST /locations/:id/customFields/upload` deja el archivo en el
 *     almacenamiento privado de GHL y devuelve su URL. NO toca la oportunidad:
 *     responde `uploadedFiles`, no el registro actualizado. Con solo este paso
 *     el archivo existe pero el campo se queda vacío.
 *  2. `PUT /opportunities/:id` apunta el campo a esa URL.
 *
 * El paso 2 REEMPLAZA lo que hubiera. Para el presupuesto vale: hay uno por
 * lead. Si algún día cuelgan varios documentos del mismo campo, habría que
 * leer los existentes y concatenar en vez de sobrescribir.
 */
export async function adjuntarDocumentoOportunidad(args: {
  oportunidadId: string;
  pdf: Uint8Array;
  nombreArchivo: string;
}): Promise<{ url: string }> {
  const campoId = CAMPO_OPORTUNIDAD.documentacion;
  if (!campoId) {
    throw new Error("CAMPO_OPORTUNIDAD.documentacion está vacío en lib/ghl/ids.ts");
  }

  /* --- 1. Subir el archivo ----------------------------------------- */

  const form = new FormData();
  form.append("id", args.oportunidadId);
  form.append("maxFiles", "1");

  // Se copia a un ArrayBuffer propio antes de construir el Blob: el Uint8Array
  // que devuelve pdf-lib puede apoyarse en un buffer compartido, y desde TS 5.7
  // eso ya no encaja en BlobPart.
  const copia = new Uint8Array(args.pdf.byteLength);
  copia.set(args.pdf);

  form.append(
    `${campoId}_${randomUUID()}`,
    new Blob([copia], { type: "application/pdf" }),
    args.nombreArchivo,
  );

  const subida = await ghlSubida<RespuestaSubida>(
    `/locations/${locationId()}/customFields/upload`,
    form,
  );

  const url = subida.meta?.[0]?.url ?? Object.values(subida.uploadedFiles ?? {})[0];
  if (!url) {
    throw new Error("GHL aceptó la subida pero no devolvió la URL del archivo");
  }

  /* --- 2. Apuntar el campo al archivo ------------------------------- */

  const archivo: ArchivoGhl = {
    url,
    meta: {
      mimetype: "application/pdf",
      name: args.nombreArchivo,
      size: args.pdf.byteLength,
    },
    deleted: false,
  };

  await ghl(`/opportunities/${args.oportunidadId}`, {
    method: "PUT",
    body: {
      customFields: [{ id: campoId, field_value: [archivo] }],
    },
  });

  return { url };
}