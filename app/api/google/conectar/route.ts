import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { buildAuthUrl } from '@/lib/google/oauth'
import { OAUTH_STATE_COOKIE } from '@/lib/google/config'

export async function GET(request: Request) {
  const user = await getUsuarioSesion()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(buildAuthUrl(state))

  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',   // 'strict' rompería el callback de Google
    path: '/',
    maxAge: 600,
  })
  return response
}