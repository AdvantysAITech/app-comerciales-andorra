"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FUENTES,
  IDIOMAS,
  SECTORES,
  EMPLEADOS,
  FACTURACION,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
  PROCESOS,
  ETIQUETA_PROCESO,
  MODALIDADES,
  ETIQUETA_SERVICIO,
  ETIQUETA_MODALIDAD,
  serviciosDisponibles,
  type Proceso,
  type Servicio,
  type Modalidad,
  type Fuente,
  type Idioma,
  type Sector,
  type Empleados,
  type Facturacion,
} from "@/lib/domain/lead";
import { LINEAS, ROLES_JV, ETIQUETA_LINEA, ETIQUETA_ROL } from "@/lib/domain/tipos";
import type { LineaNegocio, RolJV } from "@/lib/domain/tipos";
import type { Spinoff } from "@/lib/ghl/spinoffs";
import {
  PREGUNTAS_BANT,
  CLASIFICACION,
  calcularBant,
  type RespuestasBant,
  type CriterioBant,
} from "@/lib/domain/bant";
import Asistente from "./asistente";
import type { Sugerencia } from "@/lib/domain/lead";

/** Orden de aparición de los bloques. Es el orden en que se pregunta en una
 *  conversación real: primero si hay dinero, luego si quien habla puede gastarlo. */
const BLOQUES = ["Budget", "Authority", "Need", "Timeline"] as const;

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
  sector: Sector | "";
  empleados: Empleados | "";
  facturacion: Facturacion | "";
  herramientas: string;
  valorEstimado: string;
  pain: string;
  notas: string;
};

const VACIO: Campos = {
  nombre: "", email: "", telefono: "", empresa: "", cargo: "", ciudadPais: "",
  web: "", fuente: "", idioma: "es", sector: "", empleados: "", facturacion: "",
  herramientas: "", valorEstimado: "", pain: "", notas: "",
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
  const [spinoffClave, setSpinoffClave] = useState("");
  const [bant, setBant] = useState<RespuestasBant>({});
  const [mostrarAsistente, setMostrarAsistente] = useState(false);
  const [sugerido, setSugerido] = useState(false);
  const [uuid, setUuid] = useState(() => crypto.randomUUID());
  const [servicio, setServicio] = useState<Servicio | "">("");
  const [modalidad, setModalidad] = useState<Modalidad | "">("");
  const [procesos, setProcesos] = useState<Proceso[]>([]);

  const serviciosPosibles = useMemo(
    () => (linea ? serviciosDisponibles(linea, rolJV ?? undefined) : []),
    [linea, rolJV],
  );
  useEffect(() => {
    if (serviciosPosibles.length === 1) {
      setServicio(serviciosPosibles[0]);
      return;
    }
    if (serviciosPosibles.length === 0) {
      setServicio("");
      setModalidad("");
      return;
    }
    if (servicio && !(serviciosPosibles as readonly string[]).includes(servicio)) {
      setServicio("");
    }
  }, [serviciosPosibles, servicio]);

  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
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
        `Este contacto ya existe en GHL (${data.contacto.nombre}). Se actualizarán sus datos en vez de duplicarlo.`,
      );
    } catch {
      setAviso(null);
    }
  }

  async function guardar() {
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    // CA-07a: sin línea de negocio no se envía nada al servidor.
    if (!linea) {
      setErrores({ linea: "Selecciona la línea de negocio" });
      setEnviando(false);
      return;
    }

    const esJV = linea === "jv_builder";

    const payload = {
      uuid,
      ...campos,
      web: campos.web || undefined,
      cargo: campos.cargo || undefined,
      pain: campos.pain || undefined,
      notas: campos.notas || undefined,
      herramientas: campos.herramientas || undefined,
      valorEstimado: campos.valorEstimado ? Number(campos.valorEstimado) : undefined,
      servicio: servicio || undefined,
      modalidad: modalidad || undefined,
      procesos,
      bant,
      linea,
      ...(esJV ? { spinoffClave, rolJV: rolJV ?? undefined } : {}),
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
    setUuid(crypto.randomUUID());
    setCampos(VACIO);
    setLinea(null);
    setRolJV(null);
    setSpinoffClave("");
    setBant({});
    setExito(null);
    setAviso(null);
    setSugerido(false);
    setServicio("");
    setModalidad("");
    setProcesos([]);
  }

  const resultado = calcularBant(bant);

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
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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

          <Lista id="fuente" etiqueta="Fuente de captación" valor={campos.fuente}
            opciones={FUENTES} etiquetas={ETIQUETA_FUENTE}
            onChange={set("fuente")} error={errores.fuente} />

          <Lista id="idioma" etiqueta="Idioma preferido" valor={campos.idioma}
            opciones={IDIOMAS} etiquetas={ETIQUETA_IDIOMA}
            onChange={set("idioma")} error={errores.idioma} />

          <Lista id="sector" etiqueta="Sector" valor={campos.sector}
            opciones={SECTORES} etiquetas={ETIQUETA_SECTOR}
            onChange={set("sector")} error={errores.sector} />

          <Lista id="empleados" etiqueta="Número de empleados" valor={campos.empleados}
            opciones={EMPLEADOS} etiquetas={ETIQUETA_EMPLEADOS}
            onChange={set("empleados")} error={errores.empleados} />

          <Lista id="facturacion" etiqueta="Facturación anual" valor={campos.facturacion}
            opciones={FACTURACION} etiquetas={ETIQUETA_FACTURACION}
            onChange={set("facturacion")} error={errores.facturacion} />

          <Campo etiqueta="Herramientas actuales (opcional)" valor={campos.herramientas}
            onChange={set("herramientas")} error={errores.herramientas}
            marcador="CRM, ERP…" />
        </div>

        {aviso && (
          <p className="mt-4 border border-line bg-accent-soft px-3 py-2 text-sm">{aviso}</p>
        )}
      </section>

      {/* Clasificación */}
      <section className="panel p-6">
        <p className="traza mb-1">Clasificación</p>

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
                <select id="spinoff" className="campo" value={spinoffClave}
                  aria-invalid={errores.spinoffClave ? "true" : undefined}
                  onChange={(e) => setSpinoffClave(e.target.value)}>
                  <option value="">Selecciona la spin-off…</option>
                  {spinoffs.map((s) => (
                    <option key={s.clave} value={s.clave}>{s.nombre}</option>
                  ))}
                </select>
                {errores.spinoffClave && <p className="error">{errores.spinoffClave}</p>}
              </div>
            )}

            <div>
              <label className="etiqueta">Rol en la oportunidad</label>
              <div className="flex flex-wrap gap-2">
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
        {linea && (linea !== "jv_builder" || rolJV) && serviciosPosibles.length > 0 && (
          <div className="mt-6 grid gap-4 border-t border-line pt-6 sm:grid-cols-2">
            <div>
              <label className="etiqueta" htmlFor="servicio">Servicio</label>
              <select
                id="servicio"
                className="campo"
                value={servicio}
                disabled={serviciosPosibles.length === 1}
                aria-invalid={errores.servicio ? "true" : undefined}
                onChange={(e) => {
                  setServicio(e.target.value as Servicio | "");
                  setErrores((x) => ({ ...x, servicio: "" }));
                }}
              >
                <option value="">Selecciona el servicio…</option>
                {serviciosPosibles.map((s) => (
                  <option key={s} value={s}>{ETIQUETA_SERVICIO[s]}</option>
                ))}
              </select>
              {serviciosPosibles.length === 1 && (
                <p className="traza mt-1.5 normal-case">
                  Único servicio posible en esta línea.
                </p>
              )}
              {errores.servicio && <p className="error">{errores.servicio}</p>}
            </div>

            <div>
              <label className="etiqueta" htmlFor="modalidad">
                Modalidad (opcional)
              </label>
              <select
                id="modalidad"
                className="campo"
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as Modalidad | "")}
              >
                <option value="">Sin definir todavía</option>
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>{ETIQUETA_MODALIDAD[m]}</option>
                ))}
              </select>
              <p className="traza mt-1.5 normal-case">
                Cómo se cobra. Si aún no está hablado, déjalo sin definir.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Cualificación BANT */}
      <section className="panel p-6">
        <p className="traza mb-1">Cualificación BANT</p>
        <p className="mb-6 text-sm text-tinta-media">
          Responde lo que haya salido en la conversación. Lo que dejes en blanco no puntúa
          y se completa en el diagnóstico — no es lo mismo &laquo;no tiene presupuesto&raquo;
          que &laquo;no se lo he preguntado&raquo;.
        </p>

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
                          const siguiente = { ...b };
                          if (e.target.value) siguiente[p.id as CriterioBant] = e.target.value;
                          else delete siguiente[p.id as CriterioBant];
                          return siguiente;
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
                    {/* El guion es lo que el comercial dice en voz alta. */}
                    <p className="mt-1.5 text-xs italic text-tinta-tenue">&ldquo;{p.guion}&rdquo;</p>
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
                de 10 &middot; {CLASIFICACION[resultado.clasificacion].tag}
              </p>
            </div>
            <p className="mt-3 text-sm">{CLASIFICACION[resultado.clasificacion].accion}</p>
            {!resultado.completo && (
              <p className="traza mt-3 normal-case">
                Score provisional: {resultado.respondidas} de 6 respondidas. Con las que faltan
                podría llegar a {resultado.techo.toLocaleString("es-ES")}.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Contexto comercial */}
      <section className="panel p-6">
        <p className="traza mb-5">Contexto comercial</p>
        <div className="space-y-4">
          <Campo etiqueta="Valor estimado del contrato (€, opcional)" tipo="number"
            valor={campos.valorEstimado} onChange={set("valorEstimado")} error={errores.valorEstimado} />
          <div>
            <label className="etiqueta">Procesos críticos a automatizar (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {PROCESOS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="boton-fantasma"
                  data-activo={procesos.includes(p)}
                  onClick={() =>
                    setProcesos((actual) =>
                      actual.includes(p)
                        ? actual.filter((x) => x !== p)
                        : [...actual, p],
                    )
                  }
                >
                  {ETIQUETA_PROCESO[p]}
                </button>
              ))}
            </div>
          </div>
          <Area etiqueta="Principal dolor declarado (opcional)" valor={campos.pain} onChange={set("pain")} />
          <Area etiqueta="Notas internas (opcional)" valor={campos.notas} onChange={set("notas")} />
        </div>
      </section>

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

function Lista<T extends string>({
  id, etiqueta, valor, opciones, etiquetas, onChange, error, vacio = "Selecciona…",
}: {
  id: string;
  etiqueta: string;
  valor: string;
  opciones: readonly T[];
  etiquetas: Record<T, string>;
  onChange: (v: string) => void;
  error?: string;
  vacio?: string;
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <select id={id} className="campo" value={valor}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">{vacio}</option>
        {opciones.map((o) => <option key={o} value={o}>{etiquetas[o]}</option>)}
      </select>
      {error && <p className="error">{error}</p>}
    </div>
  );
}