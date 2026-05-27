import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { isAreaKey } from '@/lib/scalp-analysis/logic'
import { uploadScalpImage, toScalpAnalysisError } from '@/lib/scalp-analysis/service'

export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function toImageIndex(value: FormDataEntryValue | null): 1 | 2 | 3 | null {
  const n = Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return null
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const form = await req.formData()
  const sessionId = form.get('sessionId')?.toString() ?? ''
  const customerId = form.get('customerId')?.toString() ?? ''
  const areaKey = form.get('areaKey')?.toString() ?? ''
  const imageIndex = toImageIndex(form.get('imageIndex'))
  const file = form.get('file')

  if (!sessionId || !customerId || !areaKey || !imageIndex) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }
  if (!isAreaKey(areaKey)) {
    return NextResponse.json({ error: 'invalid_area_key' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }

  try {
    const image = await uploadScalpImage({
      sessionId,
      customerId,
      areaKey,
      imageIndex,
      file,
    })
    return NextResponse.json(image)
  } catch (error) {
    return NextResponse.json({ error: toScalpAnalysisError(error) }, { status: 500 })
  }
}
