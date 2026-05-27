import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { removeScalpImage, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { imageId } = await params
  try {
    const deleted = await removeScalpImage(imageId)
    return NextResponse.json(deleted)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
