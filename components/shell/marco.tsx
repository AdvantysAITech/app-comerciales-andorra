"use client";

/**
 * Marco de la aplicación. Resuelve el mismo árbol de navegación de dos formas:
 *
 *  - escritorio (md+): barra lateral fija de 240px, como hasta ahora.
 *  - móvil: barra superior con botón de menú y cajón deslizante por encima.
 *
 * En móvil la barra lateral NO puede seguir ocupando sitio: en 375px se comía
 * 240px y dejaba 55px útiles de contenido. Por eso se saca del flujo en vez de
 * estrecharla.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/shell/navbar";
import { LogoAdvantys } from "@/components/shell/logo-advantys";
import type { Modulo } from "@/lib/modulos";

type Props = {
  modulos: Modulo[];
  usuario: { nombre: string; email: string };
  children: React.ReactNode;
};

export function Marco({ modulos, usuario, children }: Props) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  // Al navegar, el cajón se cierra solo. Sin esto te quedas mirando el menú
  // encima de la pantalla que acabas de abrir.
  //
  // Se ajusta en render comparando con la ruta anterior, no en un efecto: un
  // useEffect provocaría un segundo render con el cajón aún abierto, que en
  // móvil se ve como un parpadeo del menú sobre la pantalla nueva.
  const [rutaPrevia, setRutaPrevia] = useState(pathname);
  if (rutaPrevia !== pathname) {
    setRutaPrevia(pathname);
    setAbierto(false);
  }

  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", alPulsar);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", alPulsar);
    };
  }, [abierto]);

  return (
    <div className="flex h-dvh flex-col bg-lienzo md:flex-row">
      {/* Barra superior — solo móvil */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-linea bg-panel px-2 md:hidden">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-tinta hover:bg-elevado"
        >
          <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <Link href="/" aria-label="Inicio" className="flex items-center text-tinta">
          <LogoAdvantys className="h-[20px] w-auto" />
        </Link>
      </header>

      {/* Barra lateral — solo escritorio */}
      <Navbar modulos={modulos} usuario={usuario} className="hidden md:flex" />

      {/* Cajón — solo móvil */}
      {abierto && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={() => setAbierto(false)}
        >
          <div className="absolute inset-0 bg-black/50" aria-hidden />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navegación"
            onClick={(e) => e.stopPropagation()}
            // max-w-[82vw]: siempre queda fondo visible a la derecha, para que
            // se entienda que es una capa y se pueda cerrar tocando fuera.
            className="relative flex w-60 max-w-[82vw] flex-col"
          >
            <Navbar modulos={modulos} usuario={usuario} className="flex" />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  );
}