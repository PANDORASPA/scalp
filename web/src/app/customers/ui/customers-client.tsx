'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DemoSeedButton } from '@/components/demo-seed-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate } from '@/lib/ui/format'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
  session_count: number
  latest_check_date: string | null
  latest_completed_points: number
  needs_session: boolean
  needs_capture: boolean
  ready_compare: boolean
  stale_follow_up: boolean
}

type WorkspaceResponse = {
  rows: CustomerRow[]
  summary: {
    total: number
    needs_session: number
    needs_capture: number
    ready_compare: number
    stale_follow_up: number
  }
}

type FilterKey = 'all' | 'needs_session' | 'needs_capture' | 'ready_compare' | 'stale_follow_up'

function validateCustomerForm({
  name,
  phone,
}: {
  name: string
  phone: string
}) {
  if (!name.trim()) return 'Name is required.'
  if (name.trim().length < 2) return 'Name should be at least 2 characters.'
  if (phone.trim() && !/^[0-9+()\-\s]{8,20}$/.test(phone.trim())) {
    return 'Phone should contain only digits, spaces, or +()- symbols.'
  }
  return null
}

function CustomerModal({
  open,
  customer,
  role,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  customer: CustomerRow | null
  role: 'admin' | 'staff'
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const isEdit = Boolean(customer)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(customer?.name ?? '')
    setPhone(customer?.phone ?? '')
    setNotes(customer?.notes ?? '')
    setSaving(false)
    setError(null)
  }, [customer, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">{isEdit ? 'Edit customer' : 'New customer'}</div>
            <button className="text-sm text-slate-500 hover:text-slate-900" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="mt-4 grid gap-3">
            <div className="grid gap-1">
              <Label htmlFor="customer_name">Name</Label>
              <Input id="customer_name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="customer_phone">Phone</Label>
              <Input id="customer_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="customer_notes">Notes</Label>
              <Input id="customer_notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              {customer && role === 'admin' ? (
                <Button
                  variant="danger"
                  disabled={saving}
                  onClick={async () => {
                    if (!window.confirm(`Delete customer "${customer.name}" and all related data?`)) return
                    setSaving(true)
                    setError(null)
                    try {
                      const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
                      if (!res.ok) throw new Error('Failed to delete customer')
                      onDeleted()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to delete customer')
                      setSaving(false)
                    }
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  const validationError = validateCustomerForm({ name, phone })
                  if (validationError) {
                    setError(validationError)
                    return
                  }

                  setSaving(true)
                  setError(null)
                  try {
                    const res = await fetch(customer ? `/api/customers/${customer.id}` : '/api/customers', {
                      method: customer ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), notes: notes.trim() }),
                    })
                    if (!res.ok) throw new Error(`Failed to ${customer ? 'update' : 'create'} customer`)
                    onSaved()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : `Failed to ${customer ? 'update' : 'create'} customer`)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
              >
                {isEdit ? 'Save changes' : 'Save'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default function CustomersClient({
  role,
}: {
  role: 'admin' | 'staff'
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [summary, setSummary] = useState<WorkspaceResponse['summary']>({
    total: 0,
    needs_session: 0,
    needs_capture: 0,
    ready_compare: 0,
    stale_follow_up: 0,
  })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [activeCustomer, setActiveCustomer] = useState<CustomerRow | null>(null)

  const fetchRows = useCallback(async (query: string) => {
    setLoading(true)
    const url = new URL('/api/customers/overview', window.location.origin)
    url.searchParams.set('mode', 'workspace')
    url.searchParams.set('filter', filter)
    if (query.trim()) url.searchParams.set('q', query.trim())
    const res = await fetch(url.toString())
    const data = (await res.json()) as WorkspaceResponse
    setRows(data.rows)
    setSummary(data.summary)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    void fetchRows(q)
  }, [fetchRows, q])

  const filterCards: Array<{ key: FilterKey; label: string; count: number; help: string }> = [
    { key: 'all', label: 'All customers', count: summary.total, help: 'Full working list' },
    { key: 'needs_session', label: 'Needs session', count: summary.needs_session, help: 'No session created yet' },
    { key: 'needs_capture', label: 'Needs capture', count: summary.needs_capture, help: 'Latest session still incomplete' },
    { key: 'ready_compare', label: 'Ready to compare', count: summary.ready_compare, help: 'At least 2 sessions and latest fully scored' },
    { key: 'stale_follow_up', label: 'Follow-up due', count: summary.stale_follow_up, help: 'Latest visit was 30+ days ago' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Customers</h1>
          <div className="text-sm text-slate-600">
            Search, review, edit, and continue session work from one place.
          </div>
        </div>

        <div className="flex gap-2">
          <div className="w-72">
            <Label htmlFor="q">Search</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Example: Amy / 09xx"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setQ('')
                void fetchRows('')
              }}
            >
              Clear
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void fetchRows(q)
              }}
              disabled={loading}
            >
              Search
            </Button>
            <Button
              onClick={() => {
                setActiveCustomer(null)
                setOpenModal(true)
              }}
            >
              New customer
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        {filterCards.map((item) => (
          <button
            key={item.key}
            className={`rounded-xl border p-4 text-left transition ${
              filter === item.key
                ? 'border-blue-600 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
            onClick={() => setFilter(item.key)}
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{item.count}</div>
            <div className="mt-1 text-sm text-slate-600">{item.help}</div>
          </button>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Customer records</div>
            <div className="text-xs text-slate-500">Use filters above to work through the day&apos;s queue.</div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void fetchRows(q)
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Latest session</th>
                <th className="px-3 py-2">Session count</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    <div className="space-y-3">
                      <div>No customer data yet.</div>
                      <DemoSeedButton onSeeded={() => void fetchRows(q)} />
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium">{c.name}</td>
                    <td className="px-3 py-3">{c.phone ?? '-'}</td>
                    <td className="px-3 py-3">{formatDate(c.latest_check_date)}</td>
                    <td className="px-3 py-3">
                      <div>{c.session_count}</div>
                      <div className="text-xs text-slate-500">{c.latest_completed_points}/5 latest points complete</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link className="text-blue-700 hover:underline" href={`/customers/${c.id}`}>
                          Open
                        </Link>
                        <button
                          className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                          onClick={() => {
                            setActiveCustomer(c)
                            setOpenModal(true)
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <CustomerModal
        open={openModal}
        customer={activeCustomer}
        role={role}
        onClose={() => setOpenModal(false)}
        onSaved={() => void fetchRows(q)}
        onDeleted={() => {
          setOpenModal(false)
          setActiveCustomer(null)
          void fetchRows(q)
        }}
      />
    </div>
  )
}
