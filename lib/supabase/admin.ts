import { createClient } from '@supabase/supabase-js'

/**
 * Cliente con service_role. SOLO servidor.
 * Salta RLS: es la única vía de acceso a google_conexiones,
 * que deliberadamente no tiene políticas.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}