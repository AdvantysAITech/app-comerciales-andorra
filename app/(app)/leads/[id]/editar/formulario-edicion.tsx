"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FUENTES,
  IDIOMAS,
  SECTORES,
  EMPLEADOS,
  FACTURACION,
  PROCESOS,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
  ETIQUETA_PROCESO,
  type Proceso,
} from "@/lib/domain/lead";
import {
  PREGUNTAS_BANT,
  CLASIFICACION,
  calcularBant,
  type CriterioBant,
  type RespuestasBant,
} from "@/lib/domain/bant";

const BLOQUES = ["Budget", "Authority", "Need", "Timeline"] as const;

export type LeadEditable = {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo: string;
  ciudadPais: string;
  web: string;
  fuente: string;
  idioma: string;
  sector: string;
  empleados: string;
  facturacion: string;
  herramientas: string;
  notas: string;
  procesos: Proceso[];
  bant: RespuestasBant;
  /** Solo para mostrar. No se puede cambiar: determina el pipeline. */
  clasificacion: string;
  tieneDocumento: boolean;
  /** RUTA 7: sin BANT y sin procesos críticos. */
  esInversor: boolean;
  /** false para inversores y para sector educativo. */
  muestraProcesos: boolean;
};

export default function FormularioEdicion({ lead }: { lead: LeadEditable }) {
  const router = useRouter();

  const [campos, setCampos] = useState(lead);
  const [bant, setBant] = useState<RespuestasBant>(lead.bant ?? {});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [estado, setEstado] = useState<"listo" | "guardando" | "borrando">("listo");
  const [confirmando, setConfirmando] = useState(false);

  const resultado = calcularBant(bant);
  const conProcesos = lead.muestraProcesos && !lead.esInversor;
  const set = (k: keyof LeadEditable) => (v: string) => setCampos((c) => ({ ...c, [k]: v }));

  async function guardar() {
    setEstado("guardando");
    setErrores({});
    setErrorGeneral(null);
    setAviso(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: campos.nombre,
          email: campos.email,
          telefono: campos.telefono,
          empresa: campos.empresa,
          cargo: campos.cargo || undefined,
          ciudadPais: campos.ciudadPais,
          web: campos.web || undefined,
          fuente: campos.fuente,
          idioma: campos.idioma,
          sector: campos.sector,
          empleados: campos.empleados,
          facturacion: campos.facturacion,
          herramientas: campos.herramientas || undefined,
          notas: campos.notas || undefined,
          // Lo que no se muestra tampoco se manda: si un lead se reclasificó
          // o cambió de sector, esto lo deja limpio en el CRM.
          procesos: conProcesos ? campos.procesos : [],
          bant: lead.esInversor ? {} : bant,
        }),
      });

      const crudo = await res.text();
      let data: { error?: string; errores?: Record<string, string>; parcial?: boolean } | null =
        null;
      try {
        data = JSON.parse(crudo);
      } catch {
        data = null;
      }

      if (res.status === 422) {
        setErrores(data?.errores ?? {});
        setErrorGeneral("Revisa los campos marcados.");
        return;
      }

      if (!res.ok) {
        setErrorGeneral(data?.error ?? `El servidor respondió ${res.status}.`);
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setErrorGeneral("No hay conexión con el servidor. El cambio no se ha guardado.");
    } finally {
      setEstado("listo");
    }
  }

  async function borrar() {
    setEstado("borrando");
    setErrorGeneral(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });

      const crudo = await res.text();
      let data: {
        error?: string;
        contacto?: boolean;
        motivoContacto?: string;
      } | null = null;
      try {
        data = JSON.parse(crudo);
      } catch {
        data = null;
      }

      if (!res.ok) {
        setErrorGeneral(data?.error ?? `El servidor respondió ${res.status}.`);
        setConfirmando(false);
        return;
      }

      // El contacto puede haber sobrevivido a propósito. Se dice, en vez de
      // dejar creer que ha desaparecido todo del CRM.
      if (data?.contacto === false && data.motivoContacto) {
        setAviso(`Lead borrado. El contacto sigue en el CRM: ${data.motivoContacto}`);
        setTimeout(() => {
          router.push("/leads");
          router.refresh();
        }, 3500);
        return;
      }

      router.push("/leads");
      router.refresh();
    } catch {
      setErrorGeneral("No hay conexión con el servidor. No se ha borrado nada.");
      setConfirmando(false);
    } finally {
      setEstado("listo");
    }
  }

  const ocupado = estado !== "listo";

  return (
    <div className="space-y-10">
      {/* ---------- Clasificación, solo lectura ---------- */}
      <div className="panel p-5">
        <p className="traza">Clasificación</p>
        <p className="mt-1.5 text-sm">{lead.clasificacion}</p>
        <p className="mt-3 text-xs text-tinta-tenue">
          No se puede cambiar: define el pipeline de la oportunidad, y el Sistema
          Advantys no mueve oportunidades entre pipelines. Si está mal clasificado,
          borra el lead y vuelve a darlo de alta.
        </p>
      </div>

      {/* ---------- Contacto ---------- */}
      <div>
        <p className="traza mb-4">Datos de contacto</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo etiqueta="Nombre y apellidos" valor={campos.nombre} onCambio={set("nombre")} error={errores.nombre} />
          <Campo etiqueta="Empresa" valor={campos.empresa} onCambio={set("empresa")} error={errores.empresa} />
          <Campo etiqueta="Email" tipo="email" valor={campos.email} onCambio={set("email")} error={errores.email} />
          <Campo etiqueta="Teléfono" valor={campos.telefono} onCambio={set("telefono")} error={errores.telefono} />
          <Campo etiqueta="Cargo" valor={campos.cargo} onCambio={set("cargo")} error={errores.cargo} opcional />
          <Campo etiqueta="Ciudad y país" valor={campos.ciudadPais} onCambio={set("ciudadPais")} error={errores.ciudadPais} />
          <Campo etiqueta="Web" valor={campos.web} onCambio={set("web")} error={errores.web} opcional />
          <Campo etiqueta="Herramientas actuales" valor={campos.herramientas} onCambio={set("herramientas")} opcional />
        </div>
      </div>

      {/* ---------- Segmentación ---------- */}
      <div>
        <p className="traza mb-4">Segmentación</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Lista etiqueta="Fuente" valor={campos.fuente} onCambio={set("fuente")} opciones={FUENTES} etiquetas={ETIQUETA_FUENTE} />
          <Lista etiqueta="Idioma preferido" valor={campos.idioma} onCambio={set("idioma")} opciones={IDIOMAS} etiquetas={ETIQUETA_IDIOMA} />
          <Lista etiqueta="Sector" valor={campos.sector} onCambio={set("sector")} opciones={SECTORES} etiquetas={ETIQUETA_SECTOR} />
          <Lista etiqueta="Empleados" valor={campos.empleados} onCambio={set("empleados")} opciones={EMPLEADOS} etiquetas={ETIQUETA_EMPLEADOS} />
          <Lista etiqueta="Facturación" valor={campos.facturacion} onCambio={set("facturacion")} opciones={FACTURACION} etiquetas={ETIQUETA_FACTURACION} />
        </div>

        {conProcesos && (
        <div className="mt-5">
          <p className="etiqueta">Procesos críticos</p>
          <div className="flex flex-wrap gap-2">
            {PROCESOS.map((p) => (
              <button
                key={p}
                type="button"
                className="boton-fantasma"
                data-activo={campos.procesos.includes(p)}
                onClick={() =>
                  setCampos((c) => ({
                    ...c,
                    procesos: c.procesos.includes(p)
                      ? c.procesos.filter((x) => x !== p)
                      : [...c.procesos, p],
                  }))
                }
              >
                {ETIQUETA_PROCESO[p]}
              </button>
            ))}
          </div>
        </div>
        )}

        <div className="mt-5">
          <label className="etiqueta" htmlFor="notas">
            Observaciones <span className="text-tinta-tenue">(opcional)</span>
          </label>
          <textarea
            id="notas"
            className="campo"
            rows={3}
            value={campos.notas}
            onChange={(e) => setCampos((c) => ({ ...c, notas: e.target.value }))}
          />
        </div>
      </div>

      {/* ---------- BANT ---------- */}
      {/* Un inversor no se cualifica: aporta capital, no compra. El bloque
          entero desaparece y el PATCH manda el BANT vacío. */}
      {!lead.esInversor && (
      <div>
        <p className="traza mb-4">Cualificación BANT</p>
        <div className="space-y-7">
          {BLOQUES.map((bloque) => (
            <div key={bloque}>
              <p className="traza mb-3">{bloque}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                {PREGUNTAS_BANT.filter((p) => p.bloque === bloque).map((p) => (
                  <div key={p.id}>
                    <label className="etiqueta" htmlFor={`bant-${p.id}`}>
                      {p.etiqueta}
                    </label>
                    <select
                      id={`bant-${p.id}`}
                      className="campo"
                      value={bant[p.id] ?? ""}
                      onChange={(e) =>
                        setBant((b) => {
                          const s = { ...b };
                          if (e.target.value) s[p.id as CriterioBant] = e.target.value;
                          else delete s[p.id as CriterioBant];
                          return s;
                        })
                      }
                    >
                      <option value="">Sin dato</option>
                      {p.opciones.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiquetaGhl}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {resultado.respondidas > 0 && (
          <div className="mt-8 border-l-2 border-accent bg-accent-soft px-5 py-4">
            <div className="flex items-baseline gap-3">
              <p className="text-3xl font-semibold tabular-nums leading-none">
                {resultado.total.toLocaleString("es-ES")}
              </p>
              <p className="traza">
                de 10 · {CLASIFICACION[resultado.clasificacion].tag}
              </p>
            </div>
          </div>
        )}
      </div>
      )}

      {lead.esInversor && (
        <p className="border-l-2 border-accent bg-accent-soft px-5 py-4 text-sm">
          Oportunidad de inversión: no se cualifica con BANT ni se le genera
          propuesta. La información de inversión la envía el Sistema Advantys.
        </p>
      )}

      {errorGeneral && <p className="error">{errorGeneral}</p>}
      {aviso && (
        <p className="border-l-2 border-accent bg-accent-soft px-5 py-4 text-sm">{aviso}</p>
      )}

      {/* ---------- Acciones ---------- */}
      <div className="flex flex-wrap gap-3 border-t border-line pt-6">
        <button className="boton" onClick={guardar} disabled={ocupado}>
          {estado === "guardando" ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          className="boton-fantasma"
          onClick={() => router.push("/leads")}
          disabled={ocupado}
        >
          Cancelar
        </button>
      </div>

      {/* ---------- Borrado ---------- */}
      <div className="border border-block p-5">
        <p className="traza text-block">Borrar el lead</p>

        {confirmando ? (
          <>
            <p className="mt-3 text-sm">
              Se borra de la app y del Sistema Advantys, junto con su oportunidad
              {lead.tieneDocumento && " y la propuesta que se generó"}. No se puede
              deshacer.
            </p>
            <p className="mt-2 text-xs text-tinta-tenue">
              El contacto solo se borra si lo creó esta app y no le queda ninguna
              otra oportunidad en el CRM.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="boton" onClick={borrar} disabled={ocupado}>
                {estado === "borrando" ? "Borrando…" : "Sí, borrar definitivamente"}
              </button>
              <button
                className="boton-fantasma"
                onClick={() => setConfirmando(false)}
                disabled={ocupado}
              >
                No, dejarlo
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm text-tinta-media">
              Elimina el lead de la app y su oportunidad del Sistema Advantys.
            </p>
            <button
              className="boton-fantasma mt-4"
              onClick={() => setConfirmando(true)}
              disabled={ocupado}
            >
              Borrar lead
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Campo({
  etiqueta,
  valor,
  onCambio,
  error,
  tipo = "text",
  opcional,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  error?: string;
  tipo?: string;
  opcional?: boolean;
}) {
  const id = `c-${etiqueta.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>
        {etiqueta}
        {opcional && <span className="text-tinta-tenue"> (opcional)</span>}
      </label>
      <input
        id={id}
        className="campo"
        type={tipo}
        value={valor}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => onCambio(e.target.value)}
      />
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Lista({
  etiqueta,
  valor,
  onCambio,
  opciones,
  etiquetas,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  opciones: readonly string[];
  etiquetas: Record<string, string>;
}) {
  const id = `l-${etiqueta.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <select id={id} className="campo" value={valor} onChange={(e) => onCambio(e.target.value)}>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {etiquetas[o] ?? o}
          </option>
        ))}
      </select>
    </div>
  );
}