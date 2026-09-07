"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PROCESOS,
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
  // El interés (T1 del árbol) se responde en el paso de contacto, así que su
  // error tiene que llevar allí y no a Clasificación.
  interes: "contacto",
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

/**
 * Estado del formulario tal cual se guarda en un borrador.
 *
 * Es el estado interno, no un modelo de dominio: se serializa entero y se
 * vuelve a cargar entero. Por eso todo es opcional —un borrador puede haberse
 * guardado en cualquier punto— y por eso el servidor no lo valida por dentro.
 */
export type EstadoBorrador = {
  campos?: Partial<Campos>;
  arbol?: RespuestasArbol;
  ruta?: Ruta | null;
  spinoffClave?: string;
  faseId?: string;
  bant?: RespuestasBant;
  checklist?: RespuestasChecklist;
  procesos?: Proceso[];
  quiereInfo?: boolean;
  paso?: Paso;
};

export type BorradorCargado = { uuid: string; estado: EstadoBorrador };

export default function FormularioLead({
  spinoffs,
  fasesPorRuta,
  errorSpinoffs,
  borrador,
}: {
  spinoffs: Spinoff[];
  fasesPorRuta: FasesPorRuta;
  errorSpinoffs: string | null;
  /** Borrador que se está retomando. Null = alta desde cero. */
  borrador?: BorradorCargado | null;
}) {
  const router = useRouter();

  const inicial = borrador?.estado ?? {};

  const [paso, setPaso] = useState<Paso>(inicial.paso ?? "contacto");
  // Al retomar se da por alcanzado el paso donde se guardó, para poder
  // navegar hacia atrás sin volver a pasar por todos los «Continuar».
  const [alcanzado, setAlcanzado] = useState(() =>
    inicial.paso ? Math.max(0, pasosDe(inicial.ruta ?? null).findIndex((p) => p.id === inicial.paso)) : 0,
  );

  const [campos, setCampos] = useState<Campos>({ ...VACIO, ...(inicial.campos ?? {}) });
  const [arbol, setArbol] = useState<RespuestasArbol>(inicial.arbol ?? {});
  const [ruta, setRuta] = useState<Ruta | null>(inicial.ruta ?? null);
  const [spinoffClave, setSpinoffClave] = useState(inicial.spinoffClave ?? "");
  const [faseId, setFaseId] = useState(inicial.faseId ?? "");
  const [bant, setBant] = useState<RespuestasBant>(inicial.bant ?? {});
  const [checklist, setChecklist] = useState<RespuestasChecklist>(inicial.checklist ?? {});
  const [uuid, setUuid] = useState(() => borrador?.uuid ?? crypto.randomUUID());

  /* --- Borrador ----------------------------------------------------- */

  const [guardandoBorrador, setGuardandoBorrador] = useState(false);
  const [avisoBorrador, setAvisoBorrador] = useState<string | null>(null);

  const [mostrarAsistente, setMostrarAsistente] = useState(false);
  const [sugerido, setSugerido] = useState(false);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<Exito | null>(null);

  const [procesos, setProcesos] = useState<Proceso[]>(inicial.procesos ?? []);

  /** RUTA 7 · el inversor pide (o no) el dossier de inversión. */
  const [quiereInfo, setQuiereInfo] = useState(inicial.quiereInfo ?? false);

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

  /**
   * Los campos que el alta ya no pide siguen existiendo en el estado, vacíos.
   * Hay que mandarlos como `undefined`, no como cadena vacía: ahora son
   * `z.enum(...).optional()`, y "" no es un valor válido del enum. Sin esto el
   * servidor devolvería 422 pidiendo un sector que ya no se pregunta.
   */
  const datosContacto = () => ({
    ...campos,
    web: campos.web || undefined,
    cargo: campos.cargo || undefined,
    herramientas: campos.herramientas || undefined,
    ciudad: campos.ciudad || undefined,
    pais: campos.pais || undefined,
    fuente: campos.fuente || undefined,
    sector: campos.sector || undefined,
    empleados: campos.empleados || undefined,
    facturacion: campos.facturacion || undefined,
  });

  function validarPaso(p: Paso): Record<string, string> {
    if (p === "contacto") {
      // Mismo esquema que usa el POST: si divergen, el fallo aparece en
      // Revision y apunta a un campo que alli no esta en pantalla.
      const r = contactoSchema.safeParse(datosContacto());
      const e: Record<string, string> = {};

      if (!r.success) {
        for (const issue of r.error.issues) {
          const clave = String(issue.path[0]);
          if (!e[clave]) e[clave] = issue.message;
        }
      }

      // El interés vive en este paso desde el 07/09/2026 y es obligatorio: sin
      // él no hay ruta, y sin ruta no hay checklist ni presupuesto. Se
      // comprueba aparte porque no es un campo de `contactoSchema`, sino la
      // primera respuesta del árbol.
      if (!arbol.T1) e.interes = "Indica qué busca este contacto";

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
      ...datosContacto(),
      notas: campos.notas || undefined,
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

  /**
   * Guardar y seguir después.
   *
   * Solo exige los cuatro datos que necesita el contacto: nombre, email,
   * teléfono y empresa. Nada más, ni siquiera el interés: si al comercial le
   * cortan la conversación a la mitad, lo que tiene que poder hacer es
   * guardar, no discutir con un formulario.
   */
  async function guardarBorrador() {
    setGuardandoBorrador(true);
    setAvisoBorrador(null);
    setErrores({});
    setErrorGeneral(null);

    const faltan: Record<string, string> = {};
    if (campos.nombre.trim().length < 2) faltan.nombre = "Escribe nombre y apellidos";
    if (!campos.email.trim()) faltan.email = "Hace falta el email";
    if (campos.telefono.trim().length < 6) faltan.telefono = "Incluye el prefijo internacional";
    if (campos.empresa.trim().length < 2) faltan.empresa = "Falta la razón social";

    if (Object.keys(faltan).length > 0) {
      setErrores(faltan);
      setPaso("contacto");
      setErrorGeneral(
        "Para guardar hacen falta al menos: " + Object.values(faltan).join(" · "),
      );
      setGuardandoBorrador(false);
      return;
    }

    const estado: EstadoBorrador = {
      campos, arbol, ruta, spinoffClave, faseId, bant, checklist, procesos, quiereInfo, paso,
    };

    try {
      const res = await fetch("/api/leads/borrador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid,
          nombre: campos.nombre,
          email: campos.email,
          telefono: campos.telefono,
          empresa: campos.empresa,
          estado,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorGeneral(data.error ?? "No se pudo guardar el borrador.");
        if (data.errores) setErrores(data.errores);
        return;
      }

      // El contacto puede haber fallado sin que el borrador se pierda. Se
      // dice, en vez de dejar que se descubra al buscarlo en el CRM.
      setAvisoBorrador(
        data.ghl?.error
          ? data.ghl.error
          : "Guardado. Lo tienes en «Sin terminar», dentro de tus leads.",
      );
      router.refresh();
    } catch {
      setErrorGeneral("No hay conexión con el servidor. El borrador no se ha guardado.");
    } finally {
      setGuardandoBorrador(false);
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

            {/* El interés es T1 del árbol de clasificación, no un campo suelto.
                Se responde aquí porque es lo primero que se sabe de una
                conversación, y de él sale la ruta: las tres opciones que no
                son «su propia empresa» la resuelven ellas solas y dejan el
                paso 2 sin preguntas. Sin `mostrarResultado`: la ruta se
                presenta en Clasificación, que es donde se revisa. */}
            <div className="sm:col-span-2">
              <ArbolClasificacion
                respuestas={arbol}
                rutaResuelta={ruta}
                onResponder={(r, nueva) => { fijarRuta(nueva, r); setSugerido(false); }}
                filtro={(nodoId) => nodoId === "T1"}
                mostrarResultado={false}
              />
              {errores.interes && <p className="error mt-2">{errores.interes}</p>}
            </div>
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

            {/* T1 ya se respondió en el paso de contacto. Aquí van las
                preguntas que quedan; si la ruta salió directa de T1 no hay
                ninguna, y el recuadro de abajo es todo lo que se ve. */}
            <ArbolClasificacion
              respuestas={arbol}
              rutaResuelta={ruta}
              onResponder={(r, nueva) => { fijarRuta(nueva, r); setSugerido(false); }}
              filtro={(nodoId) => nodoId !== "T1"}
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

        {/* En todos los pasos menos el último. En Revisión ya está «Dar de
            alta» al lado, y dos botones de guardar juntos que hacen cosas
            distintas es como se manda un lead a medias sin querer. */}
        {paso !== "revision" && (
          <button
            className="boton-fantasma"
            onClick={guardarBorrador}
            disabled={guardandoBorrador || enviando}
          >
            {guardandoBorrador ? "Guardando…" : "Guardar y seguir después"}
          </button>
        )}

        <Link href="/leads" className="traza hover:text-accent">Cancelar</Link>
      </div>

      {avisoBorrador && (
        <p className="mt-4 border-l-2 border-accent bg-accent-soft px-4 py-3 text-sm">
          {avisoBorrador}
        </p>
      )}

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