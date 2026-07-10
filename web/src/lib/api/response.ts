import { NextResponse } from 'next/server'

export function jsonNoStore<T>(body: T, init?: ResponseInit): NextResponse<T> {
  const response = NextResponse.json(body, init)
  response.headers.set('Cache-Control', 'no-store, max-age=0')
  return response
}
