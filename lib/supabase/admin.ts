import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseClaveSecreta, supabaseUrl } from '@/lib/supabase/env'

/**
 * Cliente con la clave secreta (o service_role antigua). SOLO servidor.
 * Salta RLS: es la única vía de acceso a google_conexiones,
 * que deliberadamente no tiene políticas.
 */
export function createAdminClient() {
  return createClient(supabaseUrl(), supabaseClaveSecreta(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}