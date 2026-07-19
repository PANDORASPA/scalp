'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DemoSeedButton } from '@/components/demo-seed-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchJson, isAbortError } from '@/lib/ui/fetch'
import { formatDate } from '@/lib/ui/format'
import { getIntegrationStatus, type SettingsStatusResponse } from '@/lib/ui/integration'
import { SCALP_ANALYSIS_STORAGE_CLEANUP_REQUEST_TIMEOUT_MS } from '@/lib/scalp-analysis/request-timeouts'

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
  tracking_session_count: number
  latest_tracking_check_date: string | null
  latest_tracking_completed_areas: number
}

type WorkspaceResponse = {
  rows: CustomerRow[]
  summary: {
    total: number
    needs_session: number
    needs_capture: number
    ready_compare: number
    stale_follow_up: number
    tracking_active: number
    tracking_incomplete: number
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
  if (!name.trim()) return '請輸入客人姓名。'
  if (name.trim().length < 2) return '客人姓名最少需要 2 個字元。'
  if (phone.trim() && !/^[0-9+()\-\s]{8,20}$/.test(phone.trim())) {
    return '電話只可以包含數字、空格或 +()- 符號。'
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
  persistenceReady,
}: {
  open: boolean
  customer: CustomerRow | null
  role: 'admin' | 'staff'
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
  persistenceReady: boolean | null
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
            <div className="text-sm font-semibold">{isEdit ? '編輯客人' : '新增客人'}</div>
            <button className="text-sm text-slate-500 hover:text-slate-900" onClick={onClose}>
              關閉
            </button>
          </div>

          <div className="mt-4 grid gap-3">
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
                  disabled={saving || persistenceReady === false}
                  onClick={async () => {
                    if (!window.confirm(`確定刪除客人「${customer.name}」和所有相關資料？`)) return
                    setSaving(true)
                    setError(null)
                    try {
                      await fetchJson(
                        `/api/customers/${customer.id}`,
                        { method: 'DELETE' },
                        SCALP_ANALYSIS_STORAGE_CLEANUP_REQUEST_TIMEOUT_MS,
                      )
                      onDeleted()
                    } catch (e) {
                      setError(e instanceof Error ? e.message : '刪除客人失敗')
                      setSaving(false)
                    }
                  }}
                >
                  刪除
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                取消
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
                    await fetchJson(customer ? `/api/customers/${customer.id}` : '/api/customers', {
                      method: customer ? 'PATCH' : 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), notes: notes.trim() }),
                    })
                    onSaved()
                    onClose()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : customer ? '更新客人失敗' : '新增客人失敗')
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving || persistenceReady === false}
              >
                {isEdit ? '保存變更' : '保存'}
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
  allowDemoSeed,
}: {
  role: 'admin' | 'staff'
  allowDemoSeed: boolean
}) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<CustomerRow[]>([])
  const [summary, setSummary] = useState<WorkspaceResponse['summary']>({
    total: 0,
    needs_session: 0,
    needs_capture: 0,
    ready_compare: 0,
    stale_follow_up: 0,
    tracking_active: 0,
    tracking_incomplete: 0,
  })
  const [filter, setFilter] = useState<FilterKey>('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [openModal, setOpenModal] = useState(false)
  const [activeCustomer, setActiveCustomer] = useState<CustomerRow | null>(null)
  const [supabaseReady, setSupabaseReady] = useState<boolean | null>(null)
  const listRequestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    void fetchJson<SettingsStatusResponse>('/api/settings/status', { signal: controller.signal })
      .then((status) => {
        if (cancelled) return
        setSupabaseReady(getIntegrationStatus(status.integrations, 'supabase')?.ready ?? false)
      })
      .catch((error) => {
        if (cancelled || isAbortError(error)) return
        setSupabaseReady(null)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  const fetchRows = useCallback(async (query: string) => {
    listRequestRef.current?.abort()
    const controller = new AbortController()
    listRequestRef.current = controller
    setLoading(true)
    setLoadError(null)
    const url = new URL('/api/customers/overview', window.location.origin)
    url.searchParams.set('mode', 'workspace')
    url.searchParams.set('filter', filter)
    if (query.trim()) url.searchParams.set('q', query.trim())
    try {
      const data = await fetchJson<WorkspaceResponse>(url.toString(), { signal: controller.signal })
      if (controller.signal.aborted) return
      setRows(data.rows)
      setSummary(data.summary)
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return
      setLoadError(error instanceof Error ? error.message : '載入客人清單失敗')
    } finally {
      if (listRequestRef.current === controller) {
        listRequestRef.current = null
        setLoading(false)
      }
    }
  }, [filter])

  useEffect(() => () => listRequestRef.current?.abort(), [])

  useEffect(() => {
    void fetchRows(q)
  }, [fetchRows, q])

  const filterCards: Array<{ key: FilterKey; label: string; count: number; help: string }> = [
    { key: 'all', label: '全部客人', count: summary.total, help: '完整工作清單' },
    { key: 'needs_session', label: '未有一般檢查', count: summary.needs_session, help: '尚未建立一般檢查紀錄' },
    { key: 'needs_capture', label: '待拍攝', count: summary.needs_capture, help: '最新 session 尚未完成' },
    { key: 'ready_compare', label: '可比較', count: summary.ready_compare, help: '已有 2 次 session 並完成最新評分' },
    { key: 'stale_follow_up', label: '應跟進', count: summary.stale_follow_up, help: '最近到訪已超過 30 日' },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">客人管理</h1>
          <div className="text-sm text-slate-600">
            集中搜尋、檢視、編輯客人，並繼續未完成的檢查流程。
          </div>
        </div>

        <div className="flex gap-2">
          <div className="w-72">
            <Label htmlFor="q">搜尋</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="例：Amy / 09xx"
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
              清除
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void fetchRows(q)
              }}
              disabled={loading}
            >
              搜尋
            </Button>
            <Button
              disabled={supabaseReady === false}
              onClick={() => {
                setActiveCustomer(null)
                setOpenModal(true)
              }}
            >
              新增客人
            </Button>
          </div>
        </div>
      </div>

      {loadError ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div>{loadError}</div>
          <Button className="mt-3" variant="secondary" onClick={() => void fetchRows(q)} disabled={loading}>
            重試載入
          </Button>
        </Card>
      ) : null}

      {supabaseReady === false ? (
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-semibold">Workspace storage is not ready</div>
          <div className="mt-1">
            Creating, editing, and deleting customers is disabled until Supabase is connected.
          </div>
          <Link className="mt-2 inline-block font-medium underline" href="/settings">
            Open integration settings
          </Link>
        </Card>
      ) : null}

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
            <div className="text-sm font-medium">客人紀錄</div>
            <div className="text-xs text-slate-500">可用上方篩選卡處理每日跟進清單。</div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              void fetchRows(q)
            }}
            disabled={loading}
          >
            重新整理
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">姓名</th>
                <th className="px-3 py-2">電話</th>
                <th className="px-3 py-2">最近 session</th>
                <th className="px-3 py-2">Session 數量</th>
                <th className="px-3 py-2">放大追蹤</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    正在載入...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={6}>
                    <div className="space-y-3">
                      <div>暫時未有客人資料。</div>
                      {role === 'admin' && allowDemoSeed ? <DemoSeedButton onSeeded={() => void fetchRows(q)} /> : null}
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
                      <div className="text-xs text-slate-500">最新完成 {c.latest_completed_points}/5 個部位</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{c.tracking_session_count} 次</div>
                      <div className="text-xs text-slate-500">
                        {c.latest_tracking_check_date ? `${formatDate(c.latest_tracking_check_date)} | ` : ''}
                        已完成 {c.latest_tracking_completed_areas}/6 部位
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-3">
                        <Link className="text-blue-700 hover:underline" href={`/customers/${c.id}`}>
                          打開
                        </Link>
                        <button
                          className="text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                          disabled={supabaseReady === false}
                          onClick={() => {
                            setActiveCustomer(c)
                            setOpenModal(true)
                          }}
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

      <CustomerModal
        open={openModal}
        customer={activeCustomer}
        role={role}
        onClose={() => setOpenModal(false)}
        onSaved={() => void fetchRows(q)}
        persistenceReady={supabaseReady}
        onDeleted={() => {
          setOpenModal(false)
          setActiveCustomer(null)
          void fetchRows(q)
        }}
      />
    </div>
  )
}
