import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { sesionActual } from "@/lib/permisos";
import { InterruptorTema } from "@/components/tema/interruptor-tema";

/**
 * Configuracion del usuario.
 *
 * La navbar ya enlazaba a /perfil, pero la ruta no existia: hasta ahora daba 404.
 * De momento es solo lectura salvo la apariencia; cuando exista el modulo de
 * Administracion, el cambio de nombre y contrasena entra aqui.
 */
const ALCANCES: Record<string, string> = {
  propio: "Solo sus propios registros",
  equipo: "Los registros de su equipo",
  total: "Todos los registros",
};

export default async function Perfil() {
  const sesion = await sesionActual();
  if (!sesion) redirect("/login");

  return (
    <div className="space-y-10">
      <header>
        <p className="traza">Configuración</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Mi perfil</h1>
      </header>

      <section className="tarjeta">
        <h2 className="text-sm font-medium">Cuenta</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-tinta-tenue">Nombre</dt>
            <dd className="mt-0.5 text-sm">{sesion.usuario.nombre}</dd>
          </div>
          <div>
            <dt className="text-xs text-tinta-tenue">Email</dt>
            <dd className="mt-0.5 truncate text-sm">{sesion.usuario.email}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-tinta-tenue">
          Para cambiar nombre, email o permisos, contacta con Jacob.
        </p>
      </section>

      <section className="tarjeta">
        <h2 className="text-sm font-medium">Apariencia</h2>
        <p className="mt-1 mb-4 text-sm text-tinta-media">
          Cómo se ve la plataforma en este dispositivo.
        </p>
        <InterruptorTema />
      </section>

      <section className="tarjeta">
        <h2 className="text-sm font-medium">Módulos con acceso</h2>
        <ul className="mt-4 divide-y divide-linea">
          {sesion.modulos.map((modulo) => (
            <li
              key={modulo.clave}
              className="flex items-baseline justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="text-sm">
                  {modulo.nombre}
                  {!modulo.disponible && (
                    <span className="ml-2 text-xs text-tinta-tenue">
                      (en construcción)
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-tinta-tenue">
                  {modulo.descripcion}
                </p>
              </div>
              <span className="shrink-0 text-xs text-tinta-media">
                {ALCANCES[sesion.alcances[modulo.clave]] ?? "—"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <form action="/auth/logout" method="post">
        <button type="submit" className="boton-fantasma">
          <LogOut className="size-4" aria-hidden />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}