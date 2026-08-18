export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

export const GOOGLE_AUTH_URL     = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL    = 'https://oauth2.googleapis.com/token'
export const GOOGLE_REVOKE_URL   = 'https://oauth2.googleapis.com/revoke'
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

export const OAUTH_STATE_COOKIE = 'adv_g_state'

function req(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Variable de entorno no definida: ${name}`)
  return v
}

export function googleEnv() {
  return {
    clientId:     req('GOOGLE_CLIENT_ID'),
    clientSecret: req('GOOGLE_CLIENT_SECRET'),
    redirectUri:  req('GOOGLE_REDIRECT_URI'),
  }
}