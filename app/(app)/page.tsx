import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/permisos";

/**
 * Punto de entrada tras el login. No pinta nada propio: manda al primer módulo
 * que este usuario tenga concedido, en el orden del catálogo de lib/modulos.ts.
 *
 * Antes esta decisión estaba en el middleware, cableada a /leads. Aquí el
 * orden lo marca MODULOS y basta con reordenar ese array para cambiarlo.
 */
export default async function Inicio() {
  const sesion = await sesionActual();

  // El layout ya corta si no hay sesión; esto es solo para el tipo.
  if (!sesion) redirect("/login");

  const destino = sesion.modulos.find((m) => m.disponible);
  if (destino) redirect(destino.ruta);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <p className="max-w-sm text-center text-sm text-tinta-tenue">
        Tu usuario todavía no tiene ningún módulo asignado. Avisa a Jacob para que
        te dé acceso.
      </p>
    </div>
  );
}