'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CAPTURE_POINT_CODES } from '@/lib/scalp/constants'
import { getCapturePointLabel } from '@/lib/scalp/display'
import type { ScalpPointSummary, ScalpSession } from '@/lib/scalp/types'
import { formatDate } from '@/lib/ui/format'

type CustomerRecord = {
  id: string
  name: string
  phone: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

type OverviewResponse = {
  customer: CustomerRecord
  sessions: ScalpSession[]
  latestSession: ScalpSession | null
  latestSummaries: ScalpPointSummary[]
}

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

function validateSessionForm(checkDate: string) {
  if (!checkDate.trim()) return 'Check date is required.'
  if (Number.isNaN(new Date(checkDate).getTime())) return 'Please enter a valid check date.'
  return null
}

function SummaryTable({ summaries }: { summaries: ScalpPointSummary[] }) {
  const byCode = useMemo(() => {
    const m = new Map<string, ScalpPointSummary>()
    for (const s of summaries) m.set(s.capture_point_code, s)
    return m
  }, [summaries])

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2">Point</th>
            <th className="px-3 py-2">Oil</th>
            <th className="px-3 py-2">Redness</th>
            <th className="px-3 py-2">Density</th>
            <th className="px-3 py-2">Blockage</th>
            <th className="px-3 py-2">Dandruff</th>
            <th className="px-3 py-2">Sensitivity</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {CAPTURE_POINT_CODES.map((code) => {
            const s = byCode.get(code)
            return (
              <tr key={code} className="border-b border-slate-100">
                <td className="px-3 py-3 font-medium">{getCapturePointLabel(code)}</td>
                <td className="px-3 py-3">{s?.oil_avg ?? '-'}</td>
                <td className="px-3 py-3">{s?.redness_avg ?? '-'}</td>
                <td className="px-3 py-3">{s?.density_avg ?? '-'}</td>
                <td className="px-3 py-3">{s?.blockage_avg ?? '-'}</td>
                <td className="px-3 py-3">{s?.dandruff_avg ?? '-'}</td>
                <td className="px-3 py-3">{s?.sensitivity_avg ?? '-'}</td>
                <td className="px-3 py-3 text-xs text-slate-600">
                  {s?.completed ? 'complete' : 'incomplete'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ModalFrame({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/35 p-4">
      <Card className="w-full max-w-xl p-5">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold">{title}</div>
          <button className="text-sm text-slate-500 hover:text-slate-900" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </Card>
    </div>
  )
}

function CustomerEditorModal({
  open,
  customer,
  role,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  customer: CustomerRecord
  role: 'admin' | 'staff'
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone ?? '')
  const [notes, setNotes] = useState(customer.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(customer.name)
      setPhone(customer.phone ?? '')
      setNotes(customer.notes ?? '')
      setError(null)
      setSaving(false)
    }
  }, [customer, open])

  return (
    <ModalFrame open={open} title="Edit customer" onClose={onClose}>
      <div className="grid gap-4">
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
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
        <div className="flex items-center justify-between gap-2">
          {role === 'admin' ? (
            <Button
              variant="danger"
              disabled={saving}
              onClick={async () => {
                if (!window.confirm('Delete this customer and all related sessions?')) return
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
              Delete customer
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={async () => {
                const validationError = validateCustomerForm({ name, phone })
                if (validationError) {
                  setError(validationError)
                  return
                }

                setSaving(true)
                setError(null)
                try {
                  const res = await fetch(`/api/customers/${customer.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      name: name.trim(),
                      phone: phone.trim(),
                      notes: notes.trim(),
                    }),
                  })
                  if (!res.ok) throw new Error('Failed to update customer')
                  onSaved()
                  onClose()
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to update customer')
                  setSaving(false)
                }
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </ModalFrame>
  )
}

function SessionEditorModal({
  open,
  session,
  role,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean
  session: ScalpSession | null
  role: 'admin' | 'staff'
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const [checkDate, setCheckDate] = useState('')
  const [staffName, setStaffName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open && session) {
      const d = new Date(session.check_date)
      const pad = (n: number) => n.toString().padStart(2, '0')
      setCheckDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`)
      setStaffName(session.staff_name ?? '')
      setNotes(session.notes ?? '')
      setSaving(false)
      setError(null)
    }
  }, [open, session])

  return (
    <ModalFrame open={open} title="Edit session" onClose={onClose}>
      {!session ? null : (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="session_date">Check date</Label>
            <Input
              id="session_date"
              type="datetime-local"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="session_staff">Staff name</Label>
            <Input
              id="session_staff"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="session_notes">Notes</Label>
            <Input id="session_notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <div className="flex items-center justify-between gap-2">
            {role === 'admin' ? (
              <Button
                variant="danger"
                disabled={saving}
                onClick={async () => {
                  if (!window.confirm('Delete this session and all related images, scores, and comparisons?')) return
                  setSaving(true)
                  setError(null)
                  try {
                    const res = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error('Failed to delete session')
                    onDeleted()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to delete session')
                    setSaving(false)
                  }
                }}
              >
                Delete session
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  const validationError = validateSessionForm(checkDate)
                  if (validationError) {
                    setError(validationError)
                    return
                  }

                  setSaving(true)
                  setError(null)
                  try {
                    const res = await fetch(`/api/sessions/${session.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        check_date: new Date(checkDate).toISOString(),
                        staff_name: staffName.trim(),
                        notes: notes.trim(),
                      }),
                    })
                    if (!res.ok) throw new Error('Failed to update session')
                    onSaved()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to update session')
                    setSaving(false)
                  }
                }}
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModalFrame>
  )
}

export default function CustomerDetailClient({
  role,
}: {
  role: 'admin' | 'staff'
}) {
  const { customerId } = useParams<{ customerId: string }>()
  const router = useRouter()
  const [data, setData] = useState<OverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerModalOpen, setCustomerModalOpen] = useState(false)
  const [activeSession, setActiveSession] = useState<ScalpSession | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${customerId}/overview`)
      if (!res.ok) throw new Error('Customer not found')
      const json = (await res.json()) as OverviewResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customer')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const latestCompletedCount = data?.latestSummaries.filter((item) => item.completed).length ?? 0

  if (loading) {
    return <div className="mx-auto max-w-6xl p-6 text-sm text-slate-600">Loading...</div>
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card className="p-4">
          <div className="text-sm text-red-700">{error ?? 'Failed to load customer'}</div>
          <div className="mt-3">
            <Link className="text-blue-700 hover:underline" href="/customers">
              Back to customer list
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-sm text-slate-500">
              <Link className="hover:underline" href="/customers">
                Back to customer list
              </Link>
            </div>
            <h1 className="mt-1 text-xl font-semibold">{data.customer.name}</h1>
            <div className="text-sm text-slate-600">
              {data.customer.phone ?? 'No phone on file'}
              {data.customer.notes ? ` | ${data.customer.notes}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refresh()}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => setCustomerModalOpen(true)}>
              Edit customer
            </Button>
            <Button onClick={() => router.push(`/sessions/new?customerId=${data.customer.id}`)}>
              Create session
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Sessions</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.sessions.length}</div>
            <div className="mt-1 text-sm text-slate-600">Total visits on record</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Latest visit</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {data.latestSession ? formatDate(data.latestSession.check_date) : '-'}
            </div>
            <div className="mt-1 text-sm text-slate-600">Most recent completed check-in</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Summary points</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{latestCompletedCount}/5</div>
            <div className="mt-1 text-sm text-slate-600">Completed points in latest session</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Workflow</div>
            <div className="mt-2 text-sm text-slate-900">Create session / capture 3 shots / score / compare</div>
            <div className="mt-1 text-sm text-slate-600">Use this page as the daily control center.</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Session history</div>
                  <div className="text-xs text-slate-500">Edit visit details, continue capture, or compare results.</div>
                </div>
                <div className="text-xs text-slate-500">{data.sessions.length} sessions</div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Staff</th>
                      <th className="px-3 py-2">Notes</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={4}>
                          No session yet.
                        </td>
                      </tr>
                    ) : (
                      data.sessions.map((s) => (
                        <tr key={s.id} className="border-b border-slate-100 align-top">
                          <td className="px-3 py-3">{formatDate(s.check_date)}</td>
                          <td className="px-3 py-3">{s.staff_name ?? '-'}</td>
                          <td className="px-3 py-3">{s.notes ?? '-'}</td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-3">
                              <Link className="text-blue-700 hover:underline" href={`/sessions/${s.id}/capture`}>
                                Capture and score
                              </Link>
                              <Link
                                className="text-blue-700 hover:underline"
                                href={`/comparisons?customerId=${data.customer.id}&currentSessionId=${s.id}`}
                              >
                                Compare
                              </Link>
                              <button
                                className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                                onClick={() => setActiveSession(s)}
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
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="text-sm font-medium">Front desk checklist</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>1. Confirm customer details are current.</div>
                <div>2. Create a new session before taking any new photos.</div>
                <div>3. Each point needs 3 shots and complete scoring.</div>
                <div>4. Use comparison only after the latest session is scored.</div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium">Latest summary</div>
              <div className="mt-1 text-xs text-slate-500">
                {data.latestSession ? `Session: ${formatDate(data.latestSession.check_date)}` : 'No session yet'}
              </div>
              <div className="mt-3">
                {data.latestSession ? (
                  <SummaryTable summaries={data.latestSummaries} />
                ) : (
                  <div className="text-sm text-slate-600">Create the first session to begin.</div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <CustomerEditorModal
        open={customerModalOpen}
        customer={data.customer}
        role={role}
        onClose={() => setCustomerModalOpen(false)}
        onSaved={() => void refresh()}
        onDeleted={() => router.push('/customers')}
      />

      <SessionEditorModal
        open={Boolean(activeSession)}
        session={activeSession}
        role={role}
        onClose={() => setActiveSession(null)}
        onSaved={() => void refresh()}
        onDeleted={() => {
          setActiveSession(null)
          void refresh()
        }}
      />
    </>
  )
}
