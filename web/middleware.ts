import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { AUTH_COOKIE, parseSessionToken } from '@/lib/auth/core'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/scalp-images') ||
    PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next()
  }

  const session = parseSessionToken(req.cookies.get(AUTH_COOKIE)?.value)
  if (session) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
