import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseClavePublica, supabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase con la sesión del usuario, para Route Handlers.
 * Independiente de lib/supabase/server.ts a propósito.
 */
export async function getSupabaseRoute() {
  const cookieStore = await cookies()

  return createServerClient(
    supabaseUrl(),
    supabaseClavePublica(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // En Server Components set() lanza; el middleware ya refresca la sesión.
          }
        },
      },
    },
  )
}

/** Devuelve el usuario autenticado, o null. */
export async function getUsuarioSesion() {
  const supabase = await getSupabaseRoute()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}