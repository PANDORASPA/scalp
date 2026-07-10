import { NextResponse } from 'next/server'

import { readJsonBody } from '@/lib/api/json'
import { requireAuthRole } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import {
  createSessionInSupabase,
  listSessionsFromSupabase,
  toRepositoryError,
  touchCustomerInSupabase,
} from '@/lib/supabase/repository'
import type { ScalpSession } from '@/lib/scalp/types'

export const runtime = 'nodejs'

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime())
}

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const customerId = url.searchParams.get('customerId')

  if (hasSupabaseServerEnv()) {
    try {
      return NextResponse.json(await listSessionsFromSupabase(customerId))
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const sessions = db.sessions
      .filter((s) => (customerId ? s.customer_id === customerId : true))
      .sort((a, b) => b.check_date.localeCompare(a.check_date))
    return { db, result: sessions }
  })

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const parsed = await readJsonBody<Partial<ScalpSession>>(req)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const body = parsed.body
  const customerId = (body.customer_id ?? '').toString()
  const checkDate = (body.check_date ?? '').toString()
  if (!customerId || !checkDate) {
    return NextResponse.json(
      { error: 'customer_id_and_check_date_required' },
      { status: 400 },
    )
  }
  if (!isValidDate(checkDate)) {
    return NextResponse.json({ error: 'invalid_check_date' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (hasSupabaseServerEnv()) {
    try {
      const created = await createSessionInSupabase({
        customer_id: customerId,
        check_date: checkDate,
        staff_name: (body.staff_name ?? null)?.toString().trim() || null,
        notes: (body.notes ?? null)?.toString().trim() || null,
        nowISO: now,
      })
      await touchCustomerInSupabase(customerId, now)
      return NextResponse.json(created)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const created = await updateDb(async (db) => {
    const session: ScalpSession = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      check_date: checkDate,
      staff_name: (body.staff_name ?? null)?.toString().trim() || null,
      notes: (body.notes ?? null)?.toString().trim() || null,
      created_at: now,
      updated_at: now,
    }
    db.sessions.push(session)

    const customer = db.customers.find((c) => c.id === customerId)
    if (customer) customer.updated_at = now

    return { db, result: session }
  })

  return NextResponse.json(created)
}
