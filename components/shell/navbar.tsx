"use client";

/**
 * Navegación lateral de la Plataforma Advantys.
 *
 * No consulta permisos: recibe ya filtrados los módulos que este usuario puede ver.
 * Los módulos con `disponible: false` se pintan apagados y no navegan — sirven para
 * mostrar la forma final de la plataforma sin tener que construirlos todos hoy.
 *
 * Debajo de los módulos hay un bloque fijo de accesos externos (CRM, Soporte).
 * Va anclado al pie y no dentro del área con scroll: son los dos enlaces que el
 * comercial usa a diario y no deben quedar fuera de pantalla cuando la lista de
 * módulos crezca.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { agruparModulos, type Modulo } from "@/lib/modulos";
import { ENLACES_EXTERNOS } from "@/lib/enlaces-externos";
import { ICONOS, ICONOS_EXTERNOS } from "@/components/shell/iconos";
import { LogoAdvantys } from "@/components/shell/logo-advantys";

type Props = {
  modulos: Modulo[];
  usuario: { nombre: string; email: string };
  /** Lo pone Marco: "hidden md:flex" en escritorio, "flex" dentro del cajón. */
  className?: string;
};

export function Navbar({ modulos, usuario, className = "flex" }: Props) {
  const pathname = usePathname();
  const enPerfil = pathname.startsWith("/perfil");

  return (
    <nav
      className={`h-full w-60 shrink-0 flex-col border-r border-linea bg-panel ${className}`}
    >
      <Link
        href="/"
        aria-label="Inicio"
        className="flex h-16 shrink-0 items-center px-5 text-tinta"
      >
        {/* El "Ai" del logo va en currentColor: hereda text-tinta y sirve en claro y en oscuro. */}
        <LogoAdvantys className="h-[22px] w-auto" />
      </Link>

      <div className="flex-1 overflow-y-auto px-3 pt-1">
        {agruparModulos(modulos).map((grupo) => (
          <div key={grupo.etiqueta} className="mb-4">
            <p className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-tinta-tenue">
              {grupo.etiqueta}
            </p>
            <ul className="space-y-px">
              {grupo.modulos.map((modulo) => {
                const Icono = ICONOS[modulo.clave];
                const activo =
                  pathname === modulo.ruta ||
                  pathname.startsWith(modulo.ruta + "/");

                if (!modulo.disponible) {
                  return (
                    <li key={modulo.clave}>
                      <span
                        title="Disponible más adelante"
                        className="flex cursor-default items-center gap-3 rounded-md px-3 py-2 text-sm text-tinta-tenue"
                      >
                        <Icono className="size-4 shrink-0" aria-hidden />
                        {modulo.nombre}
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={modulo.clave}>
                    <Link
                      href={modulo.ruta}
                      aria-current={activo ? "page" : undefined}
                      className={
                        "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors " +
                        (activo
                          ? "bg-elevado font-medium text-tinta"
                          : "text-tinta-media hover:bg-elevado/60 hover:text-tinta")
                      }
                    >
                      {activo && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-tinta"
                        />
                      )}
                      <Icono className="size-4 shrink-0" aria-hidden />
                      {modulo.nombre}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Accesos externos. Se abren en pestaña nueva: salen de la aplicación y no
          deben tirar abajo un formulario de alta a medio rellenar. La flecha
          diagonal es la señal visual de que el enlace sale fuera. */}
      <div className="shrink-0 border-t border-linea px-3 py-2">
        <ul className="space-y-px">
          {ENLACES_EXTERNOS.map((enlace) => {
            const Icono = ICONOS_EXTERNOS[enlace.clave];
            return (
              <li key={enlace.clave}>
                <a
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={enlace.descripcion}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-tinta-media transition-colors hover:bg-elevado/60 hover:text-tinta"
                >
                  <Icono className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {enlace.nombre}
                  </span>
                  <ArrowUpRight
                    className="size-3.5 shrink-0 text-tinta-tenue"
                    aria-hidden
                  />
                  <span className="sr-only">(se abre en una pestaña nueva)</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>

      {/* El pie ya no lleva "Cerrar sesión": vive en /perfil, junto al resto de
          ajustes de cuenta. Aquí solo queda la entrada a esa pantalla. */}
      <div className="shrink-0 border-t border-linea p-3">
        <Link
          href="/perfil"
          aria-current={enPerfil ? "page" : undefined}
          className={
            "flex items-center gap-3 rounded-md px-3 py-2 transition-colors " +
            (enPerfil ? "bg-elevado" : "hover:bg-elevado")
          }
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-linea bg-elevado text-[11px] font-medium text-tinta">
            {iniciales(usuario.nombre)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm text-tinta">
              {usuario.nombre}
            </span>
            <span className="block truncate text-xs text-tinta-tenue">
              {usuario.email}
            </span>
          </span>
        </Link>
      </div>
    </nav>
  );
}

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}