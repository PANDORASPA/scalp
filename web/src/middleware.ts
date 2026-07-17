import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { AUTH_COOKIE, parseSessionToken } from '@/lib/auth/core'
import { isPublicPath } from '@/lib/auth/public-paths'

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const session = await parseSessionToken(req.cookies.get(AUTH_COOKIE)?.value)
  if (session) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', `${pathname}${req.nextUrl.search}`)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
