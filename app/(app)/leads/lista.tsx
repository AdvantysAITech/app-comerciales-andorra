"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import GenerarDocumento from "./generar-documento";

export type FilaLead = {
  id: string;
  nombre: string;
  empresa: string;
  /** Ya formateados en el servidor: evita desajuste de hidratación y fija la
   *  zona horaria del negocio en vez de la del teléfono del comercial. */
  fechaCorta: string;
  fechaLarga: string;
  comercialEmail: string | null;
  clasificacion: string;
  contactoExistia: boolean;
  resultado: "en_curso" | "creado" | "bloqueado_wf16" | "error";
  detalle: string | null;
  bantTexto: string | null;
  enlaceContacto: string | null;
  enlaceOportunidad: string | null;
  /** Id del documento ya generado, si lo hay. Null = todavía no tiene. */
  documentoId: string | null;
  /** RUTA 7. Un inversor no lleva propuesta: no se le ofrece generarla. */
  esInversor: boolean;
};

type Estado = { etiqueta: string; bloqueo: boolean };

const ESTADO: Record<FilaLead["resultado"], Estado> = {
  en_curso: { etiqueta: "Sin confirmar", bloqueo: true },
  creado: { etiqueta: "Registrado", bloqueo: false },
  bloqueado_wf16: { etiqueta: "Bloqueado", bloqueo: true },
  error: { etiqueta: "No guardado", bloqueo: true },
};

function estadoDe(resultado: string): Estado {
  return (
    ESTADO[resultado as FilaLead["resultado"]] ?? { etiqueta: resultado, bloqueo: true }
  );
}

export default function ListaLeads({
  leads,
  puedeDocumentos,
}: {
  leads: FilaLead[];
  /** Sin el módulo de documentos concedido, la propuesta no se ofrece. */
  puedeDocumentos: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<FilaLead | null>(null);

  /** Id del lead en el que se ha pulsado Borrar y está esperando confirmación.
   *  La confirmación vive en la propia fila: un diálogo aparte para algo tan
   *  frecuente acaba confirmándose sin leerlo. */
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Escape para cerrar y bloqueo del scroll de fondo: sin esto, en móvil el
  // listado se desplaza por debajo del panel mientras lo lees.
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(null);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alPulsar);
    };
  }, [abierto]);

  async function borrar(lead: FilaLead) {
    setBorrando(lead.id);
    setError(null);
    setAviso(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });

      const crudo = await res.text();
      let data: { error?: string; contacto?: boolean; motivoContacto?: string } | null = null;
      try {
        data = JSON.parse(crudo);
      } catch {
        data = null;
      }

      if (!res.ok) {
        setError(data?.error ?? `El servidor respondió ${res.status}.`);
        return;
      }

      // El contacto puede haber sobrevivido a propósito. Se dice, en vez de
      // dejar creer que ha desaparecido todo del CRM.
      if (data?.contacto === false && data.motivoContacto) {
        setAviso(`Lead borrado. El contacto sigue en el CRM: ${data.motivoContacto}`);
      }

      setConfirmando(null);
      router.refresh();
    } catch {
      setError("No hay conexión con el servidor. No se ha borrado nada.");
    } finally {
      setBorrando(null);
    }
  }

  return (
    <>
      {error && <p className="error mb-4">{error}</p>}
      {aviso && (
        <p className="mb-4 border-l-2 border-accent bg-accent-soft px-5 py-4 text-sm">{aviso}</p>
      )}

      <ul className="divide-y divide-line border border-line bg-surface">
        {leads.map((lead) => {
          const estado = estadoDe(lead.resultado);
          const enConfirmacion = confirmando === lead.id;

          return (
            <li key={lead.id} className="flex flex-wrap items-center gap-y-2">
              {/* El área principal abre la ficha. Va en su propio botón y no
                  envolviendo a los demás: un botón dentro de otro botón es
                  HTML inválido y en móvil se dispara el que no toca. */}
              <button
                type="button"
                onClick={() => setAbierto(lead)}
                // min-h-14: objetivo táctil cómodo en móvil, no una fila de 32px.
                className="flex min-h-14 flex-1 items-baseline justify-between gap-4 px-4 py-3 text-left hover:bg-elevado"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {lead.nombre}
                    <span className="text-tinta-media"> · {lead.empresa}</span>
                  </span>
                  <span className="traza mt-0.5 block truncate normal-case">
                    {lead.clasificacion}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {estado.bloqueo && (
                    <span className="traza block text-block">{estado.etiqueta}</span>
                  )}
                  <span className="traza block">{lead.fechaCorta}</span>
                </span>
              </button>

              <div className="flex shrink-0 items-center gap-2 px-4 py-2">
                {enConfirmacion ? (
                  <>
                    <span className="traza normal-case text-block">¿Seguro?</span>
                    <button
                      type="button"
                      className="boton-fantasma !border-block !text-block"
                      onClick={() => borrar(lead)}
                      disabled={borrando === lead.id}
                    >
                      {borrando === lead.id ? "Borrando…" : "Sí, borrar"}
                    </button>
                    <button
                      type="button"
                      className="boton-fantasma"
                      onClick={() => setConfirmando(null)}
                      disabled={borrando === lead.id}
                    >
                      No
                    </button>
                  </>
                ) : (
                  <>
                    {lead.resultado === "creado" && (
                      <Link
                        href={`/leads/${lead.id}/editar`}
                        className="boton-fantasma"
                        aria-label={`Editar ${lead.nombre}`}
                      >
                        Editar
                      </Link>
                    )}
                    <button
                      type="button"
                      className="boton-fantasma !border-block !text-block"
                      onClick={() => {
                        setError(null);
                        setAviso(null);
                        setConfirmando(lead.id);
                      }}
                      aria-label={`Borrar ${lead.nombre}`}
                    >
                      Borrar
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {abierto && (
        <Ficha
          lead={abierto}
          puedeDocumentos={puedeDocumentos}
          cerrar={() => setAbierto(null)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

function Ficha({
  lead,
  puedeDocumentos,
  cerrar,
}: {
  lead: FilaLead;
  puedeDocumentos: boolean;
  cerrar: () => void;
}) {
  const estado = estadoDe(lead.resultado);

  // Solo un lead cerrado como 'creado' tiene alcance que documentar: el
  // endpoint rechaza el resto con un 409, así que no se ofrece el botón. Los
  // inversores también quedan fuera: reciben información de inversión, no
  // presupuesto, y el mismo endpoint los rechaza igual.
  const ofrecerPropuesta =
    puedeDocumentos && lead.resultado === "creado" && !lead.esInversor;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={cerrar}
    >
      {/* Hoja inferior en móvil, diálogo centrado a partir de sm. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${lead.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full overflow-y-auto border-t border-line bg-surface p-6 sm:max-w-md sm:border"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="traza">Registro de la plataforma</p>
            <h2 className="mt-1 truncate text-lg font-semibold">{lead.nombre}</h2>
            <p className="truncate text-sm text-tinta-media">{lead.empresa}</p>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="boton-fantasma shrink-0 !w-9 !px-0"
          >
            ✕
          </button>
        </div>

        <dl className="mt-6 space-y-4">
          <Dato titulo="Recogido por" valor={lead.comercialEmail ?? "—"} />
          <Dato titulo="Fecha y hora" valor={lead.fechaLarga} />
          <Dato titulo="Clasificación aplicada" valor={lead.clasificacion} />
          {lead.bantTexto && <Dato titulo="Cualificación BANT" valor={lead.bantTexto} />}
          <Dato
            titulo="Contacto"
            valor={lead.contactoExistia ? "Ya existía, se actualizó" : "Creado nuevo"}
          />
          <Dato titulo="Resultado" valor={estado.etiqueta} bloqueo={estado.bloqueo} />
          {ofrecerPropuesta && (
            <Dato
              titulo="Propuesta"
              valor={lead.documentoId ? "Generada" : "Todavía sin generar"}
            />
          )}
          {lead.esInversor && (
            <Dato titulo="Propuesta" valor="No aplica · oportunidad de inversión" />
          )}
        </dl>

        {lead.detalle && (
          <p className="mt-5 border-l-2 border-block bg-elevado px-4 py-3 text-sm">
            {lead.detalle}
          </p>
        )}

        {/* Editar y borrar NO están aquí: viven en la fila del listado, donde
            se ven sin abrir nada. Esta ficha es para consultar y para la
            propuesta. */}
        <div className="mt-7 flex flex-col gap-2">
          {ofrecerPropuesta && (
            <GenerarDocumento leadId={lead.id} documentoId={lead.documentoId} ancho />
          )}
          {lead.enlaceContacto ? (
            <a
              href={lead.enlaceContacto}
              target="_blank"
              rel="noreferrer"
              className="boton-fantasma w-full"
            >
              Abrir contacto en el Sistema Advantys
            </a>
          ) : null}
          {lead.enlaceOportunidad ? (
            <a
              href={lead.enlaceOportunidad}
              target="_blank"
              rel="noreferrer"
              className="boton-fantasma w-full"
            >
              Abrir oportunidad en el Sistema Advantys
            </a>
          ) : null}
          {!lead.enlaceContacto && !lead.enlaceOportunidad && (
            <p className="text-sm text-tinta-tenue">
              Este lead no llegó a crearse en el Sistema Advantys, así que no hay ficha que abrir.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, bloqueo }: { titulo: string; valor: string; bloqueo?: boolean }) {
  return (
    <div>
      <dt className="traza">{titulo}</dt>
      <dd className={`mt-1 text-sm ${bloqueo ? "text-block" : ""}`}>{valor}</dd>
    </div>
  );
}