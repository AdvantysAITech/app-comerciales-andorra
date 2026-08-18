import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { getGoogleAccessToken } from '@/lib/google/oauth'

export async function GET() {
  const user = await getUsuarioSesion()
  if (!user) return NextResponse.json({ error: 'sin_sesion' }, { status: 401 })

  const token = await getGoogleAccessToken(user.id)
  if (!token) {
    return NextResponse.json({ error: 'sin_conexion_google' }, { status: 400 })
  }

  return NextResponse.json({
    accessToken: token,
    apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
    appId:  process.env.NEXT_PUBLIC_GOOGLE_APP_ID,
  })
}