import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { revokeConnection } from '@/lib/google/oauth'

export async function POST() {
  const user = await getUsuarioSesion()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  await revokeConnection(user.id)
  return NextResponse.json({ ok: true })
}