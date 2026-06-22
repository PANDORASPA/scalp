import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { AUTH_COOKIE, authenticateUser, createSessionToken } from '@/lib/auth/core'

export async function POST(req: Request) {
  const body = (await req.json()) as { username?: string; password?: string }
  const username = (body.username ?? '').trim()
  const password = (body.password ?? '').trim()

  if (!username || !password) {
    return NextResponse.json({ error: 'username_and_password_required' }, { status: 400 })
  }

  const session = authenticateUser(username, password)
  if (!session) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  const jar = await cookies()
  jar.set(AUTH_COOKIE, await createSessionToken(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 12,
    path: '/',
  })

  return NextResponse.json({ ok: true, session })
}
