import { rm } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { readJsonBody } from '@/lib/api/json'
import { requireAuthRole } from '@/lib/auth/session'
import { shouldUseSupabaseDataSource } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { cleanupScalpImageStorageRefs } from '@/lib/scalp-analysis/storage-cleanup'
import {
  deleteSessionInSupabase,
  getImageStorageRefsForSessionFromSupabase,
  getSessionFromSupabase,
  toRepositoryError,
  touchCustomerInSupabase,
  updateSessionInSupabase,
} from '@/lib/supabase/repository'
import type { ScalpSession } from '@/lib/scalp/types'

export const runtime = 'nodejs'

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime())
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params

  if (shouldUseSupabaseDataSource()) {
    try {
      const result = await getSessionFromSupabase(sessionId)
      if (!result) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const session = db.sessions.find((s) => s.id === sessionId) ?? null
    return { db, result: session }
  })

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(result)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params
  const parsed = await readJsonBody<Partial<ScalpSession>>(req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const body = parsed.body
  const nextCheckDate = (body.check_date ?? '').toString()
  if (body.check_date !== undefined && !isValidDate(nextCheckDate)) {
    return NextResponse.json({ error: 'invalid_check_date' }, { status: 400 })
  }

  if (shouldUseSupabaseDataSource()) {
    try {
      const current = await getSessionFromSupabase(sessionId)
      if (!current) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const now = new Date().toISOString()
      const updated = await updateSessionInSupabase(sessionId, {
        check_date: body.check_date === undefined ? current.check_date : nextCheckDate,
        staff_name:
          body.staff_name === undefined
            ? current.staff_name
            : body.staff_name?.toString().trim() || null,
        notes:
          body.notes === undefined
            ? current.notes
            : body.notes?.toString().trim() || null,
        updated_at: now,
      })
      await touchCustomerInSupabase(current.customer_id, now)
      return NextResponse.json(updated)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const updated = await updateDb(async (db) => {
    const idx = db.sessions.findIndex((s) => s.id === sessionId)
    if (idx === -1) return { db, result: null as ScalpSession | null }

    const current = db.sessions[idx]
    const now = new Date().toISOString()
    const next: ScalpSession = {
      ...current,
      check_date: body.check_date === undefined ? current.check_date : nextCheckDate,
      staff_name:
        body.staff_name === undefined
          ? current.staff_name
          : body.staff_name?.toString().trim() || null,
      notes:
        body.notes === undefined
          ? current.notes
          : body.notes?.toString().trim() || null,
      updated_at: now,
    }

    db.sessions[idx] = next

    const customer = db.customers.find((c) => c.id === current.customer_id)
    if (customer) customer.updated_at = now

    return { db, result: next }
  })

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuthRole(['admin'])
  if (!auth.ok) return auth.response

  const { sessionId } = await params

  if (shouldUseSupabaseDataSource()) {
    try {
      const session = await getSessionFromSupabase(sessionId)
      if (!session) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      const imageStorageRefs = await getImageStorageRefsForSessionFromSupabase(sessionId)
      await cleanupScalpImageStorageRefs(imageStorageRefs)
      const deleted = await deleteSessionInSupabase(sessionId)
      await touchCustomerInSupabase(session.customer_id, new Date().toISOString())
      return NextResponse.json(deleted)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const deleted = await updateDb(async (db) => {
    const session = db.sessions.find((s) => s.id === sessionId) ?? null
    if (!session) return { db, result: null as ScalpSession | null }

    const now = new Date().toISOString()
    const imageIds = new Set(
      db.images.filter((img) => img.session_id === sessionId).map((img) => img.id),
    )

    db.sessions = db.sessions.filter((s) => s.id !== sessionId)
    db.images = db.images.filter((img) => img.session_id !== sessionId)
    db.metrics = db.metrics.filter((m) => !imageIds.has(m.image_id))
    db.pointSummaries = db.pointSummaries.filter((p) => p.session_id !== sessionId)
    db.aiShotAnalyses = db.aiShotAnalyses.filter((item) => item.session_id !== sessionId)
    db.aiPointAnalyses = db.aiPointAnalyses.filter((item) => item.session_id !== sessionId)
    db.comparisons = db.comparisons.filter(
      (c) => c.current_session_id !== sessionId && c.previous_session_id !== sessionId,
    )

    const customer = db.customers.find((c) => c.id === session.customer_id)
    if (customer) customer.updated_at = now

    return { db, result: session }
  })

  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await rm(
    path.join(process.cwd(), 'public', 'scalp-images', deleted.customer_id, deleted.id),
    {
      recursive: true,
      force: true,
    },
  )

  return NextResponse.json(deleted)
}
