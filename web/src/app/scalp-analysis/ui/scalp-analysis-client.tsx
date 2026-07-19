'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  SCALP_ANALYSIS_AREA_KEYS,
  SCALP_ANALYSIS_AREA_LABELS,
  type ScalpAnalysisAreaKey,
} from '@/lib/scalp-analysis/constants'
import {
  getScalpHistoryMetricValue,
  SCALP_HISTORY_METRIC_LABELS,
  SCALP_HISTORY_METRICS,
  type ScalpAnalysisHistoryPoint,
  type ScalpHistoryMetric,
} from '@/lib/scalp-analysis/history'
import {
  calculateCaptureConsistencyScore,
  CAPTURE_CONSISTENCY_REVIEW_THRESHOLD,
  isTrustworthyCaptureConsistencyScore,
} from '@/lib/scalp-analysis/logic'
import { filterScalpAnalysisCustomers } from '@/lib/scalp-analysis/customer-picker'
import { buildScalpAnalysisHref, pickTrackingSessionId } from '@/lib/scalp-analysis/navigation'
import {
  buildScalpAnalysisCsv,
  buildScalpAnalysisReport,
  SCALP_REPORT_METRIC_KEYS,
  SCALP_REPORT_METRIC_LABELS,
  type ScalpAnalysisReport,
  type ScalpReportMetricKey,
} from '@/lib/scalp-analysis/report'
import type { ScalpAnalysisAnnotations, ScalpAnalysisImage, ScalpAnalysisSessionState, ScalpAreaSummary } from '@/lib/scalp-analysis/types'
import type { ScalpSession } from '@/lib/scalp/types'
import { getHumanErrorMessage } from '@/lib/ui/errors'
import { fetchJson as fetchJSON, isAbortError } from '@/lib/ui/fetch'
import { formatDate } from '@/lib/ui/format'
import {
  getIntegrationStatus,
  isIntegrationReady,
  type IntegrationStatus,
  type SettingsStatusResponse,
} from '@/lib/ui/integration'

import { AnnotationEditor } from './annotation-editor'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  session_count: number
  latest_check_date: string | null
}

const SCALP_RECOVERY_REQUEST_TIMEOUT_MS = 240_000

function formatMetric(value: number | null, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.round(value * 10) / 10}${suffix}`
}

function downloadReportFile(report: ScalpAnalysisReport, extension: 'csv' | 'json') {
  const date = report.session_date.slice(0, 10) || 'session'
  const customer = report.customer_name.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'customer'
  const content = extension === 'csv' ? buildScalpAnalysisCsv(report) : JSON.stringify(report, null, 2)
  const blob = new Blob([content], {
    type: extension === 'csv' ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `scalp-report-${customer}-${date}.${extension}`
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso)
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getImageStatusLabel(status: ScalpAnalysisImage['analysis_status'] | null) {
  if (!status) return '未上傳'
  if (status === 'uploaded') return '已上傳，等待分析'
  if (status === 'ai_ready') return 'AI 已完成，待確認'
  if (status === 'ai_failed') return 'AI 失敗，可重試或人手標記'
  if (status === 'confirmed') return '已確認，已計入統計'
  return '處理中'
}

function SummaryPanel({ summary, consistencyScore }: { summary: ScalpAreaSummary | null; consistencyScore: number | null }) {
  if (!summary) {
    return <div className="text-sm text-slate-500">需要 3 張已確認圖片，才會產生平均值、上次比較和 baseline 比較。</div>
  }

  return (
    <>
      {consistencyScore !== null ? (
        <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          <div className="font-medium text-slate-800">Capture consistency: {consistencyScore}%</div>
          <div className="mt-1">
            {consistencyScore < CAPTURE_CONSISTENCY_REVIEW_THRESHOLD
              ? '低於 70%，請覆核三張圖片或重拍；不要將細微變化直接當成改善。'
              : '三張圖片的統計差異在可接受範圍內。'}
          </div>
        </div>
      ) : null}
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
            <div className="text-slate-500">這個部位暫時未有已完成的上一個 session 可比較。</div>
          )}
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次 vs 第一次 baseline</div>
        <div className="mt-2 space-y-1 text-sm text-slate-700">
          {summary.compared_to_baseline_json?.summary_lines?.length ? (
            summary.compared_to_baseline_json.summary_lines.map((line) => <div key={line}>{line}</div>)
          ) : (
            <div className="text-slate-500">完成第二次或之後的 session 後，這裡會顯示長期變化。</div>
          )}
        </div>
      </Card>
      </div>
    </>
  )
}

function reportMetricSuffix(metric: ScalpReportMetricKey) {
  return metric === 'average_scalp_empty_ratio' ? '%' : ''
}

function ReportView({ report }: { report: ScalpAnalysisReport }) {
  return (
    <Card className="p-5 print:break-inside-avoid">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">客人報告</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{report.customer_name} | 頭皮放大圖追蹤</h2>
          <div className="mt-1 text-sm text-slate-600">檢查日期：{formatDate(report.session_date)}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${report.session_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {report.session_complete ? '6 個部位已完成' : `${report.completed_areas}/6 個部位已完成`}
        </div>
      </div>

      {report.warnings.length > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <div className="font-semibold">報告仍有未完成資料</div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {report.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          六個固定部位均已由 3 張 confirmed 圖片取平均，可作今次正式報告。
        </div>
      )}

      <div className="mt-4 space-y-4">
        {report.areas.map((area) => (
          <section key={area.area_key} className="rounded-lg border border-slate-200 p-4 print:break-inside-avoid">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{area.label}</h3>
                <div className="mt-1 text-xs text-slate-500">
                  {area.confirmed_images}/3 張 confirmed
                  {area.consistency_score === null ? '' : ` | capture consistency ${area.consistency_score}%`}
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${area.status === 'complete' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {area.status === 'complete'
                  ? area.consistency_warning
                    ? '已完成，需覆核'
                    : '已納入統計'
                  : '未納入統計'}
              </span>
            </div>

            {area.status === 'complete' ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {SCALP_REPORT_METRIC_KEYS.map((metric) => (
                    <div key={metric} className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">{SCALP_REPORT_METRIC_LABELS[metric]}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatMetric(area.metrics[metric], reportMetricSuffix(metric))}
                      </div>
                    </div>
                  ))}
                </div>
                {area.report_summary ? <div className="mt-3 text-sm text-slate-700">{area.report_summary}</div> : null}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次 vs 上次</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {area.compared_to_previous?.summary_lines?.length ? area.compared_to_previous.summary_lines.map((line) => <div key={line}>{line}</div>) : <div className="text-slate-500">沒有完整的上一個 session 可比較。</div>}
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-200 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次 vs baseline</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-700">
                      {area.compared_to_baseline?.summary_lines?.length ? area.compared_to_baseline.summary_lines.map((line) => <div key={line}>{line}</div>) : <div className="text-slate-500">沒有完整 baseline 可比較。</div>}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-slate-500">完成 3 張圖片並確認標記後，才會加入平均值及前後比較。</div>
            )}
          </section>
        ))}
      </div>
    </Card>
  )
}

function formatHistoryValue(value: number | null, metric: ScalpHistoryMetric) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.round(value * 10) / 10}${metric === 'scalp_empty_ratio' ? '%' : ''}`
}

function TrendHistoryPanel({
  history,
  loading,
}: {
  history: ScalpAnalysisHistoryPoint[]
  loading: boolean
}) {
  const [areaKey, setAreaKey] = useState<ScalpAnalysisAreaKey>('m_left')
  const [metric, setMetric] = useState<ScalpHistoryMetric>('baby_hair_count')
  const points = useMemo(
    () => history.filter((point) => point.area_key === areaKey),
    [areaKey, history],
  )
  const numericPoints = points.filter((point) => {
    const value = getScalpHistoryMetricValue(point, metric)
    return typeof value === 'number' && Number.isFinite(value)
  })
  const values = numericPoints.map((point) => getScalpHistoryMetricValue(point, metric) as number)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 1
  const range = Math.max(1, max - min)
  const chartWidth = 640
  const chartHeight = 190
  const chartPoints = numericPoints.map((point, index) => {
    const value = getScalpHistoryMetricValue(point, metric) as number
    const x = numericPoints.length === 1 ? chartWidth / 2 : (index / (numericPoints.length - 1)) * chartWidth
    const y = chartHeight - ((value - min) / range) * (chartHeight - 24) - 12
    return { point, x, y, value }
  })

  return (
    <Card className="p-5 print:hidden">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">長期趨勢</div>
          <div className="mt-1 text-sm text-slate-600">
            只顯示已完成 3 張 confirmed 圖片的部位，避免未完成資料誤導客人。
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={areaKey}
            onChange={(event) => setAreaKey(event.target.value as ScalpAnalysisAreaKey)}
          >
            {SCALP_ANALYSIS_AREA_KEYS.map((key) => (
              <option key={key} value={key}>{SCALP_ANALYSIS_AREA_LABELS[key]}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={metric}
            onChange={(event) => setMetric(event.target.value as ScalpHistoryMetric)}
          >
            {SCALP_HISTORY_METRICS.map((key) => (
              <option key={key} value={key}>{SCALP_HISTORY_METRIC_LABELS[key]}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-slate-500">正在載入歷史趨勢...</div>
      ) : !history.length ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          完成任何一個部位的 3 張 confirmed 圖片後，這裡會開始顯示長期變化。
        </div>
      ) : !points.length ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
          這個部位尚未有完整歷史紀錄。
        </div>
      ) : (
        <>
          {numericPoints.length >= 1 ? (
            <div className="mt-4 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-48 min-w-[520px] w-full" role="img" aria-label={`${SCALP_ANALYSIS_AREA_LABELS[areaKey]} ${SCALP_HISTORY_METRIC_LABELS[metric]} 趨勢圖`}>
                <line x1="0" y1={chartHeight - 12} x2={chartWidth} y2={chartHeight - 12} stroke="#cbd5e1" strokeWidth="1" />
                {chartPoints.length > 1 ? (
                  <polyline
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={chartPoints.map((item) => `${item.x},${item.y}`).join(' ')}
                  />
                ) : null}
                {chartPoints.map((item) => (
                  <g key={item.point.session_id}>
                    <circle cx={item.x} cy={item.y} r="6" fill="#0f766e" />
                    <text x={item.x} y={chartHeight - 1} textAnchor="middle" className="fill-slate-500 text-[10px]">
                      {formatDate(item.point.session_date)}
                    </text>
                  </g>
                ))}
              </svg>
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>最低 {formatHistoryValue(min, metric)}</span>
                <span>最高 {formatHistoryValue(max, metric)}</span>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-slate-500">這個指標暫時沒有可用數值。</div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">檢查日期</th>
                  <th className="px-3 py-2">數值</th>
                  <th className="px-3 py-2">相對上一次</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point, index) => {
                  const value = getScalpHistoryMetricValue(point, metric)
                  const previousPoint = index > 0 ? points[index - 1] : null
                  const previous = previousPoint ? getScalpHistoryMetricValue(previousPoint, metric) : null
                  const canCompare =
                    isTrustworthyCaptureConsistencyScore(point.capture_consistency_score) &&
                    isTrustworthyCaptureConsistencyScore(previousPoint?.capture_consistency_score)
                  const delta = canCompare && typeof value === 'number' && typeof previous === 'number'
                    ? value - previous
                    : null
                  return (
                    <tr key={`${point.session_id}:${point.area_key}`} className="border-b border-slate-100">
                      <td className="px-3 py-2">{formatDate(point.session_date)}</td>
                      <td className="px-3 py-2 font-medium">{formatHistoryValue(value, metric)}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {delta === null ? '-' : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}${metric === 'scalp_empty_ratio' ? '%' : ''}`}
                        {point.capture_consistency_score !== null && point.capture_consistency_score !== undefined && point.capture_consistency_score < CAPTURE_CONSISTENCY_REVIEW_THRESHOLD ? (
                          <div className="mt-1 text-xs text-amber-700">Consistency {point.capture_consistency_score}%: review</div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  )
}

export default function ScalpAnalysisClient({ role }: { role: 'admin' | 'staff' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerId, setCustomerId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [sessions, setSessions] = useState<ScalpSession[]>([])
  const [sessionId, setSessionId] = useState('')
  const [sessionState, setSessionState] = useState<ScalpAnalysisSessionState | null>(null)
  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const [createNotes, setCreateNotes] = useState('')
  const [createDate, setCreateDate] = useState(() => toDatetimeLocalValue(new Date().toISOString()))
  const [editingSession, setEditingSession] = useState<ScalpSession | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([])
  const [history, setHistory] = useState<ScalpAnalysisHistoryPoint[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const sessionsRequestRef = useRef<AbortController | null>(null)
  const historyRequestRef = useRef<AbortController | null>(null)
  const sessionStateRequestRef = useRef<AbortController | null>(null)
  const report = useMemo(
    () => (sessionState ? buildScalpAnalysisReport(sessionState) : null),
    [sessionState],
  )

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    ;(async () => {
      try {
        const [data, status] = await Promise.all([
          fetchJSON<CustomerRow[]>('/api/customers/overview', { signal: controller.signal }),
          fetchJSON<SettingsStatusResponse>('/api/settings/status', { signal: controller.signal }),
        ])
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
      controller.abort()
    }
  }, [searchParams])

  const loadSessions = useCallback(async (nextCustomerId: string) => {
    sessionsRequestRef.current?.abort()
    const controller = new AbortController()
    sessionsRequestRef.current = controller
    if (!nextCustomerId) {
      setSessions([])
      setSessionId('')
      sessionsRequestRef.current = null
      return
    }
    try {
      const list = await fetchJSON<ScalpSession[]>(
        `/api/scalp-analysis/sessions?customerId=${encodeURIComponent(nextCustomerId)}`,
        { signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setSessions(list)
      const requestedSessionId = nextCustomerId === customerId ? searchParams.get('sessionId') : null
      const selectedSessionId = pickTrackingSessionId(list, requestedSessionId, sessionId)
      setSessionId(selectedSessionId)
      router.replace(buildScalpAnalysisHref(nextCustomerId, selectedSessionId || null))
    } finally {
      if (sessionsRequestRef.current === controller) sessionsRequestRef.current = null
    }
  }, [customerId, router, searchParams, sessionId])

  const loadHistory = useCallback(async (nextCustomerId: string) => {
    historyRequestRef.current?.abort()
    const controller = new AbortController()
    historyRequestRef.current = controller
    if (!nextCustomerId) {
      setHistory([])
      historyRequestRef.current = null
      return
    }
    setHistoryLoading(true)
    try {
      const nextHistory = await fetchJSON<ScalpAnalysisHistoryPoint[]>(
        `/api/scalp-analysis/history?customerId=${encodeURIComponent(nextCustomerId)}`,
        { signal: controller.signal },
      )
      if (!controller.signal.aborted) setHistory(nextHistory)
    } finally {
      if (historyRequestRef.current === controller) {
        historyRequestRef.current = null
        setHistoryLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!customerId) return
    void loadSessions(customerId).catch((e) => {
      if (!isAbortError(e)) setError(e instanceof Error ? e.message : '載入檢查紀錄失敗')
    })
  }, [customerId, loadSessions])

  useEffect(() => {
    if (!customerId) return
    void loadHistory(customerId).catch((e) => {
      if (!isAbortError(e)) setError(e instanceof Error ? e.message : 'Failed to load tracking history')
    })
  }, [customerId, loadHistory])

  useEffect(() => {
    return () => {
      sessionsRequestRef.current?.abort()
      historyRequestRef.current?.abort()
      sessionStateRequestRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    sessionStateRequestRef.current?.abort()
    setRecoveryNotice(null)
    if (!sessionId) {
      setSessionState(null)
      return
    }
    const controller = new AbortController()
    sessionStateRequestRef.current = controller
    let cancelled = false
    ;(async () => {
      setBusyKey('load-session')
      try {
        const data = await fetchJSON<ScalpAnalysisSessionState>(
          `/api/scalp-analysis/sessions/${encodeURIComponent(sessionId)}`,
          { signal: controller.signal },
        )
        if (!cancelled) setSessionState(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '載入 session 狀態失敗')
      } finally {
        if (!cancelled) setBusyKey(null)
      }
    })()
    return () => {
      cancelled = true
      controller.abort()
      if (sessionStateRequestRef.current === controller) sessionStateRequestRef.current = null
    }
  }, [sessionId])

  const selectedCustomer = useMemo(
    () => customers.find((item) => item.id === customerId) ?? null,
    [customerId, customers],
  )
  const customerOptions = useMemo(
    () => filterScalpAnalysisCustomers(customers, customerSearch, customerId),
    [customerId, customerSearch, customers],
  )
  const storageStatus = integrations.find((item) => item.key === 'google-drive')
  const supabaseReady = isIntegrationReady(integrations, 'supabase')
  const googleDriveReady = isIntegrationReady(integrations, 'google-drive')
  const aiStatus = getIntegrationStatus(integrations, 'scalp-ai')
  const googleDriveDetails = storageStatus?.details
  const demoStorageActive = storageStatus?.mode === 'demo'

  function beginEditSession(session: ScalpSession) {
    setEditingSession(session)
    setEditDate(toDatetimeLocalValue(session.check_date))
    setEditNotes(session.notes ?? '')
    setError(null)
  }

  async function refreshCurrentSession() {
    if (!sessionId) return
    const [data, nextHistory] = await Promise.all([
      fetchJSON<ScalpAnalysisSessionState>(`/api/scalp-analysis/sessions/${sessionId}`),
      customerId
        ? fetchJSON<ScalpAnalysisHistoryPoint[]>(`/api/scalp-analysis/history?customerId=${customerId}`)
        : Promise.resolve([]),
    ])
    setSessionState(data)
    setHistory(nextHistory)
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
              每次檢查會記錄 6 個固定部位，每個部位 3 張放大圖。AI 先產生初步標記，使用者再人手確認；最終統計以已確認標記為準，並自動和上次及第一次 baseline 比較。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void refreshCurrentSession()} disabled={!sessionId || busyKey === 'load-session'}>
              重新整理
            </Button>
            {sessionState && sessionState.progress.ai_retryable_images > 0 ? (
              <Button
                className="print:hidden"
                variant="secondary"
                disabled={!supabaseReady || busyKey === 'retry-session'}
                onClick={async () => {
                  setBusyKey('retry-session')
                  setError(null)
                  setRecoveryNotice(null)
                  try {
                    const result = await fetchJSON<{
                      attempted: number
                      succeeded: number
                      failed: number
                      skipped: number
                    }>(
                      `/api/scalp-analysis/sessions/${encodeURIComponent(sessionId)}/retry`,
                      { method: 'POST' },
                      SCALP_RECOVERY_REQUEST_TIMEOUT_MS,
                    )
                    setRecoveryNotice(
                      `AI recovery finished: ${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped.`,
                    )
                    await refreshCurrentSession()
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'AI recovery failed')
                  } finally {
                    setBusyKey(null)
                  }
                }}
              >
                {busyKey === 'retry-session'
                  ? 'Retrying AI...'
                  : `Retry ${sessionState.progress.ai_retryable_images} AI image(s)`}
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => window.print()} disabled={!sessionState}>
              列印報告
            </Button>
            <Button
              className="print:hidden"
              variant="secondary"
              onClick={() => report && downloadReportFile(report, 'csv')}
              disabled={!report}
            >
              匯出 CSV
            </Button>
            <Button
              className="print:hidden"
              variant="secondary"
              onClick={() => report && downloadReportFile(report, 'json')}
              disabled={!report}
            >
              匯出 JSON
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4 print:hidden">
          <Card className="p-4">
            <div className="grid gap-2">
              <Label>選擇客人</Label>
              <Input
                value={customerSearch}
                onChange={(event) => setCustomerSearch(event.target.value)}
                placeholder="按姓名或電話搜尋"
                aria-label="搜尋客人"
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                value={customerId}
                onChange={(e) => {
                  const nextCustomerId = e.target.value
                  setCustomerId(nextCustomerId)
                  setSessionId('')
                  if (nextCustomerId) router.replace(buildScalpAnalysisHref(nextCustomerId))
                  else router.replace('/scalp-analysis')
                  setError(null)
                }}
              >
                <option value="">請選擇客人</option>
                {customerOptions.map((customer) => (
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
                type="datetime-local"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
              />
              <Input
                value={createNotes}
                onChange={(e) => setCreateNotes(e.target.value)}
                placeholder="可輸入今次檢查備註"
              />
              <Button
                disabled={!customerId || !supabaseReady || busyKey === 'create-session'}
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
                        sessionDate: new Date(createDate).toISOString(),
                        notes: createNotes || null,
                      }),
                    })
                    await loadSessions(customerId)
                    setSessionId(created.id)
                    router.replace(buildScalpAnalysisHref(customerId, created.id))
                    setCreateNotes('')
                    setCreateDate(toDatetimeLocalValue(new Date().toISOString()))
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
            <div className="text-sm font-semibold">檢查紀錄</div>
            <div className="mt-3 space-y-2">
              {sessions.length === 0 ? (
                <div className="text-sm text-slate-500">未有頭皮分析 session。</div>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                      session.id === sessionId
                        ? 'border-blue-300 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        setSessionId(session.id)
                        router.replace(buildScalpAnalysisHref(customerId, session.id))
                      }}
                    >
                      <div className="font-medium">{formatDate(session.check_date)}</div>
                      <div className="mt-1 text-xs text-slate-500">{session.notes || '沒有備註'}</div>
                      <div className="mt-1 text-xs text-slate-500">Operator: {session.staff_name || 'Not recorded'}</div>
                    </button>
                    <div className="mt-2 flex gap-3 text-xs">
                      <button
                        type="button"
                        className="text-blue-700 underline underline-offset-2"
                        disabled={!supabaseReady}
                        onClick={() => beginEditSession(session)}
                      >
                        編輯日期/備註
                      </button>
                      {role === 'admin' ? (
                        <button
                          type="button"
                          className="text-red-700 underline underline-offset-2"
                          disabled={!supabaseReady || busyKey === `delete-session:${session.id}`}
                          onClick={async () => {
                            if (!window.confirm('確定刪除這次追蹤 session、所有圖片及分析結果？')) return
                            setBusyKey(`delete-session:${session.id}`)
                            setError(null)
                            try {
                              await fetchJSON(`/api/scalp-analysis/sessions/${session.id}`, { method: 'DELETE' })
                              if (editingSession?.id === session.id) setEditingSession(null)
                              await loadSessions(customerId)
                              if (sessionId === session.id) setSessionState(null)
                            } catch (e) {
                              setError(e instanceof Error ? e.message : '刪除追蹤 session 失敗')
                            } finally {
                              setBusyKey(null)
                            }
                          }}
                        >
                          {busyKey === `delete-session:${session.id}` ? '刪除中...' : '刪除'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {editingSession ? (
            <Card className="border-blue-200 bg-blue-50 p-4">
              <div className="text-sm font-semibold">編輯追蹤 session</div>
              <div className="mt-3 grid gap-3">
                <Input type="datetime-local" value={editDate} onChange={(event) => setEditDate(event.target.value)} />
                <Input value={editNotes} onChange={(event) => setEditNotes(event.target.value)} placeholder="檢查備註" />
                <div className="flex gap-2">
                  <Button
                    disabled={!supabaseReady || busyKey === `edit-session:${editingSession.id}`}
                    onClick={async () => {
                      if (!editDate) return
                      setBusyKey(`edit-session:${editingSession.id}`)
                      setError(null)
                      try {
                        await fetchJSON(`/api/scalp-analysis/sessions/${editingSession.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            sessionDate: new Date(editDate).toISOString(),
                            notes: editNotes.trim() || null,
                          }),
                        })
                        setEditingSession(null)
                        await loadSessions(customerId)
                        if (sessionId === editingSession.id) await refreshCurrentSession()
                      } catch (e) {
                        setError(e instanceof Error ? e.message : '更新追蹤 session 失敗')
                      } finally {
                        setBusyKey(null)
                      }
                    }}
                  >
                    {busyKey === `edit-session:${editingSession.id}` ? '保存中...' : '保存變更'}
                  </Button>
                  <Button variant="secondary" onClick={() => setEditingSession(null)} disabled={busyKey?.startsWith('edit-session:')}>
                    取消
                  </Button>
                </div>
              </div>
            </Card>
          ) : null}

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

          {!supabaseReady ? (
            <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="font-semibold">Workspace storage is not ready</div>
              <div className="mt-1">
                Customer, session, annotation, and report changes are disabled until Supabase is connected.
              </div>
              <a className="mt-2 inline-block font-medium underline" href="/settings">
                Open integration settings
              </a>
            </Card>
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

          {demoStorageActive ? (
            <Card className="border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <div className="font-semibold">目前使用 Demo 圖片儲存</div>
              <div className="mt-1">
                你可以先測完整上傳、AI 初步標記、人手確認、3 張平均與報告流程；正式客人圖片長期保存請改用 Google Drive。
              </div>
            </Card>
          ) : null}

          {aiStatus?.mode === 'mock' ? (
            <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="font-semibold">Mock AI is active</div>
              <div className="mt-1">
                Preliminary labels are for workflow testing only. Confirmed annotations remain the source of official statistics.
              </div>
              <a className="mt-2 inline-block font-medium underline" href="/settings">
                Configure OpenAI Vision
              </a>
            </Card>
          ) : null}

          {customerId ? <TrendHistoryPanel history={history} loading={historyLoading} /> : null}

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
                    <div className="mt-1 text-xs text-slate-500">Operator: {sessionState.session.staff_name || 'Not recorded'}</div>
                  </div>
                  <div className="text-xs text-slate-500">
                    {sessionState.progress.ready_areas}/{sessionState.progress.total_areas} 個部位可產生平均
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>圖片進度：{sessionState.progress.confirmed_images}/{sessionState.progress.total_images} 已確認</span>
                    <span>{sessionState.progress.uploaded_images}/{sessionState.progress.total_images} 已上傳</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all"
                      style={{ width: `${Math.round((sessionState.progress.confirmed_images / sessionState.progress.total_images) * 100)}%` }}
                    />
                  </div>
                  {sessionState.progress.pending_confirmation_areas > 0 ? (
                    <div className="mt-2 text-xs text-amber-700">
                      有 {sessionState.progress.pending_confirmation_areas} 個部位已上傳圖片，但仍有標記未確認。
                    </div>
                  ) : null}
                  {recoveryNotice ? (
                    <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                      {recoveryNotice}
                    </div>
                  ) : null}
                </div>
              </Card>

              {report ? <ReportView report={report} /> : null}

              {sessionState.areas.map((area) => (
                <Card key={area.area_key} className="p-5">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{area.label}</div>
                      <div className="mt-1 text-sm text-slate-600">
                        已上傳 {area.uploaded_images}/3 張，已確認 {area.confirmed_images}/3 張{' '}
                        {area.ready_for_average
                          ? '| 已產生平均'
                          : area.missing_images > 0
                            ? `| 尚欠 ${area.missing_images} 張圖片`
                            : `| 尚有 ${area.pending_confirmation_images} 張待確認`}
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
                            <div className="text-xs text-slate-500">{getImageStatusLabel(image?.analysis_status ?? null)}</div>
                          </div>

                          <div className="mt-3 grid gap-2">
                            <Input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              capture="environment"
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
                                disabled={!supabaseReady || !googleDriveReady || !pendingFile || busyKey === `upload:${fileKey}`}
                                onClick={async () => {
                                  const file = files[fileKey]
                                  if (!file) return
                                  if (
                                    image &&
                                    !window.confirm(
                                      '這個位置已有圖片。覆寫後會重新分析，並清除這張圖目前的確認標記和統計，確定繼續嗎？',
                                    )
                                  ) {
                                    return
                                  }
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
                              {image?.analysis_status === 'ai_failed' ? (
                                <Button
                                  variant="secondary"
                                  disabled={!supabaseReady || busyKey === `retry:${image.id}`}
                                  onClick={async () => {
                                    setBusyKey(`retry:${image.id}`)
                                    setError(null)
                                    try {
                                      await fetchJSON(`/api/scalp-analysis/images/${image.id}`, { method: 'POST' })
                                      await refreshCurrentSession()
                                    } catch (e) {
                                      setError(e instanceof Error ? e.message : 'AI 重新分析失敗')
                                    } finally {
                                      setBusyKey(null)
                                    }
                                  }}
                                >
                                  {busyKey === `retry:${image.id}` ? '重試中...' : '重試 AI'}
                                </Button>
                              ) : null}
                              {image ? (
                                <Button
                                  variant="danger"
                                  disabled={!supabaseReady || busyKey === `delete:${image.id}`}
                                  onClick={async () => {
                                    if (!window.confirm('確定刪除這張放大圖及其確認標記、統計和比較結果嗎？')) return
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
                              {image.analysis_status === 'ai_failed' && image.analysis_notes ? (
                                <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                  <div className="font-medium">AI 初步分析未完成</div>
                                  <div className="mt-1">{getHumanErrorMessage(image.analysis_notes)}</div>
                                </Card>
                              ) : null}
                              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                                <div>儲存方式：{image.storage_provider}</div>
                                <div>Google Drive file id：{image.drive_file_id || '-'}</div>
                              </div>

                              <AnnotationEditor
                                image={image}
                                busy={!supabaseReady || busyKey === `confirm:${image.id}`}
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
                                    throw (e instanceof Error ? e : new Error('保存確認標記失敗'))
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
                    <SummaryPanel
                      summary={area.summary}
                      consistencyScore={area.summary?.capture_consistency_score ?? calculateCaptureConsistencyScore(area.images)}
                    />
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
