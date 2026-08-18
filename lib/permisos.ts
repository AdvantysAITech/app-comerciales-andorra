/**
 * Resuelve quien es el usuario y que modulos puede ver.
 *
 * Deliberadamente sin joins: se consultan `permisos` y `modulos` por separado y se
 * cruzan en memoria. Son tablas de decenas de filas, y asi no dependemos de como
 * este declarada la clave foranea entre `permisos.modulo_clave` y `modulos.clave`.
 */
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { modulosPermitidos, type Modulo } from "@/lib/modulos";

export type Alcance = "propio" | "equipo" | "total";

export type Sesion = {
  usuario: { id: string; nombre: string; email: string };
  modulos: Modulo[];
  /** Alcance por clave de modulo. `propio` = solo sus datos; `todo` = los de todos. */
  alcances: Record<string, Alcance>;
};

export async function sesionActual(): Promise<Sesion | null> {
  const sb = await supabaseServer();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await sb
    .from("profiles")
    .select("id, nombre, email, activo")
    .eq("id", user.id)
    .maybeSingle();

  // Sin perfil o dado de baja: se trata como no autenticado.
  if (!perfil?.activo) return null;

  const [{ data: permisos }, { data: modulosActivos }] = await Promise.all([
    sb.from("permisos").select("modulo_clave, alcance").eq("profile_id", perfil.id),
    sb.from("modulos").select("clave").eq("activo", true),
  ]);

  const activos = new Set((modulosActivos ?? []).map((m) => m.clave));
  const concedidos = (permisos ?? []).filter((p) => activos.has(p.modulo_clave));

  const alcances: Record<string, Alcance> = {};
  for (const p of concedidos) alcances[p.modulo_clave] = p.alcance as Alcance;

  return {
    usuario: {
      id: perfil.id,
      nombre: perfil.nombre ?? perfil.email,
      email: perfil.email,
    },
    modulos: modulosPermitidos(concedidos.map((p) => p.modulo_clave)),
    alcances,
  };
}

/** Atajo para las paginas de modulo: corta si este usuario no lo tiene concedido. */
export function puedeVer(sesion: Sesion, clave: string): boolean {
  return clave in sesion.alcances;
}