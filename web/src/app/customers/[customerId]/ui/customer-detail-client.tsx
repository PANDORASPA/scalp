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
import type { ScalpAnalysisSessionState } from '@/lib/scalp-analysis/types'
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
  if (!name.trim()) return '請輸入客人姓名。'
  if (name.trim().length < 2) return '客人姓名最少需要 2 個字元。'
  if (phone.trim() && !/^[0-9+()\-\s]{8,20}$/.test(phone.trim())) {
    return '電話只可以包含數字、空格或 +()- 符號。'
  }
  return null
}

function validateSessionForm(checkDate: string) {
  if (!checkDate.trim()) return '請輸入檢查日期。'
  if (Number.isNaN(new Date(checkDate).getTime())) return '請輸入有效檢查日期。'
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
            <th className="px-3 py-2">部位</th>
            <th className="px-3 py-2">出油</th>
            <th className="px-3 py-2">泛紅</th>
            <th className="px-3 py-2">密度</th>
            <th className="px-3 py-2">堵塞</th>
            <th className="px-3 py-2">頭皮屑</th>
            <th className="px-3 py-2">敏感</th>
            <th className="px-3 py-2">狀態</th>
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
                  {s?.completed ? '完成' : '未完成'}
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
            關閉
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
    <ModalFrame open={open} title="編輯客人資料" onClose={onClose}>
      <div className="grid gap-4">
        <div className="grid gap-1">
          <Label htmlFor="customer_name">姓名</Label>
          <Input id="customer_name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="customer_phone">電話</Label>
          <Input id="customer_phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="customer_notes">備註</Label>
          <Input id="customer_notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
        <div className="flex items-center justify-between gap-2">
          {role === 'admin' ? (
            <Button
              variant="danger"
              disabled={saving}
              onClick={async () => {
                if (!window.confirm('確定刪除這位客人和所有相關 session？')) return
                setSaving(true)
                setError(null)
                try {
                  const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' })
                  if (!res.ok) throw new Error('刪除客人失敗')
                  onDeleted()
                } catch (e) {
                  setError(e instanceof Error ? e.message : '刪除客人失敗')
                  setSaving(false)
                }
              }}
            >
              刪除客人
            </Button>
          ) : <div />}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              取消
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
                  if (!res.ok) throw new Error('更新客人資料失敗')
                  onSaved()
                  onClose()
                } catch (e) {
                  setError(e instanceof Error ? e.message : '更新客人資料失敗')
                  setSaving(false)
                }
              }}
            >
              保存變更
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
    <ModalFrame open={open} title="編輯檢查 session" onClose={onClose}>
      {!session ? null : (
        <div className="grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="session_date">檢查日期</Label>
            <Input
              id="session_date"
              type="datetime-local"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="session_staff">負責員工</Label>
            <Input
              id="session_staff"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="session_notes">備註</Label>
            <Input id="session_notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error ? <div className="text-sm text-red-700">{error}</div> : null}
          <div className="flex items-center justify-between gap-2">
            {role === 'admin' ? (
              <Button
                variant="danger"
                disabled={saving}
                onClick={async () => {
                  if (!window.confirm('確定刪除這次 session，以及相關圖片、評分和比較？')) return
                  setSaving(true)
                  setError(null)
                  try {
                    const res = await fetch(`/api/sessions/${session.id}`, { method: 'DELETE' })
                    if (!res.ok) throw new Error('刪除 session 失敗')
                    onDeleted()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '刪除 session 失敗')
                    setSaving(false)
                  }
                }}
              >
                刪除 session
              </Button>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                取消
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
                    if (!res.ok) throw new Error('更新 session 失敗')
                    onSaved()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '更新 session 失敗')
                    setSaving(false)
                  }
                }}
              >
                保存變更
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
  const [trackingSessions, setTrackingSessions] = useState<ScalpSession[]>([])
  const [latestTrackingState, setLatestTrackingState] = useState<ScalpAnalysisSessionState | null>(null)
  const [trackingError, setTrackingError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTrackingError(null)
    try {
      const res = await fetch(`/api/customers/${customerId}/overview`)
      if (!res.ok) throw new Error('Customer not found')
      const json = (await res.json()) as OverviewResponse
      setData(json)

      const trackingRes = await fetch(`/api/scalp-analysis/sessions?customerId=${customerId}`)
      if (!trackingRes.ok) throw new Error('Failed to load scalp tracking sessions')
      const trackingList = (await trackingRes.json()) as ScalpSession[]
      setTrackingSessions(trackingList)

      const latestTracking = trackingList[0] ?? null
      if (latestTracking) {
        const stateRes = await fetch(`/api/scalp-analysis/sessions/${latestTracking.id}`)
        if (!stateRes.ok) throw new Error('Failed to load latest scalp tracking state')
        setLatestTrackingState((await stateRes.json()) as ScalpAnalysisSessionState)
      } else {
        setLatestTrackingState(null)
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : '載入客人資料失敗'
      if (message.includes('scalp tracking')) {
        setTrackingError(message)
      } else {
        setError(message)
      }
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const latestCompletedCount = data?.latestSummaries.filter((item) => item.completed).length ?? 0
  const latestTrackingCompleteCount = latestTrackingState?.areas.filter((area) => area.ready_for_average).length ?? 0

  if (loading) {
    return <div className="mx-auto max-w-6xl p-6 text-sm text-slate-600">正在載入...</div>
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card className="p-4">
          <div className="text-sm text-red-700">{error ?? '載入客人資料失敗'}</div>
          <div className="mt-3">
            <Link className="text-blue-700 hover:underline" href="/customers">
              返回客人列表
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
                返回客人列表
              </Link>
            </div>
            <h1 className="mt-1 text-xl font-semibold">{data.customer.name}</h1>
            <div className="text-sm text-slate-600">
              {data.customer.phone ?? '未填電話'}
              {data.customer.notes ? ` | ${data.customer.notes}` : ''}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refresh()}>
              重新整理
            </Button>
            <Button variant="secondary" onClick={() => setCustomerModalOpen(true)}>
              編輯客人
            </Button>
            <Button onClick={() => router.push(`/sessions/new?customerId=${data.customer.id}`)}>
              建立 session
            </Button>
            <Button onClick={() => router.push(`/scalp-analysis?customerId=${data.customer.id}`)}>
              頭皮追蹤
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Session 數量</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{data.sessions.length}</div>
            <div className="mt-1 text-sm text-slate-600">已記錄總到訪次數</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">最近到訪</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">
              {data.latestSession ? formatDate(data.latestSession.check_date) : '-'}
            </div>
            <div className="mt-1 text-sm text-slate-600">最近一次完成檢查</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">完成部位</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{latestCompletedCount}/5</div>
            <div className="mt-1 text-sm text-slate-600">最近 session 已完成部位</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">流程</div>
            <div className="mt-2 text-sm text-slate-900">建立 session / 拍 3 張 / 評分 / 比較</div>
            <div className="mt-1 text-sm text-slate-600">這頁可作日常客人檔案中心。</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">頭皮追蹤</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{trackingSessions.length}</div>
            <div className="mt-1 text-sm text-slate-600">
              最新完成 {latestTrackingCompleteCount}/6 個部位平均
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Session 歷史</div>
                  <div className="text-xs text-slate-500">編輯到訪資料、繼續拍攝，或查看比較結果。</div>
                </div>
                <div className="text-xs text-slate-500">{data.sessions.length} 次 session</div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2">日期</th>
                      <th className="px-3 py-2">員工</th>
                      <th className="px-3 py-2">備註</th>
                      <th className="px-3 py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={4}>
                          暫時未有 session。
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
                                拍攝及評分
                              </Link>
                              <Link
                                className="text-blue-700 hover:underline"
                                href={`/comparisons?customerId=${data.customer.id}&currentSessionId=${s.id}`}
                              >
                                比較
                              </Link>
                              <button
                                className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                                onClick={() => setActiveSession(s)}
                              >
                                編輯
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">頭皮放大圖追蹤</div>
                  <div className="mt-1 text-xs text-slate-500">
                    6 個固定部位，每部位 3 張相；已確認標記才會進入平均與比較。
                  </div>
                </div>
                <Link
                  className="text-sm text-blue-700 hover:underline"
                  href={`/scalp-analysis?customerId=${data.customer.id}`}
                >
                  打開
                </Link>
              </div>
              {trackingError ? <div className="mt-3 text-sm text-red-700">{trackingError}</div> : null}
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {trackingSessions.length === 0 ? (
                  <div className="text-slate-500">未有頭皮放大圖追蹤 session。</div>
                ) : (
                  <>
                    <div>追蹤 session：{trackingSessions.length} 次</div>
                    <div>
                      最新記錄：
                      {latestTrackingState ? formatDate(latestTrackingState.session.check_date) : '-'}
                    </div>
                    <div>可出平均部位：{latestTrackingCompleteCount}/6</div>
                  </>
                )}
              </div>
              {latestTrackingState?.report_lines.length ? (
                <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  {latestTrackingState.report_lines.slice(0, 3).map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              ) : null}
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium">前台檢查清單</div>
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div>1. 先確認客人資料是否最新。</div>
                <div>2. 拍新相前先建立新的 session。</div>
                <div>3. 每個部位需要 3 張圖片及完整評分。</div>
                <div>4. 最新 session 完成後再查看比較結果。</div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-sm font-medium">最近摘要</div>
              <div className="mt-1 text-xs text-slate-500">
                {data.latestSession ? `Session：${formatDate(data.latestSession.check_date)}` : '暫時未有 session'}
              </div>
              <div className="mt-3">
                {data.latestSession ? (
                  <SummaryTable summaries={data.latestSummaries} />
                ) : (
                  <div className="text-sm text-slate-600">建立第一個 session 後開始記錄。</div>
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
