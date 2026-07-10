import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { readJsonBody } from '@/lib/api/json'
import { AUTH_COOKIE, authenticateUser, createSessionToken } from '@/lib/auth/core'
import {
  buildLoginRateLimitKey,
  checkLoginRateLimit,
  clearLoginFailures,
  recordLoginFailure,
} from '@/lib/auth/login-rate-limit'

function getClientIp(req: Request) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

export async function POST(req: Request) {
  const parsed = await readJsonBody<{ username?: string; password?: string }>(req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const body = parsed.body
  const username = (body.username ?? '').trim()
  const password = (body.password ?? '').trim()

  if (!username || !password) {
    return NextResponse.json({ error: 'username_and_password_required' }, { status: 400 })
  }

  const rateLimitKey = buildLoginRateLimitKey({ ip: getClientIp(req), username })
  const limit = checkLoginRateLimit(rateLimitKey)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'too_many_login_attempts', retry_after_seconds: limit.retryAfterSeconds },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfterSeconds),
        },
      },
    )
  }

  const session = authenticateUser(username, password)
  if (!session) {
    recordLoginFailure(rateLimitKey)
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  clearLoginFailures(rateLimitKey)
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
