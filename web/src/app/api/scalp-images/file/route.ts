import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { downloadScalpImage } from '@/lib/supabase/storage'
import { isAllowedScalpImageStoragePath } from '@/lib/supabase/storage-path'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const rawPath = new URL(req.url).searchParams.get('path')?.trim() ?? ''
  if (!isAllowedScalpImageStoragePath(rawPath)) {
    return NextResponse.json({ error: 'invalid_image_path' }, { status: 400 })
  }

  try {
    const file = await downloadScalpImage(rawPath)
    return new NextResponse(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return NextResponse.json({ error: 'image_not_found' }, { status: 404 })
  }
}
