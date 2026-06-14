'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SCALP_ANALYSIS_AREA_KEYS, SCALP_ANALYSIS_AREA_LABELS } from '@/lib/scalp-analysis/constants'
import type { ScalpAnalysisAnnotations, ScalpAnalysisImage, ScalpAnalysisSessionState, ScalpAreaSummary } from '@/lib/scalp-analysis/types'
import type { ScalpSession } from '@/lib/scalp/types'
import { getHumanErrorMessage } from '@/lib/ui/errors'
import { formatDate } from '@/lib/ui/format'

import { AnnotationEditor } from './annotation-editor'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  session_count: number
  latest_check_date: string | null
}

type IntegrationStatus = {
  key: string
  label: string
  ready: boolean
  requiredFor: string
  details: string
}

type SettingsStatusResponse = {
  integrations: IntegrationStatus[]
}

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(getHumanErrorMessage(body?.error ?? 'Request failed'))
  }
  return (await res.json()) as T
}

function formatMetric(value: number | null, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${value}${suffix}`
}

function SummaryPanel({ summary }: { summary: ScalpAreaSummary | null }) {
  if (!summary) {
    return <div className="text-sm text-slate-500">需要 3 張已確認圖片，才會生成平均值與比較結果。</div>
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">3 張平均</div>
        <div className="mt-2 grid gap-1 text-sm text-slate-700">
          <div>粗髮：{formatMetric(summary.average_coarse_hair_count, ' 條')}</div>
          <div>幼毛：{formatMetric(summary.average_baby_hair_count, ' 條')}</div>
          <div>空毛囊：{formatMetric(summary.average_empty_follicle_count, ' 個')}</div>
          <div>堵塞：{formatMetric(summary.average_blockage_count, ' 個')}</div>
          <div>空白頭皮比例：{formatMetric(summary.average_scalp_empty_ratio, '%')}</div>
          <div>紅腫：{formatMetric(summary.average_redness_score)}</div>
          <div>出油：{formatMetric(summary.average_oiliness_score)}</div>
          <div>密度分數：{formatMetric(summary.average_density_score)}</div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次 vs 上次</div>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          {summary.compared_to_previous_json?.summary_lines?.length ? (
            summary.compared_to_previous_json.summary_lines.map((line) => <div key={line}>{line}</div>)
          ) : (
            <div className="text-slate-500">這個部位暫時未有已完成的上一次記錄。</div>
          )}
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次 vs 第一次 baseline</div>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          {summary.compared_to_baseline_json?.summary_lines?.length ? (
            summary.compared_to_baseline_json.summary_lines.map((line) => <div key={line}>{line}</div>)
          ) : (
            <div className="text-slate-500">完成第一次 baseline 後，這裡會顯示長期變化。</div>
          )}
        </div>
      </Card>
    </div>
  )
}

export default function ScalpAnalysisClient() {
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerId, setCustomerId] = useState('')
  const [sessions, setSessions] = useState<ScalpSession[]>([])
  const [sessionId, setSessionId] = useState('')
  const [sessionState, setSessionState] = useState<ScalpAnalysisSessionState | null>(null)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchJSON<CustomerRow[]>('/api/customers/overview')
        const status = await fetchJSON<SettingsStatusResponse>('/api/settings/status')
        const requestedCustomerId = searchParams.get('customerId')
        if (!cancelled) {
          setCustomers(data)
          setIntegrations(status.integrations)
          setCustomerId((prev) =>
            prev || data.find((customer) => customer.id === requestedCustomerId)?.id || data[0]?.id || '',
          )
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '載入客戶失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  async function loadSessions(nextCustomerId: string) {
    if (!nextCustomerId) {
      setSessions([])
      setSessionId('')
      return
    }
    const list = await fetchJSON<ScalpSession[]>(`/api/scalp-analysis/sessions?customerId=${nextCustomerId}`)
    setSessions(list)
    setSessionId((prev) => (prev && list.some((item) => item.id === prev) ? prev : list[0]?.id ?? ''))
  }

  useEffect(() => {
    if (!customerId) return
    void loadSessions(customerId).catch((e) => setError(e instanceof Error ? e.message : '載入檢查記錄失敗'))
  }, [customerId])

  useEffect(() => {
    if (!sessionId) {
      setSessionState(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setBusyKey('load-session')
      try {
        const data = await fetchJSON<ScalpAnalysisSessionState>(`/api/scalp-analysis/sessions/${sessionId}`)
        if (!cancelled) setSessionState(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '載入 session 狀態失敗')
      } finally {
        if (!cancelled) setBusyKey(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === customerId) ?? null,
    [customerId, customers],
  )
  const googleDriveReady = integrations.find((item) => item.key === 'google-drive')?.ready ?? false
  const googleDriveDetails = integrations.find((item) => item.key === 'google-drive')?.details

  async function refreshCurrentSession() {
    if (!sessionId) return
    const data = await fetchJSON<ScalpAnalysisSessionState>(`/api/scalp-analysis/sessions/${sessionId}`)
    setSessionState(data)
  }

  if (loading) {
    return <div className="mx-auto max-w-7xl p-6 text-sm text-slate-600">正在載入頭皮分析工作台...</div>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">長期追蹤</div>
            <h1 className="text-2xl font-semibold text-slate-900">頭皮放大圖追蹤分析系統</h1>
            <p className="max-w-3xl text-sm text-slate-600">
              每次檢查以 6 個固定部位、每部位 3 張放大圖作追蹤。AI 先做初步標記，最後統計以已確認標記為準，再和上次及第一次 baseline 比較。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refreshCurrentSession()} disabled={!sessionId || busyKey === 'load-session'}>
              重新整理
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-2">
              <Label>選擇客人</Label>
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value)
                  setError(null)
                }}
              >
                <option value="">請選擇客人</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomer ? (
              <div className="mt-3 text-sm text-slate-600">
                <div>{selectedCustomer.name}</div>
                <div>{selectedCustomer.phone || '未填電話'}</div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              <Label>建立新的頭皮檢查</Label>
              <Input
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="可輸入今次檢查備註"
              />
              <Button
                disabled={!customerId || busyKey === 'create-session'}
                onClick={async () => {
                  if (!customerId) return
                  setBusyKey('create-session')
                  setError(null)
                  try {
                    const created = await fetchJSON<ScalpSession>('/api/scalp-analysis/sessions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        customerId,
                        sessionDate: new Date().toISOString(),
                        notes: createNotes || null,
                      }),
                    })
                    await loadSessions(customerId)
                    setSessionId(created.id)
                    setCreateNotes('')
                  } catch (e) {
                    setError(e instanceof Error ? e.message : '建立 session 失敗')
                  } finally {
                    setBusyKey(null)
                  }
                }}
              >
                {busyKey === 'create-session' ? '建立中...' : '建立 session'}
              </Button>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold">檢查記錄</div>
            <div className="mt-3 space-y-2">
              {sessions.length === 0 ? (
                <div className="text-sm text-slate-500">未有頭皮分析 session。</div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                      session.id === sessionId
                        ? 'border-blue-300 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setSessionId(session.id)}
                  >
                    <div className="font-medium">{formatDate(session.check_date)}</div>
                    <div className="mt-1 text-xs text-slate-500">{session.notes || '沒有備註'}</div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold">固定拍攝部位</div>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              {SCALP_ANALYSIS_AREA_KEYS.map((key) => (
                <div key={key}>{SCALP_ANALYSIS_AREA_LABELS[key]}</div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          {error ? (
            <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</Card>
          ) : null}

          {!googleDriveReady ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">圖片上傳尚未啟用</div>
              <div className="mt-1">
                {googleDriveDetails ?? '請先到系統設定完成 Google Drive API credential。'}
              </div>
              <a className="mt-2 inline-block font-medium underline" href="/settings">
                前往系統設定
              </a>
            </Card>
          ) : null}

          {!sessionState ? (
            <Card className="p-6 text-sm text-slate-500">請先選擇或建立一個頭皮分析 session。</Card>
          ) : (
            <>
              <Card className="p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {sessionState.customer?.name ?? '未知客人'} | {formatDate(sessionState.session.check_date)}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{sessionState.session.notes || '未有 session 備註。'}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {sessionState.areas.filter((area) => area.ready_for_average).length}/{sessionState.areas.length} 個部位已可出平均
                  </div>
                </div>
              </Card>

              {sessionState.report_lines.length > 0 ? (
                <Card className="p-5">
                  <div className="text-sm font-semibold text-slate-900">報告預覽</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {sessionState.report_lines.map((line) => (
                      <div key={line}>{line}</div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {sessionState.areas.map((area) => (
                <Card key={area.area_key} className="p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{area.label}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        已上傳 {area.images.length}/3 張 {area.ready_for_average ? '| 已生成平均' : '| 等待 3 張已確認圖片'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 xl:grid-cols-3">
                    {[1, 2, 3].map((imageIndex) => {
                      const image = area.images.find((item) => item.image_index === imageIndex) ?? null
                      const fileKey = `${area.area_key}:${imageIndex}`
                      const pendingFile = files[fileKey] ?? null
                      return (
                        <Card key={fileKey} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">圖片 {imageIndex}</div>
                            <div className="text-xs text-slate-500">{image?.analysis_status ?? '未上傳'}</div>
                          </div>

                          <div className="mt-3 grid gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) =>
                                setFiles((prev) => ({
                                  ...prev,
                                  [fileKey]: e.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            {pendingFile ? <div className="text-xs text-slate-500">{pendingFile.name}</div> : null}
                            <div className="flex gap-2">
                              <Button
                                disabled={!googleDriveReady || !pendingFile || busyKey === `upload:${fileKey}`}
                                onClick={async () => {
                                  const file = files[fileKey]
                                  if (!file) return
                                  setBusyKey(`upload:${fileKey}`)
                                  setError(null)
                                  try {
                                    const form = new FormData()
                                    form.set('sessionId', sessionState.session.id)
                                    form.set('customerId', sessionState.session.customer_id)
                                    form.set('areaKey', area.area_key)
                                    form.set('imageIndex', String(imageIndex))
                                    form.set('file', file)
                                    await fetchJSON<ScalpAnalysisImage>('/api/scalp-analysis/images', {
                                      method: 'POST',
                                      body: form,
                                    })
                                    setFiles((prev) => ({ ...prev, [fileKey]: null }))
                                    await refreshCurrentSession()
                                  } catch (e) {
                                    setError(e instanceof Error ? e.message : '圖片上傳失敗')
                                  } finally {
                                    setBusyKey(null)
                                  }
                                }}
                              >
                                {busyKey === `upload:${fileKey}` ? '上傳中...' : image ? '更換圖片' : '上傳圖片'}
                              </Button>
                              {image ? (
                                <Button
                                  variant="danger"
                                  disabled={busyKey === `delete:${image.id}`}
                                  onClick={async () => {
                                    setBusyKey(`delete:${image.id}`)
                                    setError(null)
                                    try {
                                      await fetchJSON(`/api/scalp-analysis/images/${image.id}`, { method: 'DELETE' })
                                      await refreshCurrentSession()
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : '刪除圖片失敗')
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                >
                                  刪除
                                </Button>
                              ) : null}
                            </div>
                          </div>

                          {image ? (
                            <div className="mt-4 space-y-4">
                              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <div>儲存方式：{image.storage_provider}</div>
                                <div>Google Drive file id：{image.drive_file_id || '-'}</div>
                              </div>

                              <AnnotationEditor
                                image={image}
                                busy={busyKey === `confirm:${image.id}`}
                                onConfirm={async (annotations: ScalpAnalysisAnnotations) => {
                                  setBusyKey(`confirm:${image.id}`)
                                  setError(null)
                                  try {
                                    await fetchJSON(`/api/scalp-analysis/images/${image.id}/confirm`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ annotations }),
                                    })
                                    await refreshCurrentSession()
                                  } catch (e) {
                                    throw (e instanceof Error ? e : new Error('儲存確認標記失敗'))
                                  } finally {
                                    setBusyKey(null)
                                  }
                                }}
                              />

                              <Card className="p-3">
                                <div className="text-sm font-medium text-slate-900">單張圖片統計</div>
                                <div className="mt-2 grid gap-1 text-sm text-slate-700">
                                  <div>粗髮：{formatMetric(image.stats.coarse_hair_count, ' 條')}</div>
                                  <div>幼毛：{formatMetric(image.stats.baby_hair_count, ' 條')}</div>
                                  <div>空毛囊：{formatMetric(image.stats.empty_follicle_count, ' 個')}</div>
                                  <div>堵塞：{formatMetric(image.stats.blockage_count, ' 個')}</div>
                                  <div>空白頭皮比例：{formatMetric(image.stats.scalp_empty_ratio, '%')}</div>
                                  <div>紅腫：{formatMetric(image.stats.redness_score)}</div>
                                  <div>出油：{formatMetric(image.stats.oiliness_score)}</div>
                                  <div>密度分數：{formatMetric(image.stats.density_score)}</div>
                                </div>
                              </Card>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                              尚未上傳圖片
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>

                  <div className="mt-4">
                    <SummaryPanel summary={area.summary} />
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
