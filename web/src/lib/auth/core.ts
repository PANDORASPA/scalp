import { getStaffUsers } from './users'

export type AuthSession = {
  username: string
  name: string
  role: 'admin' | 'staff'
}

export const AUTH_COOKIE = 'scalp_auth'

const FALLBACK_SESSION_SECRET = 'dev-only-insecure-session-secret'

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET?.trim() || FALLBACK_SESSION_SECRET
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function hmacSha256(value: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export async function createSessionToken(session: AuthSession) {
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)))
  const signature = bytesToBase64Url(await hmacSha256(payload))
  return `v1.${payload}.${signature}`
}

export async function parseSessionToken(token: string | undefined) {
  if (!token) return null

  try {
    const [version, payload, signature] = token.split('.')
    if (version !== 'v1' || !payload || !signature) return null
    const expectedSignature = bytesToBase64Url(await hmacSha256(payload))
    if (!safeEqual(signature, expectedSignature)) return null

    const parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AuthSession
    if (!parsed.username || !parsed.role) return null
    if (parsed.role !== 'admin' && parsed.role !== 'staff') return null
    return parsed
  } catch {
    return null
  }
}

export function authenticateUser(username: string, password: string) {
  const user = getStaffUsers().find((item) => item.username === username && item.password === password)
  if (!user) return null
  return {
    username: user.username,
    name: user.name,
    role: user.role,
  } satisfies AuthSession
}
