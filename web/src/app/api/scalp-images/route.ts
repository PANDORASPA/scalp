import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { buildHairCountShotAnalysis } from '@/lib/scalp/ai'
import { isCapturePointCode } from '@/lib/scalp/logic'
import { syncSessionPointDerivedData } from '@/lib/scalp/pipeline'
import { runHairCountInference } from '@/lib/scalp/providers'
import {
  deleteImageBySessionPointShotInSupabase,
  getCustomerSnapshot,
  replaceDerivedPointDataInSupabase,
  seedCapturePointsIfNeeded,
  toRepositoryError,
  touchCustomerInSupabase,
  upsertAiShotAnalysisInSupabase,
  upsertImageRecordInSupabase,
  upsertMetricsInSupabase,
} from '@/lib/supabase/repository'
import {
  buildScalpImageStoragePath,
  deleteScalpImages,
  uploadScalpImage,
} from '@/lib/supabase/storage'
import type { MetricInput, ScalpImage, ScalpImageMetrics, ScalpPointSummary } from '@/lib/scalp/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type SaveImageResult =
  | {
      error: 'file_required'
    }
  | {
      image: ScalpImage
      metrics: ScalpImageMetrics
      summary: ScalpPointSummary | undefined
    }

function toShotIndex(value: FormDataEntryValue | null): 1 | 2 | 3 | null {
  const n = Number(value)
  if (n === 1 || n === 2 || n === 3) return n
  return null
}

function toNullableNumber(value: FormDataEntryValue | null) {
  if (value === null) return null
  const s = value.toString().trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function hasValidMetricRange(metrics: MetricInput) {
  return Object.values(metrics).every((value) => {
    if (value === null || value === undefined) return true
    return value >= 0 && value <= 10
  })
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const form = await req.formData()

  const customerId = form.get('customer_id')?.toString() ?? ''
  const sessionId = form.get('session_id')?.toString() ?? ''
  const capturePointCodeRaw = form.get('capture_point_code')?.toString() ?? ''
  const shotIndex = toShotIndex(form.get('shot_index'))
  const imageType = (form.get('image_type')?.toString() ?? 'micro') as 'micro'
  const magnification = form.get('magnification')?.toString().trim() || null
  const lightingMode = form.get('lighting_mode')?.toString().trim() || null
  const hairState = form.get('hair_state')?.toString().trim() || null
  const file = form.get('file')

  if (!customerId || !sessionId || !shotIndex) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }
  if (!isCapturePointCode(capturePointCodeRaw)) {
    return NextResponse.json({ error: 'invalid_capture_point_code' }, { status: 400 })
  }
  if (file instanceof File) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'invalid_file_type' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
    }
  }
  const metrics: MetricInput = {
    oil_score: toNullableNumber(form.get('oil_score')),
    redness_score: toNullableNumber(form.get('redness_score')),
    density_score: toNullableNumber(form.get('density_score')),
    blockage_score: toNullableNumber(form.get('blockage_score')),
    dandruff_score: toNullableNumber(form.get('dandruff_score')),
    sensitivity_score: toNullableNumber(form.get('sensitivity_score')),
  }
  if (!hasValidMetricRange(metrics)) {
    return NextResponse.json({ error: 'invalid_metric_range' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const capturePointCode = capturePointCodeRaw

  if (hasSupabaseServerEnv()) {
    try {
      await seedCapturePointsIfNeeded()
      const existingFile = file instanceof File ? file : null
      const storagePath = buildScalpImageStoragePath({
        customerId,
        sessionId,
        capturePointCode,
        shotIndex,
      })
      const imageUrl = existingFile
        ? await uploadScalpImage({
            path: storagePath,
            bytes: Buffer.from(await existingFile.arrayBuffer()),
            contentType: existingFile.type || 'image/jpeg',
          })
        : null

      const image = await upsertImageRecordInSupabase({
        customerId,
        sessionId,
        capturePointCode,
        shotIndex,
        imageType,
        magnification,
        lightingMode,
        hairState,
        imageUrl: imageUrl ?? '',
        nowISO: now,
      })

      const metricsRow = await upsertMetricsInSupabase({
        imageId: image.id,
        metrics: {
          oil_score: metrics.oil_score ?? null,
          redness_score: metrics.redness_score ?? null,
          density_score: metrics.density_score ?? null,
          blockage_score: metrics.blockage_score ?? null,
          dandruff_score: metrics.dandruff_score ?? null,
          sensitivity_score: metrics.sensitivity_score ?? null,
        },
        nowISO: now,
      })

      const providerResult = await runHairCountInference({
        customerId,
        sessionId,
        imageId: image.id,
        imageUrl: image.image_url,
        capturePointCode,
        shotIndex,
        metrics,
        nowISO: now,
      })
      const shotAnalysis = buildHairCountShotAnalysis({
        customerId,
        sessionId,
        imageId: image.id,
        capturePointCode,
        shotIndex,
        nowISO: now,
        result: providerResult,
      })
      await upsertAiShotAnalysisInSupabase(shotAnalysis)

      const snapshot = await getCustomerSnapshot(customerId)
      syncSessionPointDerivedData({
        db: snapshot,
        customerId,
        sessionId,
        capturePointCode,
        nowISO: now,
      })
      await replaceDerivedPointDataInSupabase({
        customerId,
        capturePointCode,
        snapshot,
      })
      await touchCustomerInSupabase(customerId, now)

      const summary = snapshot.pointSummaries.find(
        (pointSummary) =>
          pointSummary.session_id === sessionId && pointSummary.capture_point_code === capturePointCode,
      )

      return NextResponse.json({
        image,
        metrics: metricsRow,
        summary,
      })
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb<SaveImageResult>(async (db) => {
    const existingImageIndex = db.images.findIndex(
      (i) =>
        i.session_id === sessionId &&
        i.capture_point_code === capturePointCode &&
        i.shot_index === shotIndex,
    )

    const existingImage = existingImageIndex === -1 ? null : db.images[existingImageIndex]
    if (!(file instanceof File) && !existingImage) {
      return {
        db,
        result: { error: 'file_required' as const },
      }
    }

    let imageUrl =
      existingImage?.image_url ??
      `/scalp-images/${customerId}/${sessionId}/${capturePointCode}/${shotIndex}.jpg`

    if (file instanceof File) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const destDir = path.join(
        process.cwd(),
        'public',
        'scalp-images',
        customerId,
        sessionId,
        capturePointCode,
      )
      await mkdir(destDir, { recursive: true })
      const destPath = path.join(destDir, `${shotIndex}.jpg`)
      await writeFile(destPath, bytes)
      imageUrl = `/scalp-images/${customerId}/${sessionId}/${capturePointCode}/${shotIndex}.jpg`
    }

    let image: ScalpImage
    if (existingImageIndex === -1) {
      image = {
        id: crypto.randomUUID(),
        customer_id: customerId,
        session_id: sessionId,
        capture_point_code: capturePointCode,
        shot_index: shotIndex,
        image_type: imageType,
        magnification,
        lighting_mode: lightingMode,
        hair_state: hairState,
        image_url: imageUrl,
        created_at: now,
        updated_at: now,
      }
      db.images.push(image)
    } else {
      const current = db.images[existingImageIndex]
      image = {
        ...current,
        image_type: imageType,
        magnification,
        lighting_mode: lightingMode,
        hair_state: hairState,
        image_url: imageUrl,
        updated_at: now,
      }
      db.images[existingImageIndex] = image
    }

    const existingMetricsIndex = db.metrics.findIndex((m) => m.image_id === image.id)
    let metricsRow: ScalpImageMetrics
    if (existingMetricsIndex === -1) {
      metricsRow = {
        id: crypto.randomUUID(),
        image_id: image.id,
        oil_score: metrics.oil_score ?? null,
        redness_score: metrics.redness_score ?? null,
        density_score: metrics.density_score ?? null,
        blockage_score: metrics.blockage_score ?? null,
        dandruff_score: metrics.dandruff_score ?? null,
        sensitivity_score: metrics.sensitivity_score ?? null,
        created_at: now,
        updated_at: now,
      }
      db.metrics.push(metricsRow)
    } else {
      const current = db.metrics[existingMetricsIndex]
      metricsRow = {
        ...current,
        oil_score: metrics.oil_score ?? null,
        redness_score: metrics.redness_score ?? null,
        density_score: metrics.density_score ?? null,
        blockage_score: metrics.blockage_score ?? null,
        dandruff_score: metrics.dandruff_score ?? null,
        sensitivity_score: metrics.sensitivity_score ?? null,
        updated_at: now,
      }
      db.metrics[existingMetricsIndex] = metricsRow
    }

    const existingShotAnalysis = db.aiShotAnalyses.find((item) => item.image_id === image.id)
    const providerResult = await runHairCountInference({
      customerId,
      sessionId,
      imageId: image.id,
      imageUrl: image.image_url,
      capturePointCode,
      shotIndex,
      metrics,
      nowISO: now,
    })
    const shotAnalysis = buildHairCountShotAnalysis({
      customerId,
      sessionId,
      imageId: image.id,
      capturePointCode,
      shotIndex,
      nowISO: now,
      result: providerResult,
      existing: existingShotAnalysis,
    })
    const shotAnalysisIdx = db.aiShotAnalyses.findIndex((item) => item.id === shotAnalysis.id)
    if (shotAnalysisIdx === -1) db.aiShotAnalyses.push(shotAnalysis)
    else db.aiShotAnalyses[shotAnalysisIdx] = shotAnalysis

    syncSessionPointDerivedData({
      db,
      customerId,
      sessionId,
      capturePointCode,
      nowISO: now,
    })

    const summary = db.pointSummaries.find(
      (pointSummary) =>
        pointSummary.session_id === sessionId && pointSummary.capture_point_code === capturePointCode,
    )

    const session = db.sessions.find((s) => s.id === sessionId)
    if (session) session.updated_at = now
    const customer = db.customers.find((c) => c.id === customerId)
    if (customer) customer.updated_at = now

    return {
      db,
      result: {
        image,
        metrics: metricsRow,
        summary,
      },
    }
  })

  if ('error' in result) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json(result)
}

export async function DELETE(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const sessionId = url.searchParams.get('sessionId') ?? ''
  const capturePointCode = url.searchParams.get('capturePointCode') ?? ''
  const shotIndex = toShotIndex(url.searchParams.get('shotIndex'))

  if (!sessionId || !shotIndex || !isCapturePointCode(capturePointCode)) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }

  if (hasSupabaseServerEnv()) {
    try {
      const deleted = await deleteImageBySessionPointShotInSupabase({
        sessionId,
        capturePointCode,
        shotIndex,
      })
      if (!deleted) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      await deleteScalpImages([
        buildScalpImageStoragePath({
          customerId: deleted.customer_id,
          sessionId: deleted.session_id,
          capturePointCode: deleted.capture_point_code,
          shotIndex: deleted.shot_index,
        }),
      ])
      const now = new Date().toISOString()
      const snapshot = await getCustomerSnapshot(deleted.customer_id)
      syncSessionPointDerivedData({
        db: snapshot,
        customerId: deleted.customer_id,
        sessionId,
        capturePointCode,
        nowISO: now,
      })
      await replaceDerivedPointDataInSupabase({
        customerId: deleted.customer_id,
        capturePointCode,
        snapshot,
      })
      await touchCustomerInSupabase(deleted.customer_id, now)
      return NextResponse.json(deleted)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const deleted = await updateDb(async (db) => {
    const image = db.images.find(
      (img) =>
        img.session_id === sessionId &&
        img.capture_point_code === capturePointCode &&
        img.shot_index === shotIndex,
    )

    if (!image) return { db, result: null as ScalpImage | null }

    db.images = db.images.filter((img) => img.id !== image.id)
    db.metrics = db.metrics.filter((m) => m.image_id !== image.id)
    db.aiShotAnalyses = db.aiShotAnalyses.filter((item) => item.image_id !== image.id)
    const now = new Date().toISOString()
    syncSessionPointDerivedData({
      db,
      customerId: image.customer_id,
      sessionId,
      capturePointCode,
      nowISO: now,
    })
    const session = db.sessions.find((item) => item.id === sessionId)
    if (session) session.updated_at = now
    const customer = db.customers.find((item) => item.id === image.customer_id)
    if (customer) customer.updated_at = now

    return { db, result: image }
  })

  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const filePath = path.join(
    process.cwd(),
    'public',
    'scalp-images',
    deleted.customer_id,
    deleted.session_id,
    deleted.capture_point_code,
    `${deleted.shot_index}.jpg`,
  )
  await rm(filePath, { force: true })

  return NextResponse.json(deleted)
}
