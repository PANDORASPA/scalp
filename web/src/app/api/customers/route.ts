import { NextResponse } from 'next/server'

import { requireAuthRole } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import {
  createCustomerInSupabase,
  listCustomersFromSupabase,
  toRepositoryError,
} from '@/lib/supabase/repository'
import type { Customer } from '@/lib/scalp/types'

export const runtime = 'nodejs'

function isValidPhone(value: string | null) {
  if (!value) return true
  return /^[0-9+()\-\s]{8,20}$/.test(value)
}

export async function GET(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim().toLowerCase() ?? ''

  if (hasSupabaseServerEnv()) {
    try {
      return NextResponse.json(await listCustomersFromSupabase(q))
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb(async (db) => {
    const customers = db.customers
      .filter((c) => {
        if (!q) return true
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

    return { db, result: customers }
  })

  return NextResponse.json(result)
}

export async function POST(req: Request) {
  const auth = await requireAuthRole(['admin', 'staff'])
  if (!auth.ok) return auth.response

  const body = (await req.json()) as Partial<Customer>
  const name = (body.name ?? '').trim()
  const phone = (body.phone ?? null)?.toString().trim() || null
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'name_required' }, { status: 400 })
  }
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: 'invalid_phone' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (hasSupabaseServerEnv()) {
    try {
      const created = await createCustomerInSupabase({
        name,
        phone,
        notes: (body.notes ?? null)?.toString().trim() || null,
        nowISO: now,
      })
      return NextResponse.json(created)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const created = await updateDb(async (db) => {
    const customer: Customer = {
      id: crypto.randomUUID(),
      name,
      phone,
      notes: (body.notes ?? null)?.toString().trim() || null,
      created_at: now,
      updated_at: now,
    }
    db.customers.push(customer)
    return { db, result: customer }
  })

  return NextResponse.json(created)
}
