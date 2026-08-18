import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const user = await getUsuarioSesion()
  if (!user) return NextResponse.json({ conectado: false }, { status: 401 })

  const { data } = await createAdminClient()
    .from('google_conexiones')
    .select('email_google, expira_en')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    conectado: Boolean(data),
    email: data?.email_google ?? null,
  })
}