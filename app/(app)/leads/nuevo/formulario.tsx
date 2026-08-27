"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FUENTES,
  IDIOMAS,
  SECTORES,
  EMPLEADOS,
  PROCESOS,
  FACTURACION,
  ETIQUETA_FUENTE,
  ETIQUETA_IDIOMA,
  ETIQUETA_SECTOR,
  ETIQUETA_EMPLEADOS,
  ETIQUETA_FACTURACION,
  ETIQUETA_PROCESO,
  contactoSchema,
  type Proceso,
  type Fuente,
  type Idioma,
  type Sector,
  type Empleados,
  type Facturacion,
} from "@/lib/domain/lead";
import {
  DEFINICION_RUTA,
  requiereSpinoff,
  type Ruta,
  type RespuestasArbol,
} from "@/lib/domain/rutas";
import {
  esInversor,
  generaPresupuesto,
  muestraProcesosCriticos,
} from "@/lib/domain/visibilidad";
import { ETIQUETA_SERVICIO } from "@/lib/domain/servicio";
import {
  CHECKLISTS,
  rutaReencaminada,
  validar,
  SPINOFF,
  type RespuestasChecklist,
  type ValorRespuesta,
} from "@/lib/domain/checklists";
import {
  PREGUNTAS_BANT,
  CLASIFICACION,
  calcularBant,
  type RespuestasBant,
  type CriterioBant,
} from "@/lib/domain/bant";
import type { Spinoff } from "@/lib/ghl/spinoffs";
import type { SugerenciaRuta } from "@/lib/domain/asistente";
import Asistente from "./asistente";
import RenderChecklist from "./checklist";
import { BarraPasos, pasosDe, type Paso } from "./pasos";
import ArbolClasificacion from "./arbol";
import GenerarDocumento from "../generar-documento";

/** Fases de entrada de cada ruta, resueltas en servidor: el componente
 *  cliente nunca ve el mapa de IDs de GHL, solo id y nombre de lo que puede
 *  ofrecer. */
export type FasesPorRuta = Record<Ruta, { id: string; nombre: string }[]>;

const BLOQUES = ["Budget", "Authority", "Need", "Timeline"] as const;

type Campos = {
  nombre: string;
  email: string;
  telefono: string;
  empresa: string;
  cargo: string;
  ciudad: string;
  pais: string;
  web: string;
  fuente: Fuente | "";
  idioma: Idioma | "";
  sector: Sector | "";
  empleados: Empleados | "";
  facturacion: Facturacion | "";
  herramientas: string;
  valorEstimado: string;
  notas: string;
};

const VACIO: Campos = {
  nombre: "", email: "", telefono: "", empresa: "", cargo: "", ciudad: "", pais: "",
  web: "", fuente: "", idioma: "es", sector: "", empleados: "", facturacion: "",
  herramientas: "", valorEstimado: "", notas: "",
};

const CAMPOS_PASO: Record<string, Paso> = {
  nombre: "contacto", email: "contacto", telefono: "contacto",
  empresa: "contacto", cargo: "contacto", ciudad: "contacto", pais: "contacto",
  web: "contacto", fuente: "contacto", idioma: "contacto",
  sector: "contacto", empleados: "contacto", facturacion: "contacto",
  herramientas: "contacto",
  ruta: "clasificacion", spinoffClave: "clasificacion", faseId: "clasificacion",
  bant: "bant",
  uuid: "revision", valorEstimado: "revision", notas: "revision", procesos: "revision",
  quiereInfoInversores: "revision",
};

function pasoDelCampo(clave: string): Paso {
  return CAMPOS_PASO[clave] ?? "checklist";
}

type Exito = {
  contactoId: string;
  oportunidadId: string;
  contactoExistia: boolean;
  leadId?: string;
};

export default function FormularioLead({
  spinoffs,
  fasesPorRuta,
  errorSpinoffs,
}: {
  spinoffs: Spinoff[];
  fasesPorRuta: FasesPorRuta;
  errorSpinoffs: string | null;
}) {
  const router = useRouter();

  const [paso, setPaso] = useState<Paso>("contacto");
  const [alcanzado, setAlcanzado] = useState(0);

  const [campos, setCampos] = useState<Campos>(VACIO);
  const [arbol, setArbol] = useState<RespuestasArbol>({});
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [spinoffClave, setSpinoffClave] = useState("");
  const [faseId, setFaseId] = useState("");
  const [bant, setBant] = useState<RespuestasBant>({});
  const [checklist, setChecklist] = useState<RespuestasChecklist>({});
  const [uuid, setUuid] = useState(() => crypto.randomUUID());

  const [mostrarAsistente, setMostrarAsistente] = useState(false);
  const [sugerido, setSugerido] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);

  const [procesos, setProcesos] = useState<Proceso[]>([]);

  /** RUTA 7 · el inversor pide (o no) el dossier de inversión. */
  const [quiereInfo, setQuiereInfo] = useState(false);

  const resultadoBant = calcularBant(bant);
  const definicion = ruta ? DEFINICION_RUTA[ruta] : null;
  const fases = ruta ? fasesPorRuta[ruta] : [];

  /* Las tres decisiones de visibilidad, en un solo sitio. Se recalculan en
     cada render porque dependen de la ruta y del sector, y los dos cambian
     mientras el comercial rellena. */
  const inversor = esInversor(ruta);
  const conProcesos = muestraProcesosCriticos({
    ruta,
    sector: campos.sector || null,
    spinoffClave: spinoffClave || null,
  });
  const conPresupuesto = generaPresupuesto(ruta);

  /** Los pasos vigentes. Con RUTA 7 son cuatro: el BANT desaparece. */
  const pasos = useMemo(() => pasosDe(ruta), [ruta]);

  const pasosConError = useMemo(
    () =>
      [...new Set(Object.keys(errores).map(pasoDelCampo))].filter((p) =>
        pasos.some((x) => x.id === p),
      ),
    [errores, pasos],
  );

  const set = (clave: keyof Campos) => (valor: string) => {
    setCampos((c) => ({ ...c, [clave]: valor }));
    setErrores((e) => {
      if (!e[clave]) return e;
      const { [clave]: _, ...resto } = e;
      return resto;
    });
  };

  /* ---------------- Clasificación ---------------- */

  function fijarRuta(nueva: Ruta | null, respuestasArbol: RespuestasArbol) {
    setArbol(respuestasArbol);
    setErrores({});

    // Cambiar de ruta cambia el checklist entero. Conservar las respuestas
    // anteriores dejaba las de la ruta vieja puestas y las obligatorias de la
    // nueva sin responder, y el bloqueo no saltaba hasta el POST. Se compara
    // con la ruta actual para no borrar nada cuando se repulsa la misma
    // opcion del arbol.
    if (nueva !== ruta) {
      setChecklist({});
      // Y se retrocede el progreso: con el checklist vacio, Revision ya no es
      // un paso alcanzado. El indice de "clasificacion" es 1 con BANT y sin
      // el, asi que no depende de la lista filtrada.
      setAlcanzado((a) => Math.min(a, 1));
    }

    // RUTA 7: un inversor no se cualifica. Se borra lo que hubiera respondido
    // antes de cambiar de ruta —si no, el BANT viajaria al POST aunque la
    // pestana ya no se vea— y, si estaba en esa pestana, se le saca de ella
    // antes de que quede en un paso que deja de existir.
    if (esInversor(nueva)) {
      setBant({});
      if (paso === "bant") setPaso("clasificacion");
    }

    setRuta(nueva);
    // La fase por defecto es la primera del pipeline destino, que cambia con
    // la ruta. Se resetea siempre: mantener una fase de otro pipeline sería
    // mandar a GHL un id que allí no existe.
    setFaseId(nueva ? (fasesPorRuta[nueva][0]?.id ?? "") : "");
    if (nueva && !requiereSpinoff(nueva)) setSpinoffClave("");
  }

  /* ---------------- Navegación ---------------- */

  function validarPaso(p: Paso): Record<string, string> {
    if (p === "contacto") {
      // Mismo esquema que usa el POST: si divergen, el fallo aparece en
      // Revision y apunta a un campo que alli no esta en pantalla.
      const r = contactoSchema.safeParse({
        ...campos,
        web: campos.web || undefined,
        cargo: campos.cargo || undefined,
        herramientas: campos.herramientas || undefined,
      });
      if (r.success) return {};

      const e: Record<string, string> = {};
      for (const issue of r.error.issues) {
        const clave = String(issue.path[0]);
        if (!e[clave]) e[clave] = issue.message;
      }
      return e;
    }

    if (p === "clasificacion") {
      if (!ruta) return { ruta: "Responde las preguntas hasta llegar a una ruta" };
      if (requiereSpinoff(ruta) && !spinoffClave) {
        return { spinoffClave: "Selecciona la spin-off" };
      }
      return {};
    }

    // El BANT es parcial a propósito: se responde lo que haya salido en la
    // conversación y lo que falte se completa en el diagnóstico.
    if (p === "bant") return {};

    if (p === "checklist") {
      if (!ruta) return { ruta: "Vuelve a Clasificación: falta la ruta" };
      const conContexto = spinoffClave
        ? { ...checklist, [SPINOFF]: spinoffClave }
        : checklist;
      return validar(CHECKLISTS[ruta], conContexto);
    }

    return {};
  }

  /**
   * Valida `desde` y devuelve el paso siguiente, o null si no se puede pasar.
   * Se extrae de `avanzar` porque la barra de pasos necesita exactamente la
   * misma comprobación cuando se navega hacia delante.
   */
  function intentarAvanzar(desde: Paso): Paso | null {
    const fallos = validarPaso(desde);
    if (Object.keys(fallos).length > 0) {
      setErrores(fallos);
      setErrorGeneral(
        "Faltan datos en este paso: " + Object.values(fallos).join(" · "),
      );
      return null;
    }

    setErrores({});
    setErrorGeneral(null);

    // R4.1 = "Nada" convierte el lead en RUTA 2. Se comprueba al salir del
    // checklist, no al entrar: el comercial ve el aviso con la respuesta ya
    // dada y entiende por qué le cambia la ruta bajo los pies.
    if (desde === "checklist" && ruta) {
      const nueva = rutaReencaminada(CHECKLISTS[ruta], checklist);
      if (nueva && nueva !== ruta) {
        fijarRuta(nueva, arbol);
        setAviso(
          `Sin documentación no hay proyecto que presupuestar. El lead pasa a ` +
            `${DEFINICION_RUTA[nueva].nombre}: responde su checklist.`,
        );
        return null;
      }
    }

    return pasos[pasos.findIndex((x) => x.id === desde) + 1]?.id ?? null;
  }

  function avanzar() {
    const siguiente = intentarAvanzar(paso);
    if (!siguiente) return;

    setPaso(siguiente);
    setAlcanzado((a) => Math.max(a, pasos.findIndex((x) => x.id === siguiente)));
    setAviso(null);
  }

  /** Navegación desde la barra de pasos. */
  function irA(destino: Paso) {
    const iDestino = pasos.findIndex((x) => x.id === destino);
    const iActual = pasos.findIndex((x) => x.id === paso);

    // Hacia atrás, libre: es la forma de corregir algo ya respondido.
    if (iDestino <= iActual) {
      setErrorGeneral(null);
      setPaso(destino);
      return;
    }

    // Hacia delante se valida paso a paso. Si uno falla, se para ahí con los
    // campos marcados, en vez de dejar llegar a Revisión un lead incompleto.
    let cursor = paso;
    for (let i = iActual; i < iDestino; i++) {
      const siguiente = intentarAvanzar(cursor);
      if (!siguiente) {
        setPaso(cursor);
        return;
      }
      cursor = siguiente;
    }

    setPaso(cursor);
    setAlcanzado((a) => Math.max(a, iDestino));
  }

  function retroceder() {
    const anterior = pasos[pasos.findIndex((x) => x.id === paso) - 1];
    if (anterior) setPaso(anterior.id);
    setErrorGeneral(null);
  }

  /* ---------------- Aviso de contacto existente ---------------- */

  async function comprobarContacto() {
    if (!campos.email && !campos.telefono) return;
    try {
      const params = new URLSearchParams();
      if (campos.email) params.set("email", campos.email);
      if (campos.telefono) params.set("telefono", campos.telefono);
      const res = await fetch(`/api/ghl/lookup?${params}`);
      const data = await res.json();
      setAviso(
        data.contacto
          ? `Este contacto ya existe en el Sistema Advantys (${data.contacto.nombre}). ` +
            `Se actualizarán sus datos en vez de duplicarlo.`
          : null,
      );
    } catch {
      setAviso(null);
    }
  }

  /* ---------------- Envío ---------------- */

  async function guardar() {
    if (!ruta) return;
    setEnviando(true);
    setErrores({});
    setErrorGeneral(null);

    const payload = {
      uuid,
      ...campos,
      web: campos.web || undefined,
      cargo: campos.cargo || undefined,
      notas: campos.notas || undefined,
      herramientas: campos.herramientas || undefined,
      valorEstimado: campos.valorEstimado ? Number(campos.valorEstimado) : undefined,
      ruta,
      faseId: faseId || undefined,
      spinoffClave: requiereSpinoff(ruta) ? spinoffClave : undefined,
      // Lo que no se muestra tampoco se manda. El servidor vuelve a filtrarlo
      // por su cuenta, pero enviarlo vacio desde aqui evita que un cambio de
      // ruta a mitad de formulario arrastre respuestas de la ruta anterior.
      bant: inversor ? {} : bant,
      checklist,
      arbol,
      procesos: conProcesos ? procesos : [],
      quiereInfoInversores: inversor ? quiereInfo : false,
    };

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.status === 422) {
        const fallos: Record<string, string> = data.errores ?? {};
        setErrores(fallos);
        const destino = Object.keys(fallos)
          .map(pasoDelCampo)
          .filter((p) => pasos.some((x) => x.id === p))
          .sort((a, b) =>
            pasos.findIndex((p) => p.id === a) - pasos.findIndex((p) => p.id === b),
          )[0];

        if (destino && destino !== "revision") {
          setPaso(destino);
          setErrorGeneral(
            "Faltan datos en este paso: " + Object.values(fallos).join(" · "),
          );
        } else {
          setErrorGeneral("Revisa los campos marcados en rojo.");
        }
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
    setArbol({});
    setRuta(null);
    setSpinoffClave("");
    setFaseId("");
    setBant({});
    setChecklist({});
    setExito(null);
    setAviso(null);
    setSugerido(false);
    setPaso("contacto");
    setAlcanzado(0);
    setProcesos([]);
    setQuiereInfo(false);
  }

  /* ---------------- Confirmación ---------------- */

  if (exito) {
    return (
      <div className="panel p-6">
        <p className="traza">Registrado en el Sistema Advantys</p>
        <p className="mt-3 text-lg font-medium">Lead dado de alta correctamente.</p>
        <p className="mt-2 text-sm text-muted">
          {exito.contactoExistia
            ? "El contacto ya existía y se han actualizado sus datos."
            : "Se ha creado el contacto."}{" "}
          La oportunidad está en la fase que has elegido.
        </p>
        {inversor && (
          <p className="mt-5 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
            {quiereInfo
              ? "Has marcado que quiere recibir informacion para inversores. El " +
                "Sistema Advantys se la envia automaticamente, con el material de " +
                "la spin-off que ha elegido. No tienes que mandar nada a mano."
              : "No has marcado el envio de informacion para inversores. Si cambia " +
                "de opinion, marcalo desde la ficha del lead."}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {exito.leadId && conPresupuesto && <GenerarDocumento leadId={exito.leadId} />}
          <button className="boton-fantasma" onClick={otroLead}>Dar de alta otro</button>
          <Link href="/leads" className="boton-fantasma inline-block">Ver mis leads</Link>
        </div>
      </div>
    );
  }

  /* ---------------- Formulario ---------------- */

  return (
    <div>
      <BarraPasos
        pasos={pasos}
        actual={paso}
        alcanzado={alcanzado}
        conError={pasosConError}
        onIr={setPaso}
      />

      {aviso && (
        <p className="mb-6 border border-line bg-accent-soft px-4 py-3 text-sm">{aviso}</p>
      )}

      <section className="panel p-6">
        {/* ---------- Paso 1 · Contacto ---------- */}
        {paso === "contacto" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre completo" valor={campos.nombre} onChange={set("nombre")} error={errores.nombre} />
            <Campo etiqueta="Empresa" valor={campos.empresa} onChange={set("empresa")} error={errores.empresa} />
            <Campo etiqueta="Email" tipo="email" valor={campos.email} onChange={set("email")} onBlur={comprobarContacto} error={errores.email} />
            <Campo etiqueta="Teléfono" valor={campos.telefono} onChange={set("telefono")} onBlur={comprobarContacto} error={errores.telefono} marcador="+376 ..." />
            <Campo etiqueta="Cargo (opcional)" valor={campos.cargo} onChange={set("cargo")} />
            <Campo etiqueta="Ciudad" valor={campos.ciudad} onChange={set("ciudad")} error={errores.ciudad} />
            <Campo etiqueta="País" valor={campos.pais} onChange={set("pais")} error={errores.pais} />
            <Campo etiqueta="Web (opcional)" valor={campos.web} onChange={set("web")} marcador="https://" error={errores.web} />

            <Lista id="fuente" etiqueta="Fuente de captación" valor={campos.fuente}
              opciones={FUENTES} etiquetas={ETIQUETA_FUENTE} onChange={set("fuente")} error={errores.fuente} />
            <Lista id="idioma" etiqueta="Idioma preferido" valor={campos.idioma}
              opciones={IDIOMAS} etiquetas={ETIQUETA_IDIOMA} onChange={set("idioma")} />
            <Lista id="sector" etiqueta="Sector" valor={campos.sector}
              opciones={SECTORES} etiquetas={ETIQUETA_SECTOR} onChange={set("sector")} error={errores.sector} />
            <Lista id="empleados" etiqueta="Número de empleados" valor={campos.empleados}
              opciones={EMPLEADOS} etiquetas={ETIQUETA_EMPLEADOS} onChange={set("empleados")} error={errores.empleados} />
            <Lista id="facturacion" etiqueta="Facturación anual" valor={campos.facturacion}
              opciones={FACTURACION} etiquetas={ETIQUETA_FACTURACION} onChange={set("facturacion")} error={errores.facturacion} />

            <Campo etiqueta="Herramientas actuales (opcional)" valor={campos.herramientas}
              onChange={set("herramientas")} marcador="CRM, ERP…" />
          </div>
        )}

        {/* ---------- Paso 2 · Clasificación ---------- */}
        {paso === "clasificacion" && (
          <div className="space-y-6">
            <button type="button" className="traza underline hover:text-accent"
              onClick={() => setMostrarAsistente(true)}>
              ¿No lo tienes claro? Usa el asistente guiado
            </button>

            {sugerido && (
              <p className="text-sm text-muted">
                Ruta sugerida por el asistente. Cámbiala si no encaja.
              </p>
            )}

            <ArbolClasificacion
              respuestas={arbol}
              rutaResuelta={ruta}
              onResponder={(r, nueva) => { fijarRuta(nueva, r); setSugerido(false); }}
            />
            {errores.ruta && <p className="error">{errores.ruta}</p>}

            {ruta && requiereSpinoff(ruta) && (
              <div>
                <label className="etiqueta" htmlFor="spinoff">Spin-off</label>
                {errorSpinoffs ? (
                  <p className="error">{errorSpinoffs}</p>
                ) : (
                  <select id="spinoff" className="campo" value={spinoffClave}
                    aria-invalid={errores.spinoffClave ? "true" : undefined}
                    onChange={(e) => setSpinoffClave(e.target.value)}>
                    <option value="">Selecciona la spin-off…</option>
                    {spinoffs.map((s) => (
                      <option key={s.clave} value={s.clave}>{s.nombre}</option>
                    ))}
                  </select>
                )}
                {errores.spinoffClave && <p className="error">{errores.spinoffClave}</p>}
              </div>
            )}

            {ruta && fases.length > 0 && (
              <div>
                <label className="etiqueta" htmlFor="fase">Fase de entrada</label>
                <select id="fase" className="campo" value={faseId}
                  onChange={(e) => setFaseId(e.target.value)}>
                  {fases.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
                <p className="traza mt-1.5 normal-case">
                  Si la conversación ya viene avanzada, entra por donde toque.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---------- Paso 3 · BANT ---------- */}
        {/* No se pinta para inversores. `pasos` ya no lo incluye, pero el guardia
            evita que un cambio de ruta a mitad de render lo deje visible. */}
        {paso === "bant" && !inversor && (
          <div>
            <p className="mb-6 text-sm text-tinta-media">
              Responde lo que haya salido en la conversación. Lo que dejes en blanco no
              puntúa y se completa en el diagnóstico.
            </p>

            <div className="space-y-7">
              {BLOQUES.map((bloque) => (
                <div key={bloque}>
                  <p className="traza mb-3">{bloque}</p>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {PREGUNTAS_BANT.filter((p) => p.bloque === bloque).map((p) => (
                      <div key={p.id}>
                        <label className="etiqueta" htmlFor={`bant-${p.id}`}>{p.etiqueta}</label>
                        <select id={`bant-${p.id}`} className="campo" value={bant[p.id] ?? ""}
                          onChange={(e) =>
                            setBant((b) => {
                              const s = { ...b };
                              if (e.target.value) s[p.id as CriterioBant] = e.target.value;
                              else delete s[p.id as CriterioBant];
                              return s;
                            })
                          }>
                          <option value="">Sin dato</option>
                          {p.opciones.map((o) => (
                            <option key={o.valor} value={o.valor}>{o.etiquetaGhl}</option>
                          ))}
                        </select>
                        <p className="mt-1.5 text-xs italic text-tinta-tenue">
                          &ldquo;{p.guion}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {resultadoBant.respondidas > 0 && (
              <div className="mt-8 border-l-2 border-accent bg-accent-soft px-5 py-4">
                <div className="flex items-baseline gap-3">
                  <p className="text-3xl font-semibold tabular-nums leading-none">
                    {resultadoBant.total.toLocaleString("es-ES")}
                  </p>
                  <p className="traza">
                    de 10 &middot; {CLASIFICACION[resultadoBant.clasificacion].tag}
                  </p>
                </div>
                <p className="mt-3 text-sm">
                  {CLASIFICACION[resultadoBant.clasificacion].accion}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ---------- Paso 4 · Checklist ---------- */}
        {paso === "checklist" && ruta && (
          <RenderChecklist
            checklist={CHECKLISTS[ruta]}
            respuestas={checklist}
            spinoffClave={spinoffClave || undefined}
            errores={errores}
            onCambio={(id, valor) =>
              setChecklist((c) => {
                const s = { ...c };
                if (valor === undefined) delete s[id];
                else s[id] = valor;
                return s;
              })
            }
          />
        )}

        {/* ---------- Paso 5 · Revisión ---------- */}
        {paso === "revision" && definicion && (
          <div className="space-y-5">
            <Resumen titulo="Contacto" valor={`${campos.nombre} · ${campos.empresa}`} />
            <Resumen titulo="Ruta" valor={definicion.nombre} />
            {definicion.servicio && (
              <Resumen titulo="Servicio" valor={ETIQUETA_SERVICIO[definicion.servicio]} />
            )}
            {spinoffClave && (
              <Resumen
                titulo="Spin-off"
                valor={spinoffs.find((s) => s.clave === spinoffClave)?.nombre ?? spinoffClave}
              />
            )}
            <Resumen
              titulo="Fase de entrada"
              valor={fases.find((f) => f.id === faseId)?.nombre ?? "Primera del pipeline"}
            />
            {!inversor && (
              <Resumen
                titulo="BANT"
                valor={
                  resultadoBant.respondidas > 0
                    ? `${resultadoBant.total.toLocaleString("es-ES")} de 10 · ` +
                      `${CLASIFICACION[resultadoBant.clasificacion].tag}` +
                      (resultadoBant.completo ? "" : " (provisional)")
                    : "Sin cualificar"
                }
              />
            )}

            {/* Procesos críticos: fuera para inversores (no tienen procesos
                que automatizar: aportan capital) y fuera para el sector
                educativo, donde la conversación no va de marketing ni de
                ventas. La regla vive en lib/domain/visibilidad.ts. */}
            {conProcesos && (
              <div>
                <label className="etiqueta">Procesos críticos a automatizar (opcional)</label>
                <div className="flex flex-wrap gap-2">
                  {PROCESOS.map((p) => (
                    <button key={p} type="button" className="boton-fantasma"
                      data-activo={procesos.includes(p)}
                      onClick={() =>
                        setProcesos((a) =>
                          a.includes(p) ? a.filter((x) => x !== p) : [...a, p],
                        )
                      }>
                      {ETIQUETA_PROCESO[p]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* RUTA 7 · el único campo que se añade para inversores. Viaja a
                GHL como radio Sí/No y es lo que dispara la automatización de
                envío del dossier al crearse la oportunidad. */}
            {inversor && (
              <div className="border-l-2 border-accent bg-accent-soft px-5 py-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0 accent-current"
                    checked={quiereInfo}
                    onChange={(e) => setQuiereInfo(e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      Quiere recibir información para inversores
                    </span>
                    <span className="traza mt-1 block normal-case">
                      Al guardar, se le envía automáticamente el material de la
                      spin-off que ha elegido. Márcalo solo si te lo ha pedido.
                    </span>
                  </span>
                </label>
              </div>
            )}

            <div>
              <label className="etiqueta" htmlFor="valorEstimado">
                {inversor
                  ? "Importe de inversión previsto (€, opcional)"
                  : "Valor estimado del contrato (€, opcional)"}
              </label>
              <input id="valorEstimado" className="campo" type="number"
                value={campos.valorEstimado} onChange={(e) => set("valorEstimado")(e.target.value)} />
            </div>

            <div>
              <label className="etiqueta" htmlFor="notas">Notas internas (opcional)</label>
              <textarea id="notas" className="campo" rows={3} value={campos.notas}
                onChange={(e) => set("notas")(e.target.value)} />
            </div>

            {!conPresupuesto ? (
              <p className="border-l-2 border-block bg-elevado px-4 py-3 text-sm">
                A un inversor no se le genera propuesta: lo que recibe es
                información de inversión. No comprometas cifras ni condiciones
                de entrada.
              </p>
            ) : (
              !definicion.calculaPrecio && (
                <p className="border-l-2 border-block bg-elevado px-4 py-3 text-sm">
                  Esta ruta no calcula precio en la app. No comprometas cifras con el cliente.
                </p>
              )
            )}
          </div>
        )}
      </section>

      {errorGeneral && <p className="error mt-4">{errorGeneral}</p>}

      <div className="mt-6 flex items-center gap-4">
        {paso !== "contacto" && (
          <button className="boton-fantasma" onClick={retroceder} disabled={enviando}>
            Atrás
          </button>
        )}
        {paso === "revision" ? (
          <button className="boton" onClick={guardar} disabled={enviando}>
            {enviando ? "Guardando…" : "Dar de alta"}
          </button>
        ) : (
          <button className="boton" onClick={avanzar}>Continuar</button>
        )}
        <Link href="/leads" className="traza hover:text-accent">Cancelar</Link>
      </div>

      {mostrarAsistente && (
        <Asistente
          spinoffs={spinoffs}
          onCerrar={() => setMostrarAsistente(false)}
          onAplicar={(s: SugerenciaRuta) => {
            // El asistente salta el árbol: fija la ruta directamente y deja el
            // tronco sin responder. Es correcto — quien usa el asistente es
            // porque no sabe contestarlo — pero significa que `arbol` puede
            // llegar vacío al servidor, y por eso allí no es obligatorio.
            fijarRuta(s.ruta, {});
            if (s.spinoffClave) setSpinoffClave(s.spinoffClave);
            setSugerido(true);
            setMostrarAsistente(false);
          }}
        />
      )}
    </div>
  );
}

/* ---------------- Auxiliares ---------------- */

function Resumen({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="traza">{titulo}</p>
      <p className="mt-1 text-sm">{valor}</p>
    </div>
  );
}

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

function Lista<T extends string>({
  id, etiqueta, valor, opciones, etiquetas, onChange, error,
}: {
  id: string; etiqueta: string; valor: string;
  opciones: readonly T[]; etiquetas: Record<T, string>;
  onChange: (v: string) => void; error?: string;
}) {
  return (
    <div>
      <label className="etiqueta" htmlFor={id}>{etiqueta}</label>
      <select id={id} className="campo" value={valor}
        aria-invalid={error ? "true" : undefined}
        onChange={(e) => onChange(e.target.value)}>
        <option value="">Selecciona…</option>
        {opciones.map((o) => <option key={o} value={o}>{etiquetas[o]}</option>)}
      </select>
      {error && <p className="error">{error}</p>}
    </div>
  );
}