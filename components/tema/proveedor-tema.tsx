"use client";

/**
 * Tema claro / oscuro de la Plataforma Advantys.
 *
 * Tres estados, no dos: "claro", "oscuro" y "sistema" (sigue al sistema operativo).
 * La preferencia vive en localStorage, no en Supabase: es una decision del
 * dispositivo, no del usuario — el mismo comercial puede querer claro en el portatil
 * de la oficina y oscuro en el movil de noche.
 *
 * Quien pinta la clase .dark la primera vez NO es este componente, sino el script
 * de app/layout.tsx, que corre antes del primer render. Aqui solo se mantiene
 * sincronizado a partir de ese momento.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Tema = "claro" | "oscuro" | "sistema";

/** Debe coincidir EXACTAMENTE con la clave del script de app/layout.tsx. */
export const CLAVE_TEMA = "advantys:tema";

type Contexto = {
  tema: Tema;
  /** Lo que se esta viendo ahora mismo, ya resuelto el caso "sistema". */
  resuelto: "claro" | "oscuro";
  setTema: (tema: Tema) => void;
};

const ContextoTema = createContext<Contexto | null>(null);

function preferenciaDelSistema(): "claro" | "oscuro" {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "oscuro"
    : "claro";
}

/**
 * localStorage puede LANZAR, no solo devolver null: con las cookies de terceros
 * bloqueadas, en algunos modos privados o con la política de la empresa, el
 * mero acceso tira un SecurityError. Sin el try, eso tumbaba la aplicación
 * entera por una preferencia de colores. Si no hay almacenamiento, se sigue al
 * sistema y el cambio de tema dura lo que dure la pestaña.
 */
function leerGuardado(): string | null {
  try {
    return window.localStorage.getItem(CLAVE_TEMA);
  } catch {
    return null;
  }
}

function guardar(tema: Tema): void {
  try {
    window.localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    // Sin almacenamiento no se recuerda entre visitas; el tema se aplica igual.
  }
}

function aplicar(tema: Tema): "claro" | "oscuro" {
  const resuelto = tema === "sistema" ? preferenciaDelSistema() : tema;
  document.documentElement.classList.toggle("dark", resuelto === "oscuro");
  document.documentElement.dataset.tema = resuelto;
  return resuelto;
}

export function ProveedorTema({ children }: { children: React.ReactNode }) {
  // Se arranca en "sistema" y se corrige en el primer efecto: leer localStorage
  // durante el render rompe la hidratacion, porque el servidor no puede saberlo.
  const [tema, setTemaEstado] = useState<Tema>("sistema");
  const [resuelto, setResuelto] = useState<"claro" | "oscuro">("claro");

  useEffect(() => {
    const guardado = leerGuardado();
    const inicial: Tema =
      guardado === "claro" || guardado === "oscuro" || guardado === "sistema"
        ? guardado
        : "sistema";
    setTemaEstado(inicial);
    setResuelto(aplicar(inicial));
  }, []);

  // Con "sistema" activo hay que reaccionar si el usuario cambia el tema del SO
  // con la pestana abierta. Con claro u oscuro fijos, se ignora.
  useEffect(() => {
    if (tema !== "sistema") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const alCambiar = () => setResuelto(aplicar("sistema"));
    media.addEventListener("change", alCambiar);
    return () => media.removeEventListener("change", alCambiar);
  }, [tema]);

  const setTema = useCallback((nuevo: Tema) => {
    guardar(nuevo);
    setTemaEstado(nuevo);
    setResuelto(aplicar(nuevo));
  }, []);

  return (
    <ContextoTema.Provider value={{ tema, resuelto, setTema }}>
      {children}
    </ContextoTema.Provider>
  );
}

export function useTema(): Contexto {
  const ctx = useContext(ContextoTema);
  if (!ctx) {
    throw new Error("useTema debe usarse dentro de <ProveedorTema>");
  }
  return ctx;
}