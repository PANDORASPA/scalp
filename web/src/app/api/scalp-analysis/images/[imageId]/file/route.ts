import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { getTrackingImageById } from '@/lib/scalp-analysis/repository'
import { getScalpStorageAdapter } from '@/lib/scalp-analysis/storage'
import { toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { imageId } = await params
  try {
    const image = await getTrackingImageById(imageId)
    if (!image || image.storage_provider !== 'google-drive' || !image.drive_file_id) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const adapter = await getScalpStorageAdapter(image.storage_provider)
    if (!adapter.download) {
      return NextResponse.json({ error: 'private_image_proxy_unavailable' }, { status: 501 })
    }

    const file = await adapter.download(image.drive_file_id)
    return new NextResponse(file.bytes, {
      headers: {
        'Content-Type': file.contentType,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
