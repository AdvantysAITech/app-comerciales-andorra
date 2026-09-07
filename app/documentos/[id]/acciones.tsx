"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
 *   - «Descargar PDF» descarga, y solo descarga.
 *   - «Modificar propuesta» abre la edición. Guardar regenera el PDF y crea
 *     una versión nueva; no manda nada a GoHighLevel.
 *
 * Desde el 07/09/2026 NADA de esta pantalla sube al CRM: eso lo hace validar,
 * y validar es de quien tenga alcance equipo o total. Lo que sí hay aquí es
 * el estado, que responde a las dos preguntas que antes obligaban a abrir
 * GoHighLevel: si esta versión está validada, y qué versión es la que tiene
 * ahora mismo la oportunidad.
 */
export default function Acciones({
  id,
  doc,
  precioCalculado,
  puedeEditar,
  volverA,
  validado,
  validadoAntes,
  versionActual,
  ghlVersion,
  editadoEn,
  ediciones,
  crm: crmInicial,
}: {
  id: string;
  doc: DocumentoCliente;
  precioCalculado: number | null;
  puedeEditar: boolean;
  /** Destino del enlace de vuelta. Lo decide el servidor según el alcance. */
  volverA: string;
  /** La versión que se está viendo está validada. */
  validado: boolean;
  /** Hubo validación, pero de una versión anterior a esta. */
  validadoAntes: boolean;
  versionActual: number;
  /** Versión que cuelga hoy de la oportunidad en GHL. Null = nunca subió nada. */
  ghlVersion: number | null;
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
        onGuardado={() => {
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
      <div className="no-imprimir mx-auto max-w-[19cm] px-6 pt-4">
        <Link href={volverA} className="traza hover:text-accent">
          ← Volver
        </Link>
      </div>

      <div className="no-imprimir mx-auto flex max-w-[19cm] flex-wrap items-center justify-between gap-3 px-6 pt-2 pb-4">
        <div>
          <p className="traza">
            {doc.referencia}
            {!validado && (
              <span className="text-block">
                {" "}
                · {validadoAntes ? "modificada tras validarse" : "pendiente de validación"}
              </span>
            )}
            {ediciones > 0 && editadoEn && (
              <span className="text-tinta-media">
                {" "}
                · v{versionActual}, modificada el {fechaLarga(editadoEn)}
              </span>
            )}
          </p>

          {/* Estado del CRM. Es la respuesta a «¿ha llegado esto a GHL?», que
              hasta ahora solo se podía contestar entrando en GoHighLevel. */}
          <p className="traza mt-1" data-error={crm.error ? "true" : undefined}>
            {crm.error
              ? crm.error
              : ghlVersion === null || !crm.subidoEn
                ? "Todavía sin enviar al CRM"
                : ghlVersion === versionActual
                  ? `Enviado al CRM el ${fechaLarga(crm.subidoEn)}`
                  : `En el CRM está la v${ghlVersion}; esto es la v${versionActual}`}
            {/* Reintentar solo tiene sentido sobre algo validado: es reenviar
                lo que ya se aprobó. Si la versión está sin validar, el botón
                sería una puerta trasera para colarla sin revisión. */}
            {validado && (crm.error || ghlVersion !== versionActual) && puedeEditar && (
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
            {validadoAntes
              ? `Has modificado la propuesta después de que se validara. Puedes ` +
                `descargar esta versión y seguir ajustándola, pero en el CRM sigue ` +
                `la anterior: para que suba la v${versionActual} hace falta validarla otra vez.`
              : "Esta propuesta todavía no está validada. Puedes descargarla y " +
                "modificarla, pero no se enviará al CRM hasta que alguien la revise."}
          </p>
        </div>
      )}

      <Plantilla doc={doc} />
    </>
  );
}