'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function toDatetimeLocalValue(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function validateSessionForm(checkDate: string) {
  if (!checkDate.trim()) return 'Please select a check date'
  if (Number.isNaN(new Date(checkDate).getTime())) return 'Please enter a valid check date'
  return null
}

export default function NewSessionClient() {
  const sp = useSearchParams()
  const router = useRouter()
  const customerId = sp.get('customerId') ?? ''

  const defaultValue = useMemo(() => toDatetimeLocalValue(new Date().toISOString()), [])
  const [checkDate, setCheckDate] = useState(defaultValue)
  const [staffName, setStaffName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-lg font-semibold">Create scalp check session</h1>
      <Card className="p-5">
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="check_date">Check date</Label>
            <Input
              id="check_date"
              type="datetime-local"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="staff_name">Staff name</Label>
            <Input
              id="staff_name"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              placeholder="Example: Amy"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => router.push(customerId ? `/customers/${customerId}` : '/customers')}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  if (!customerId) throw new Error('Missing customerId')
                  const validationError = validateSessionForm(checkDate)
                  if (validationError) throw new Error(validationError)

                  setSaving(true)
                  setError(null)
                  const iso = new Date(checkDate).toISOString()
                  const res = await fetch('/api/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      customer_id: customerId,
                      check_date: iso,
                      staff_name: staffName.trim(),
                      notes: notes.trim(),
                    }),
                  })
                  if (!res.ok) throw new Error('Failed to create session')
                  const created = (await res.json()) as { id: string }
                  router.push(`/sessions/${created.id}/capture`)
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Failed to create session')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={saving}
            >
              Create and open capture
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
