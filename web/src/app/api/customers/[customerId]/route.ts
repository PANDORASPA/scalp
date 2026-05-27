import { rm } from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import {
  deleteCustomerInSupabase,
  getCustomerFromSupabase,
  getImagesForCustomerFromSupabase,
  toRepositoryError,
  updateCustomerInSupabase,
} from '@/lib/supabase/repository'
import { buildScalpImageStoragePath, deleteScalpImages } from '@/lib/supabase/storage'
import type { Customer } from '@/lib/scalp/types'

export const runtime = 'nodejs'

function isValidPhone(value: string | null) {
  if (!value) return true
  return /^[0-9+()\-\s]{8,20}$/.test(value)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const { customerId } = await params

  if (hasSupabaseServerEnv()) {
    try {
      const result = await getCustomerFromSupabase(customerId)
      if (!result) {
        return NextResponse.json({ error: 'not_found' }, { status: 404 })
      }
      return NextResponse.json(result)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const customer = db.customers.find((c) => c.id === customerId) ?? null
    return { db, result: customer }
  })

  if (!result) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(result)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const { customerId } = await params
  const body = (await req.json()) as Partial<Customer>
  const nextName = (body.name ?? '').toString().trim()
  const nextPhone =
    body.phone === undefined
      ? undefined
      : body.phone?.toString().trim() || null

  if (body.name !== undefined && nextName.length < 2) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  if (nextPhone !== undefined && !isValidPhone(nextPhone)) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (hasSupabaseServerEnv()) {
    try {
      const updated = await updateCustomerInSupabase(customerId, {
        name: body.name === undefined ? undefined : nextName,
        phone: nextPhone,
        notes: body.notes === undefined ? undefined : body.notes?.toString().trim() || null,
        updated_at: now,
      })
      return NextResponse.json(updated)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const updated = await updateDb(async (db) => {
    const idx = db.customers.findIndex((c) => c.id === customerId)
    if (idx === -1) return { db, result: null as Customer | null }
    const current = db.customers[idx]
    const resolvedPhone: string | null =
      body.phone === undefined ? current.phone : nextPhone ?? null
    const resolvedNotes: string | null =
      body.notes === undefined
        ? current.notes
        : body.notes?.toString().trim() || null
    const next: Customer = {
      ...current,
      name: body.name === undefined ? current.name : nextName,
      phone: resolvedPhone,
      notes: resolvedNotes,
      updated_at: now,
    }
    db.customers[idx] = next
    return { db, result: next }
  })

  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const auth = await requireAuthRole(['admin'])
  if (!auth.ok) return auth.response

  const { customerId } = await params

  if (hasSupabaseServerEnv()) {
    try {
      const images = await getImagesForCustomerFromSupabase(customerId)
      const deleted = await deleteCustomerInSupabase(customerId)
      await deleteScalpImages(
        images.map((image) =>
          buildScalpImageStoragePath({
            customerId: image.customer_id,
            sessionId: image.session_id,
            capturePointCode: image.capture_point_code,
            shotIndex: image.shot_index,
          }),
        ),
      )
      return NextResponse.json(deleted)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const deleted = await updateDb(async (db) => {
    const customer = db.customers.find((c) => c.id === customerId) ?? null
    if (!customer) return { db, result: null as Customer | null }

    const sessionIds = new Set(
      db.sessions.filter((s) => s.customer_id === customerId).map((s) => s.id),
    )
    const imageIds = new Set(
      db.images.filter((img) => img.customer_id === customerId).map((img) => img.id),
    )

    db.customers = db.customers.filter((c) => c.id !== customerId)
    db.sessions = db.sessions.filter((s) => s.customer_id !== customerId)
    db.images = db.images.filter((img) => img.customer_id !== customerId)
    db.metrics = db.metrics.filter((m) => !imageIds.has(m.image_id))
    db.pointSummaries = db.pointSummaries.filter((p) => p.customer_id !== customerId)
    db.aiShotAnalyses = db.aiShotAnalyses.filter((item) => item.customer_id !== customerId)
    db.aiPointAnalyses = db.aiPointAnalyses.filter((item) => item.customer_id !== customerId)
    db.comparisons = db.comparisons.filter(
      (c) =>
        c.customer_id !== customerId &&
        !sessionIds.has(c.current_session_id) &&
        !sessionIds.has(c.previous_session_id),
    )

    return { db, result: customer }
  })

  if (!deleted) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  await rm(path.join(process.cwd(), 'public', 'scalp-images', customerId), {
    recursive: true,
    force: true,
  })

  return NextResponse.json(deleted)
}
