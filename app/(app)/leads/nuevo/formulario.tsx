"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FUENTES,
  IDIOMAS,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  type Fuente,
  type Idioma,
} from "@/lib/domain/lead";
import { LINEAS, ROLES_JV, ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";
import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";
import type { Spinoff } from "@/lib/ghl/spinoffs";
import Asistente from "./asistente";
import type { Sugerencia } from "@/lib/domain/lead";

type Campos = {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo: string;
  ciudadPais: string;
  web: string;
  fuente: Fuente | "";
  idioma: Idioma | "";
  valorEstimado: string;
  pain: string;
  notas: string;
};

const VACIO: Campos = {
  nombre: "", email: "", telefono: "", empresa: "", cargo: "", ciudadPais: "",
  web: "", fuente: "", idioma: "es", valorEstimado: "", pain: "", notas: "",
};

type Exito = { contactoId: string; oportunidadId: string; contactoExistia: boolean };

export default function FormularioLead({
  spinoffs,
  errorSpinoffs,
}: {
  spinoffs: Spinoff[];
  errorSpinoffs: string | null;
}) {
  const router = useRouter();

  const [campos, setCampos] = useState<Campos>(VACIO);
  const [linea, setLinea] = useState<LineaNegocio | null>(null);
  const [rolJV, setRolJV] = useState<RolJV | null>(null);
  const [spinoffId, setSpinoffId] = useState("");
  const [mostrarAsistente, setMostrarAsistente] = useState(false);
  const [sugerido, setSugerido] = useState(false);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [bloqueo, setBloqueo] = useState<{ mensaje: string; oportunidades: string[] } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);

  const set = (clave: keyof Campos) => (valor: string) => {
    setCampos((c) => ({ ...c, [clave]: valor }));
    setErrores((e) => {
      if (!e[clave]) return e;
      const { [clave]: _, ...resto } = e;
      return resto;
    });
  };

  /** Aviso temprano: ¿ya conocemos a este contacto? ¿arrastra conflicto WF-16? */
  async function comprobarContacto() {
    if (!campos.email && !campos.telefono) return;
    try {
      const params = new URLSearchParams();
      if (campos.email) params.set("email", campos.email);
      if (campos.telefono) params.set("telefono", campos.telefono);
      const res = await fetch(`/api/ghl/lookup?${params}`);
      const data = await res.json();

      if (!data.contacto) return setAviso(null);
      setAviso(
        data.conflictoAuditoria
          ? `${data.contacto.nombre} ya es cliente de Advantys en otra línea de negocio. No se le puede abrir una Auditoría ISO 42001.`
          : `Este contacto ya existe en GHL (${data.contacto.nombre}). Se actualizarán sus datos en vez de duplicarlo.`,
      );
    } catch {
      setAviso(null);
    }
  }

  async function guardar() {
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);
    setBloqueo(null);

    // CA-07a: sin línea de negocio no se envía nada al servidor.
    if (!linea) {
      setErrores({ linea: "Selecciona la línea de negocio" });
      setEnviando(false);
      return;
    }

    const esJV = linea === "jv_builder";
    const spinoff = spinoffs.find((s) => s.id === spinoffId);

    const payload = {
      ...campos,
      web: campos.web || undefined,
      cargo: campos.cargo || undefined,
      pain: campos.pain || undefined,
      notas: campos.notas || undefined,
      valorEstimado: campos.valorEstimado ? Number(campos.valorEstimado) : undefined,
      linea,
      ...(esJV
        ? { spinoffId, spinoffNombre: spinoff?.nombre ?? "", rolJV: rolJV ?? undefined }
        : {}),
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 422) {
        setErrores(data.errores ?? {});
        setErrorGeneral("Revisa los campos marcados.");
      } else if (res.status === 409) {
        setBloqueo({ mensaje: data.error, oportunidades: data.oportunidades ?? [] });
      } else if (!res.ok) {
        setErrorGeneral(data.error ?? "No se ha podido guardar el lead.");
      } else {
        setExito(data);
        router.refresh();
      }
    } catch {
      setErrorGeneral("No hay conexión con el servidor. El lead no se ha guardado.");
    } finally {
      setEnviando(false);
    }
  }

  function otroLead() {
    setCampos(VACIO);
    setLinea(null);
    setRolJV(null);
    setSpinoffId("");
    setExito(null);
    setAviso(null);
    setSugerido(false);
  }

  /* ---------------- Confirmación ---------------- */

  if (exito) {
    return (
      <div className="panel p-6">
        <p className="traza">Registrado en el Sistema Advantys</p>
        <p className="mt-3 text-lg font-medium">Lead dado de alta correctamente.</p>
        <p className="mt-2 text-sm text-muted">
          {exito.contactoExistia
            ? "El contacto ya existía en GHL y se han actualizado sus datos."
            : "Se ha creado el contacto en GHL."}{" "}
          La oportunidad está en la primera fase de su pipeline.
        </p>
        <div className="mt-6 flex gap-3">
          <button className="boton" onClick={otroLead}>Dar de alta otro</button>
          <Link href="/leads" className="boton-fantasma inline-block">Ver mis leads</Link>
        </div>
      </div>
    );
  }

  /* ---------------- Formulario ---------------- */

  return (
    <div className="space-y-8">
      {/* Datos del contacto */}
      <section className="panel p-6">
        <p className="traza mb-5">Datos del contacto</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre completo" valor={campos.nombre} onChange={set("nombre")} error={errores.nombre} />
          <Campo etiqueta="Empresa" valor={campos.empresa} onChange={set("empresa")} error={errores.empresa} />
          <Campo etiqueta="Email" tipo="email" valor={campos.email} onChange={set("email")} onBlur={comprobarContacto} error={errores.email} />
          <Campo etiqueta="Teléfono" valor={campos.telefono} onChange={set("telefono")} onBlur={comprobarContacto} error={errores.telefono} marcador="+376 ..." />
          <Campo etiqueta="Cargo (opcional)" valor={campos.cargo} onChange={set("cargo")} error={errores.cargo} />
          <Campo etiqueta="Ciudad y país" valor={campos.ciudadPais} onChange={set("ciudadPais")} error={errores.ciudadPais} />
          <Campo etiqueta="Web (opcional)" valor={campos.web} onChange={set("web")} error={errores.web} marcador="https://" />

          <div>
            <label className="etiqueta" htmlFor="fuente">Fuente de captación</label>
            <select id="fuente" className="campo" value={campos.fuente}
              aria-invalid={errores.fuente ? "true" : undefined}
              onChange={(e) => set("fuente")(e.target.value)}>
              <option value="">Selecciona…</option>
              {FUENTES.map((f) => <option key={f} value={f}>{ETIQUETA_FUENTE[f]}</option>)}
            </select>
            {errores.fuente && <p className="error">{errores.fuente}</p>}
          </div>

          <div>
            <label className="etiqueta" htmlFor="idioma">Idioma preferido</label>
            <select id="idioma" className="campo" value={campos.idioma}
              onChange={(e) => set("idioma")(e.target.value)}>
              {IDIOMAS.map((i) => <option key={i} value={i}>{ETIQUETA_IDIOMA[i]}</option>)}
            </select>
          </div>
        </div>

        {aviso && (
          <p className="mt-4 border border-line bg-accent-soft px-3 py-2 text-sm">{aviso}</p>
        )}
      </section>

      {/* Clasificación */}
      <section className="panel p-6">
        <p className="traza mb-1">Clasificación</p>
        <p className="mb-5 text-sm text-muted">
          Decide en qué pipeline entra el lead. GHL no reclasifica por su cuenta.
        </p>

        <div className="mb-4">
          <button
            type="button"
            className="traza underline hover:text-accent"
            onClick={() => setMostrarAsistente(true)}
          >
            ¿No lo tienes claro? Usa el asistente guiado
          </button>
        </div>

        {sugerido && (
          <p className="mb-3 text-sm text-muted">
            Clasificación sugerida por el asistente. Cámbiala si no encaja.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {LINEAS.map((l) => (
            <button key={l} type="button" className="boton-fantasma"
              data-activo={linea === l}
              onClick={() => {
                setLinea(l);
                setSugerido(false);
                setErrores((e) => ({ ...e, linea: "" }));
              }}>
              {ETIQUETA_LINEA[l]}
            </button>
          ))}
        </div>
        {errores.linea && <p className="error">{errores.linea}</p>}

        {linea === "jv_builder" && (
          <div className="mt-6 space-y-4 border-l-2 border-accent pl-5">
            <p className="traza">Campos obligatorios</p>

            {errorSpinoffs ? (
              <p className="error">{errorSpinoffs}</p>
            ) : (
              <div>
                <label className="etiqueta" htmlFor="spinoff">Spin-off</label>
                <select id="spinoff" className="campo" value={spinoffId}
                  aria-invalid={errores.spinoffId ? "true" : undefined}
                  onChange={(e) => setSpinoffId(e.target.value)}>
                  <option value="">Selecciona la spin-off…</option>
                  {spinoffs.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                {errores.spinoffId && <p className="error">{errores.spinoffId}</p>}
              </div>
            )}

            <div>
              <label className="etiqueta">Rol en la oportunidad</label>
              <div className="flex gap-2">
                {ROLES_JV.map((r) => (
                  <button key={r} type="button" className="boton-fantasma"
                    data-activo={rolJV === r} onClick={() => setRolJV(r)}>
                    {ETIQUETA_ROL[r]}
                  </button>
                ))}
              </div>
              {errores.rolJV && <p className="error">{errores.rolJV}</p>}
            </div>
          </div>
        )}
      </section>

      {/* Contexto comercial */}
      <section className="panel p-6">
        <p className="traza mb-5">Contexto comercial</p>
        <div className="space-y-4">
          <Campo etiqueta="Valor estimado del contrato (€, opcional)" tipo="number"
            valor={campos.valorEstimado} onChange={set("valorEstimado")} error={errores.valorEstimado} />
          <Area etiqueta="Principal pain declarado (opcional)" valor={campos.pain} onChange={set("pain")} />
          <Area etiqueta="Notas internas (opcional)" valor={campos.notas} onChange={set("notas")} />
        </div>
      </section>

      {bloqueo && (
        <div className="border border-block bg-block-soft p-5">
          <p className="traza" style={{ color: "var(--color-block)" }}>No se puede dar de alta</p>
          <p className="mt-2 text-sm">{bloqueo.mensaje}</p>
          {bloqueo.oportunidades.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">
              {bloqueo.oportunidades.map((o) => <li key={o}>{o}</li>)}
            </ul>
          )}
        </div>
      )}

      {errorGeneral && <p className="error">{errorGeneral}</p>}

      <div className="flex items-center gap-4">
        <button className="boton" onClick={guardar} disabled={enviando}>
          {enviando ? "Guardando…" : "Dar de alta"}
        </button>
        <Link href="/leads" className="traza hover:text-accent">Cancelar</Link>
      </div>

      {mostrarAsistente && (
        <Asistente
          onCerrar={() => setMostrarAsistente(false)}
          onAplicar={(s: Sugerencia) => {
            setLinea(s.linea);
            setRolJV(s.rolJV ?? null);
            setSugerido(true);
            setMostrarAsistente(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Campos reutilizables ---------------- */

function Campo({
  etiqueta, valor, onChange, onBlur, error, tipo = "text", marcador,
}: {
  etiqueta: string; valor: string; onChange: (v: string) => void;
  onBlur?: () => void; error?: string; tipo?: string; marcador?: string;
}) {
  const id = etiqueta.toLowerCase().replace(/[^a-z]/g, "");
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <input id={id} className="campo" type={tipo} value={valor} placeholder={marcador}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function Area({
  etiqueta, valor, onChange,
}: { etiqueta: string; valor: string; onChange: (v: string) => void }) {
  const id = etiqueta.toLowerCase().replace(/[^a-z]/g, "");
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <textarea id={id} className="campo" rows={3} value={valor}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}