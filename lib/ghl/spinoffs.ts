import "server-only";
import { ghl, locationId } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { OBJETO_SPINOFF } from "./ids";

export type Spinoff = {
  /** Clave estable de negocio: educacion · agro · residencia · hospitality.
   *  Es la que viaja en el formulario y se guarda en el lead. */
  clave: string;
  /** Id del registro en GHL. Solo se usa para crear la asociación. */
  ghlId: string;
  nombre: string;
  estado?: string;
};

type RegistroGhl = { id: string; properties?: Record<string, unknown> };

/** GHL devuelve las propiedades unas veces con clave corta y otras con la clave
 *  completa del objeto. Se prueban ambas antes de rendirse. */
function propiedad(p: Record<string, unknown>, corta: string, larga: string) {
  return (p[corta] as string) ?? (p[larga] as string) ?? "";
}

/** Lectura directa desde GHL. Solo la usa la sincronización. */
export async function leerSpinoffsDeGhl(): Promise<Spinoff[]> {
  const data = await ghl<{ records?: RegistroGhl[] }>(
    `/objects/${OBJETO_SPINOFF.key}/records/search`,
    {
      method: "POST",
      body: { locationId: locationId(), page: 1, pageLimit: 50, query: "", searchAfter: [] },
    },
  );

  return (data.records ?? [])
    .map((r) => {
      const p = r.properties ?? {};
      return {
        clave: propiedad(p, "clave_interna", OBJETO_SPINOFF.propClave).trim().toLowerCase(),
        ghlId: r.id,
        nombre: propiedad(p, "nombre_de_la_spin_off", OBJETO_SPINOFF.propNombre),
        estado: (p["estado_global"] as string) ?? undefined,
      };
    })
    // Una spin-off sin clave interna no entra en la caché: sin ella no hay
    // referencia estable y el lead quedaría atado a un id de GHL.
    .filter((s) => s.clave && s.nombre);
}

/** Refresca la caché. Devuelve cuántas ha sincronizado. */
export async function sincronizarSpinoffs(): Promise<number> {
  const spinoffs = await leerSpinoffsDeGhl();
  if (spinoffs.length === 0) {
    throw new Error("GHL no devolvió ninguna spin-off con clave interna");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("spinoffs_cache").upsert(
    spinoffs.map((s) => ({
      clave_interna: s.clave,
      ghl_id: s.ghlId,
      nombre: s.nombre,
      estado: s.estado ?? null,
      actualizado_en: new Date().toISOString(),
    })),
    { onConflict: "clave_interna" },
  );

  if (error) throw new Error(`No se pudo escribir la caché: ${error.message}`);
  return spinoffs.length;
}