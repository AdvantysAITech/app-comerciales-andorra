import { NextResponse } from 'next/server'
import { getUsuarioSesion } from '@/lib/supabase/route-auth'
import { exchangeCode, fetchGoogleEmail, saveConnection } from '@/lib/google/oauth'
import { OAUTH_STATE_COOKIE } from '@/lib/google/config'

const DESTINO = '/consultoria'

function fallo(request: Request, motivo: string) {
  const url = new URL(DESTINO, request.url)
  url.searchParams.set('google', 'error')
  url.searchParams.set('motivo', motivo)
  return NextResponse.redirect(url)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) return fallo(request, error)
  if (!code || !state) return fallo(request, 'respuesta_incompleta')

  const user = await getUsuarioSesion()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  // Validación CSRF
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  if (cookieStore.get(OAUTH_STATE_COOKIE)?.value !== state) {
    return fallo(request, 'state_invalido')
  }

  try {
    const tokens = await exchangeCode(code)
    const email  = await fetchGoogleEmail(tokens.access_token)
    await saveConnection(user.id, tokens, email)
  } catch (e) {
    console.error('[google/callback]', e)
    return fallo(request, 'intercambio_fallido')
  }

  const url = new URL(DESTINO, request.url)
  url.searchParams.set('google', 'ok')
  const response = NextResponse.redirect(url)
  response.cookies.delete(OAUTH_STATE_COOKIE)
  return response
}