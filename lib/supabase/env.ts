/**
 * Claves de Supabase en un solo sitio.
 *
 * Supabase sustituye las claves JWT antiguas (anon / service_role, empiezan
 * por "eyJ") por las nuevas publishable / secret ("sb_publishable_…" y
 * "sb_secret_…"), y retira las antiguas a finales de 2026. Ambos sistemas
 * conviven, así que aquí se acepta cualquiera de los dos: primero la nueva,
 * y si no está, la antigua.
 *
 * Las NEXT_PUBLIC_ se escriben literalmente (process.env.NEXT_PUBLIC_X) a
 * propósito: Next solo las incrusta en el navegador si aparecen así.
 */

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

/** Clave pública (navegador, servidor con sesión, middleware). */
export function supabaseClavePublica(): string {
  const clave =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!clave) {
    throw new Error(
      "Falta NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (o la antigua NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return clave;
}

/** Clave secreta: salta RLS. SOLO servidor. */
export function supabaseClaveSecreta(): string {
  const clave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clave) {
    throw new Error("Falta SUPABASE_SECRET_KEY (o la antigua SUPABASE_SERVICE_ROLE_KEY)");
  }
  return clave;
}
