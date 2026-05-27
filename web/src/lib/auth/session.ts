import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { AUTH_COOKIE, authenticateUser, createSessionToken, parseSessionToken } from './core'

export { AUTH_COOKIE, authenticateUser, createSessionToken, parseSessionToken }
export type { AuthSession } from './core'

export async function getAuthSession() {
  const jar = await cookies()
  return parseSessionToken(jar.get(AUTH_COOKIE)?.value)
}

export async function requireAuthRole(roles?: Array<'admin' | 'staff'>) {
  const session = await getAuthSession()
  if (!session) {
    return { ok: false as const, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  }
  if (roles && !roles.includes(session.role)) {
    return { ok: false as const, response: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }
  return { ok: true as const, session }
}
