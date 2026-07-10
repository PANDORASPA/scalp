import { NextResponse } from 'next/server'

import { readJsonBody } from '@/lib/api/json'
import { requireAuthRole } from '@/lib/auth/session'
import { saveConfirmedAnnotations, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ imageId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { imageId } = await params
  const parsed = await readJsonBody<{ annotations?: unknown }>(req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const body = parsed.body
  if (!body.annotations) {
    return NextResponse.json({ error: 'annotations_required' }, { status: 400 })
  }

  try {
    const result = await saveConfirmedAnnotations(imageId, body.annotations)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
