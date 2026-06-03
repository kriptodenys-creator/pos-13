const COOKIE_NAME = 'admin_session'

export function getAdminSessionCookieName() {
  return COOKIE_NAME
}

function base64UrlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function bytesFromBase64Url(input: string): Uint8Array {
  let s = input.replaceAll('-', '+').replaceAll('_', '/')
  while (s.length % 4 !== 0) s += '='
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function getSecret(): string {
  const secret = process.env.ADMIN_AUTH_SECRET
  if (secret && secret.trim()) return secret

  // Fallback to NextAuth secret if present in environment
  const alt = process.env.NEXTAUTH_SECRET
  if (alt && alt.trim()) return alt

  // Last resort: deterministic but weak fallback. Recommend setting ADMIN_AUTH_SECRET.
  return 'dev-insecure-admin-auth-secret'
}

type AdminSessionPayload = {
  iat: number
  exp: number
}

async function hmacSha256Base64Url(data: string): Promise<string> {
  const secret = getSecret()
  const enc = new TextEncoder()

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return base64UrlFromBytes(new Uint8Array(sig))
}

export async function createAdminSessionToken(ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const payload: AdminSessionPayload = {
    iat: now,
    exp: now + ttlSeconds,
  }

  const body = base64UrlFromBytes(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmacSha256Base64Url(body)
  return `${body}.${sig}`
}

export async function verifyAdminSessionToken(
  token: string | undefined | null
): Promise<{ valid: boolean; payload?: AdminSessionPayload }> {
  if (!token) return { valid: false }
  const [body, sig] = token.split('.')
  if (!body || !sig) return { valid: false }

  const expected = await hmacSha256Base64Url(body)
  if (expected.length !== sig.length) return { valid: false }
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  if (diff !== 0) return { valid: false }

  try {
    const json = new TextDecoder().decode(bytesFromBase64Url(body))
    const payload = JSON.parse(json) as AdminSessionPayload
    if (!payload?.exp) return { valid: false }

    const now = Math.floor(Date.now() / 1000)
    if (now >= payload.exp) return { valid: false }

    return { valid: true, payload }
  } catch {
    return { valid: false }
  }
}
