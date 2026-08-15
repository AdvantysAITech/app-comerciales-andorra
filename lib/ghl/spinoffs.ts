import "server-only";
import { ghl, locationId } from "./client";
import { OBJETO_SPINOFF } from "./ids";

export type Spinoff = { id: string; nombre: string; estado?: string };

type RegistroGhl = { id: string; properties?: Record<string, unknown> };

/**
 * Listado vivo desde el objeto personalizado Spin-off.
 * Cacheado 5 min: cambia muy poco y se consulta en cada alta de lead.
 */
export async function listarSpinoffs(): Promise<Spinoff[]> {
  const data = await ghl<{ records?: RegistroGhl[] }>(
    `/objects/${OBJETO_SPINOFF.key}/records/search`,
    {
      method: "POST",
      body: { locationId: locationId(), page: 1, pageLimit: 50, query: "", searchAfter: [] },
      revalidate: 300,
    },
  );

  return (data.records ?? [])
    .map((r) => {
      const p = r.properties ?? {};
      // GHL devuelve las propiedades unas veces con clave corta y otras con la
      // clave completa del objeto. Probamos ambas antes de rendirnos.
      const nombre =
        (p["nombre_de_la_spin_off"] as string) ??
        (p[OBJETO_SPINOFF.propNombre] as string) ??
        "";
      const estado = (p["estado_global"] as string) ?? undefined;
      return { id: r.id, nombre, estado };
    })
    .filter((s) => s.nombre)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}