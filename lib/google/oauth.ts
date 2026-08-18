import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_REVOKE_URL,
  GOOGLE_USERINFO_URL,
  GOOGLE_SCOPES,
  googleEnv,
} from './config'

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type: string
}

export function buildAuthUrl(state: string): string {
  const { clientId, redirectUri } = googleEnv()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',   // imprescindible para obtener refresh_token
    prompt: 'consent',        // fuerza que Google lo devuelva aunque ya haya consentido
    include_granted_scopes: 'true',
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const { clientId, clientSecret, redirectUri } = googleEnv()

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    throw new Error(`Intercambio de código falló: ${await res.text()}`)
  }
  return res.json()
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.email ?? null
}

export async function saveConnection(
  userId: string,
  tokens: TokenResponse,
  email: string | null,
) {
  const supabase = createAdminClient()
  const expiraEn = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  // Si Google no devuelve refresh_token (reconsentimiento), conservamos el guardado.
  let refreshToken = tokens.refresh_token
  if (!refreshToken) {
    const { data } = await supabase
      .from('google_conexiones')
      .select('refresh_token')
      .eq('user_id', userId)
      .maybeSingle()
    refreshToken = data?.refresh_token
  }
  if (!refreshToken) {
    throw new Error(
      'Google no devolvió refresh_token. Revoca el acceso en ' +
      'myaccount.google.com/permissions y vuelve a conectar.',
    )
  }

  const { error } = await supabase.from('google_conexiones').upsert(
    {
      user_id: userId,
      email_google: email,
      refresh_token: refreshToken,
      access_token: tokens.access_token,
      expira_en: expiraEn,
      scope: tokens.scope ?? GOOGLE_SCOPES,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw new Error(`No se pudo guardar la conexión: ${error.message}`)
}

/**
 * Devuelve un access_token válido, refrescándolo si quedan <2 min.
 * null si el usuario no ha conectado Google.
 */
export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: conn } = await supabase
    .from('google_conexiones')
    .select('access_token, refresh_token, expira_en')
    .eq('user_id', userId)
    .maybeSingle()

  if (!conn) return null

  const margen = 120_000
  if (conn.access_token && conn.expira_en &&
      new Date(conn.expira_en).getTime() - Date.now() > margen) {
    return conn.access_token
  }

  const { clientId, clientSecret } = googleEnv()
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    // refresh_token revocado o caducado: limpiamos para forzar reconexión
    await supabase.from('google_conexiones').delete().eq('user_id', userId)
    return null
  }

  const tokens: TokenResponse = await res.json()
  await supabase
    .from('google_conexiones')
    .update({
      access_token: tokens.access_token,
      expira_en: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    })
    .eq('user_id', userId)

  return tokens.access_token
}

export async function revokeConnection(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('google_conexiones')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (data?.refresh_token) {
    await fetch(GOOGLE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token: data.refresh_token }),
    }).catch(() => {})
  }
  await supabase.from('google_conexiones').delete().eq('user_id', userId)
}   