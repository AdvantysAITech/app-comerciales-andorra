"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { DocumentoCliente } from "@/lib/documentos/cliente";
import type { EstadoCrm } from "@/lib/documentos/edicion";
import Plantilla from "./plantilla";
import FormularioEdicion from "./formulario-edicion";

const ZONA = "Europe/Andorra";

function fechaLarga(iso: string) {
  return new Date(iso).toLocaleString("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: ZONA,
  });
}

/**
 * Barra de acciones del documento y conmutador entre ver y editar.
 *
 * Dos botones, y ninguno miente sobre lo que hace:
 *
 *   - «Descargar PDF» descarga. NO envía al CRM: la subida ocurre al generar
 *     el documento y al guardar una edición, no al descargarlo.
 *   - «Modificar propuesta» abre la edición, y allí el botón de guardar sí
 *     dice explícitamente que actualiza el CRM, porque es lo que hace.
 *
 * Para que el comercial sepa si el documento ha llegado a GHL está el
 * indicador de estado, que lee `ghl_subido_en` y `ghl_error`. Esos dos datos
 * ya se guardaban desde el principio y no se enseñaban en ninguna pantalla.
 */
export default function Acciones({
  id,
  doc,
  precioCalculado,
  puedeEditar,
  validado,
  editadoEn,
  ediciones,
  crm: crmInicial,
}: {
  id: string;
  doc: DocumentoCliente;
  precioCalculado: number | null;
  puedeEditar: boolean;
  validado: boolean;
  editadoEn: string | null;
  ediciones: number;
  crm: EstadoCrm;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [crm, setCrm] = useState<EstadoCrm>(crmInicial);
  const [reintentando, setReintentando] = useState(false);

  async function reintentarCrm() {
    setReintentando(true);
    try {
      const res = await fetch(`/api/documentos/${id}/crm`, { method: "POST" });
      const datos = await res.json();
      if (datos.crm) setCrm(datos.crm);
      else setCrm({ subidoEn: null, error: datos.error ?? "No se pudo actualizar el CRM." });
      router.refresh();
    } catch {
      setCrm({ subidoEn: null, error: "No se pudo contactar con el servidor." });
    } finally {
      setReintentando(false);
    }
  }

  if (editando) {
    return (
      <FormularioEdicion
        id={id}
        doc={doc}
        precioCalculado={precioCalculado}
        onCancelar={() => setEditando(false)}
        onGuardado={(nuevoCrm) => {
          setCrm(nuevoCrm);
          setEditando(false);
          // El servidor vuelve a construir el documento con la edición ya
          // guardada. Sin esto la pantalla seguiría mostrando el texto viejo
          // hasta que alguien recargara a mano.
          router.refresh();
        }}
      />
    );
  }

  return (
    <>
      <div className="no-imprimir mx-auto flex max-w-[19cm] flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div>
          <p className="traza">
            {doc.referencia}
            {!validado && <span className="text-block"> · pendiente de validación</span>}
            {ediciones > 0 && editadoEn && (
              <span className="text-tinta-media">
                {" "}
                · modificada el {fechaLarga(editadoEn)}
              </span>
            )}
          </p>

          {/* Estado del CRM. Es la respuesta a «¿ha llegado esto a GHL?», que
              hasta ahora solo se podía contestar entrando en GoHighLevel. */}
          <p className="traza mt-1" data-error={crm.error ? "true" : undefined}>
            {crm.error
              ? crm.error
              : crm.subidoEn
                ? `Enviado al CRM el ${fechaLarga(crm.subidoEn)}`
                : "Todavía sin enviar al CRM"}
            {(crm.error || !crm.subidoEn) && puedeEditar && (
              <>
                {" · "}
                <button
                  type="button"
                  onClick={reintentarCrm}
                  disabled={reintentando}
                  className="underline underline-offset-2 disabled:opacity-50"
                >
                  {reintentando ? "Enviando…" : "Reintentar"}
                </button>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {puedeEditar && (
            <button
              type="button"
              className="boton-fantasma"
              onClick={() => setEditando(true)}
            >
              Modificar propuesta
            </button>
          )}
          <a
            className="boton"
            href={`/api/documentos/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Descargar PDF
          </a>
        </div>
      </div>

      {!validado && (
        <div className="no-imprimir mx-auto max-w-[19cm] px-6 pb-4">
          <p className="border-l-2 border-block bg-elevado px-4 py-3 text-sm">
            Esta propuesta todavía no la ha revisado Jacob. Puedes descargarla, pero
            repásala antes de enviársela al cliente.
          </p>
        </div>
      )}

      <Plantilla doc={doc} />
    </>
  );
}
