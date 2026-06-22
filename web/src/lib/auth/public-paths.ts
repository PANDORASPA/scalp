const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']

export function isPublicPath(pathname: string) {
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/scalp-images')
  ) {
    return true
  }

  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}
