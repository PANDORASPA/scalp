import { getStaffUsers } from './users'

export type AuthSession = {
  username: string
  name: string
  role: 'admin' | 'staff'
}

export const AUTH_COOKIE = 'scalp_auth'

export function createSessionToken(session: AuthSession) {
  return Buffer.from(JSON.stringify(session), 'utf8').toString('base64url')
}

export function parseSessionToken(token: string | undefined) {
  if (!token) return null

  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as AuthSession
    if (!parsed.username || !parsed.role) return null
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
