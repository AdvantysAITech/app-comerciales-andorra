import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";

export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseClavePublica(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component, donde las cookies son de solo lectura.
            // No es un fallo: el middleware ya se encarga de refrescar la sesion.
          }
        },
      },
    },
  );
}