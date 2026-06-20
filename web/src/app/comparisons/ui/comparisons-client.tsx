'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { CAPTURE_POINT_CODES } from '@/lib/scalp/constants'
import { getCapturePointLabel } from '@/lib/scalp/display'
import { computeComparison } from '@/lib/scalp/logic'
import type { ScalpAiPointAnalysis, ScalpPointSummary, ScalpSession } from '@/lib/scalp/types'
import { formatDate } from '@/lib/ui/format'

type CustomerRow = {
  id: string
  name: string
  phone: string | null
  session_count: number
  latest_check_date: string | null
}

type SessionState = {
  session: ScalpSession
  pointSummaries: ScalpPointSummary[]
  aiPointAnalyses: ScalpAiPointAnalysis[]
}

type TrendLevel = 'stable' | 'modest' | 'meaningful'

function formatSignedNumber(value: number | null, digits = 2) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  const fixed = value.toFixed(digits)
  return value > 0 ? `+${fixed}` : fixed
}

function classifyTrend(current: number | null, baseline: number | null): {
  level: TrendLevel
  label: string
  note: string
  delta: number | null
} {
  if (typeof current !== 'number' || typeof baseline !== 'number') {
    return {
      level: 'stable',
      label: 'Insufficient data',
      note: 'One side is still missing a completed AI summary.',
      delta: null,
    }
  }

  const delta = Math.round((current - baseline) * 100) / 100
  const absDelta = Math.abs(delta)
  const relative = baseline === 0 ? null : Math.abs(delta / baseline) * 100
  const isSmallMovement = absDelta < 3 || (relative !== null && relative < 4)
  const isModerateMovement = absDelta < 8 || (relative !== null && relative < 10)

  if (isSmallMovement) {
    return {
      level: 'stable',
      label: 'Within normal variation',
      note: 'The difference is small enough that capture noise may explain part of it.',
      delta,
    }
  }

  if (isModerateMovement) {
    return {
      level: 'modest',
      label: delta > 0 ? 'Modest increase' : 'Modest decrease',
      note: 'This looks directionally meaningful, but it is still worth checking the full capture set.',
      delta,
    }
  }

  return {
    level: 'meaningful',
    label: delta > 0 ? 'Meaningful increase' : 'Meaningful decrease',
    note: 'This change is large enough to stand out above typical shot-to-shot variation.',
    delta,
  }
}

function getTrendTone(level: TrendLevel) {
  if (level === 'meaningful') return 'border-emerald-200 bg-emerald-50 text-emerald-900'
  if (level === 'modest') return 'border-amber-200 bg-amber-50 text-amber-900'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

function getBackendTrendLevel(direction: ScalpAiPointAnalysis['trend_direction'] | undefined): TrendLevel {
  if (direction === 'improved' || direction === 'declined') return 'meaningful'
  return 'stable'
}

function formatAnalysisMeta(aiPoint: ScalpAiPointAnalysis | null) {
  if (!aiPoint) return 'Analysis metadata pending'
  const parts = [
    aiPoint.analysis_method,
    aiPoint.provider_name,
    aiPoint.fallback_used ? 'fallback' : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

function getConsistencyLabel(score: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { label: 'Unavailable', tone: 'text-slate-500' }
  if (score >= 0.8) return { label: 'High consistency', tone: 'text-emerald-700' }
  if (score >= 0.55) return { label: 'Moderate consistency', tone: 'text-amber-700' }
  return { label: 'Low consistency', tone: 'text-rose-700' }
}

function getPointConsistency(aiPoint: ScalpAiPointAnalysis | null) {
  if (!aiPoint?.completed) {
    return { score: null, label: 'Pending', note: 'Need all 3 shot analyses before we can judge consistency.' }
  }

  if (typeof aiPoint.capture_consistency_score !== 'number') {
    return {
      score: null,
      label: 'Unavailable',
      note: 'The point analysis is complete, but consistency inputs are missing.',
    }
  }

  const label = getConsistencyLabel(aiPoint.capture_consistency_score)

  return {
    score: aiPoint.capture_consistency_score,
    label: label.label,
    note:
      aiPoint.capture_consistency_score >= 0.8
        ? 'Three shots are tightly grouped.'
        : 'The three shots are spread out, so interpret this point more cautiously.',
  }
}

function getAiConfidenceScore(values: Array<number | null | undefined>) {
  const ready = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!ready.length) return null
  return Math.round((ready.reduce((sum, value) => sum + value, 0) / ready.length) * 100)
}

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('載入資料失敗')
  return (await res.json()) as T
}

export default function ComparisonsClient() {
  const sp = useSearchParams()
  const presetCustomerId = sp.get('customerId')
  const presetCurrentSessionId = sp.get('currentSessionId')

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customerId, setCustomerId] = useState(presetCustomerId ?? '')
  const [sessions, setSessions] = useState<ScalpSession[]>([])
  const [baselineSessionId, setBaselineSessionId] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState(presetCurrentSessionId ?? '')

  const [baselineState, setBaselineState] = useState<SessionState | null>(null)
  const [currentState, setCurrentState] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchJSON<CustomerRow[]>('/api/customers/overview')
        if (!cancelled) setCustomers(data)
      } catch {
        if (!cancelled) setCustomers([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!customerId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const list = await fetchJSON<ScalpSession[]>(`/api/sessions?customerId=${customerId}`)
        if (cancelled) return
        setSessions(list)

        const newest = list[0]?.id ?? ''
        const current =
          presetCurrentSessionId && list.some((s) => s.id === presetCurrentSessionId)
            ? presetCurrentSessionId
            : currentSessionId || newest
        setCurrentSessionId(current)

        const currentIdx = list.findIndex((s) => s.id === current)
        const baseline = currentIdx >= 0 ? (list[currentIdx + 1]?.id ?? '') : (list[1]?.id ?? '')
        setBaselineSessionId(baseline)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '載入資料失敗')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [customerId, currentSessionId, presetCurrentSessionId])

  useEffect(() => {
    if (!baselineSessionId || !currentSessionId) return
    let cancelled = false
    ;(async () => {
      setError(null)
      try {
        const [a, b] = await Promise.all([
          fetchJSON<SessionState>(`/api/sessions/${baselineSessionId}/state`),
          fetchJSON<SessionState>(`/api/sessions/${currentSessionId}/state`),
        ])
        if (cancelled) return
        setBaselineState(a)
        setCurrentState(b)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '載入資料失敗')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [baselineSessionId, currentSessionId])

  const comparisons = useMemo(() => {
    if (!baselineState || !currentState) return []

    const baselineByPoint = new Map(
      baselineState.pointSummaries.filter((s) => s.completed).map((s) => [s.capture_point_code, s]),
    )
    const currentByPoint = new Map(
      currentState.pointSummaries.filter((s) => s.completed).map((s) => [s.capture_point_code, s]),
    )

    return CAPTURE_POINT_CODES.map((point) => {
      const a = baselineByPoint.get(point) ?? null
      const b = currentByPoint.get(point) ?? null
      if (!a || !b) return { point, ready: false as const }

      return {
        point,
        ready: true as const,
        comparison: computeComparison({
          customerId,
          capturePointCode: point,
          currentSessionId,
          previousSessionId: baselineSessionId,
          current: b,
          previous: a,
          nowISO: new Date().toISOString(),
        }),
      }
    })
  }, [baselineState, baselineSessionId, currentState, currentSessionId, customerId])

  const aiComparisons = useMemo(() => {
    if (!baselineState || !currentState) return []

    const baselineByPoint = new Map(
      baselineState.aiPointAnalyses.filter((item) => item.completed).map((item) => [item.capture_point_code, item]),
    )
    const currentByPoint = new Map(
      currentState.aiPointAnalyses.filter((item) => item.completed).map((item) => [item.capture_point_code, item]),
    )

    return CAPTURE_POINT_CODES.map((point) => {
      const baseline = baselineByPoint.get(point) ?? null
      const current = currentByPoint.get(point) ?? null
      return {
        point,
        baseline,
        current,
        change:
          typeof baseline?.hair_count_avg_3shot === 'number' && typeof current?.hair_count_avg_3shot === 'number'
            ? Math.round((current.hair_count_avg_3shot - baseline.hair_count_avg_3shot) * 100) / 100
            : null,
      }
    })
  }, [baselineState, currentState])

  const aiComparisonByPoint = useMemo(
    () => new Map(aiComparisons.map((row) => [row.point, row])),
    [aiComparisons],
  )

  const summaryCards = useMemo(() => {
    const baselinePoints = aiComparisons
      .map((row) => row.baseline?.hair_count_avg_3shot ?? null)
      .filter((value): value is number => typeof value === 'number')
    const currentPoints = aiComparisons
      .map((row) => row.current?.hair_count_avg_3shot ?? null)
      .filter((value): value is number => typeof value === 'number')

    const baselineAvg =
      baselinePoints.length > 0
        ? Math.round((baselinePoints.reduce((sum, value) => sum + value, 0) / baselinePoints.length) * 100) / 100
        : null
    const currentAvg =
      currentPoints.length > 0
        ? Math.round((currentPoints.reduce((sum, value) => sum + value, 0) / currentPoints.length) * 100) / 100
        : null

    const confidenceValues = aiComparisons.flatMap((row) => [
      row.baseline?.confidence_score ?? null,
      row.current?.confidence_score ?? null,
    ])
    const averageConfidence = getAiConfidenceScore(confidenceValues)

    const completedPointCount = aiComparisons.filter((row) => row.baseline && row.current).length
    const stableCount = aiComparisons.filter((row) => classifyTrend(row.current?.hair_count_avg_3shot ?? null, row.baseline?.hair_count_avg_3shot ?? null).level === 'stable').length
    const meaningfulCount = aiComparisons.filter((row) => classifyTrend(row.current?.hair_count_avg_3shot ?? null, row.baseline?.hair_count_avg_3shot ?? null).level === 'meaningful').length

    return {
      baselineAvg,
      currentAvg,
      averageConfidence,
      completedPointCount,
      stableCount,
      meaningfulCount,
    }
  }, [aiComparisons])

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-lg font-semibold">Session 比較</h1>
          <div className="text-sm text-slate-600">
            比較兩次檢查，按部位查看頭皮狀態變化。
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-72">
            <Label>客人</Label>
            <select
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">選擇客人</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.session_count})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                setCustomerId('')
                setSessions([])
                setBaselineSessionId('')
                setCurrentSessionId('')
                setBaselineState(null)
                setCurrentState(null)
                setError(null)
              }}
            >
              清除
            </Button>
          </div>
        </div>
      </div>

      {!customerId ? (
        <Card className="p-4">
          <div className="text-sm text-slate-600">請先選擇客人。</div>
        </Card>
      ) : loading ? (
        <Card className="p-4">
          <div className="text-sm text-slate-600">正在載入...</div>
        </Card>
      ) : sessions.length < 2 ? (
        <Card className="p-4">
          <div className="text-sm text-slate-600">需要最少 2 次 session 才可以比較。</div>
          <div className="mt-3">
            <Link className="text-blue-700 hover:underline" href={`/customers/${customerId}`}>
              返回客人詳情
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1">
                <Label>Baseline session</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={baselineSessionId}
                  onChange={(e) => setBaselineSessionId(e.target.value)}
                >
                  <option value="">選擇 baseline</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.check_date)}
                      {s.staff_name ? ` (${s.staff_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1">
                <Label>今次 session</Label>
                <select
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={currentSessionId}
                  onChange={(e) => setCurrentSessionId(e.target.value)}
                >
                  <option value="">選擇今次 session</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.check_date)}
                      {s.staff_name ? ` (${s.staff_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {baselineSessionId && currentSessionId && baselineSessionId === currentSessionId ? (
              <div className="mt-2 text-xs text-red-700">Baseline 和今次 session 不可以相同。</div>
            ) : null}
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Baseline 平均</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {summaryCards.baselineAvg ?? '-'}
              </div>
              <div className="mt-1 text-sm text-slate-600">已完成部位的平均髮量估算。</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">今次平均</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {summaryCards.currentAvg ?? '-'}
              </div>
              <div className="mt-1 text-sm text-slate-600">與 baseline 比較，查看整體趨勢。</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">AI 信心度</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {summaryCards.averageConfidence !== null ? `${summaryCards.averageConfidence}%` : '-'}
              </div>
              <div className="mt-1 text-sm text-slate-600">兩次 session 的平均信心度。</div>
            </Card>
            <Card className="p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">趨勢概覽</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {summaryCards.meaningfulCount > 0 ? `${summaryCards.meaningfulCount} 個明顯變化` : '大致穩定'}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {summaryCards.stableCount} 個部位屬正常波動範圍。
              </div>
            </Card>
          </div>

          {error ? (
            <Card className="p-4">
              <div className="text-sm text-red-700">{error}</div>
            </Card>
          ) : null}

          <Card className="p-4">
            <div className="text-sm font-medium">逐個部位變化</div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">部位</th>
                    <th className="px-3 py-2">Baseline</th>
                    <th className="px-3 py-2">今次</th>
                    <th className="px-3 py-2">差異</th>
                    <th className="px-3 py-2">趨勢</th>
                    <th className="px-3 py-2">信心度</th>
                    <th className="px-3 py-2">一致性</th>
                    <th className="px-3 py-2">備註</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => {
                    const aiRow = aiComparisonByPoint.get(row.point)

                    if (!row.ready) {
                      return (
                        <tr key={row.point} className="border-b border-slate-100">
                          <td className="px-3 py-3 font-medium">{getCapturePointLabel(row.point)}</td>
                          <td className="px-3 py-3 text-slate-500" colSpan={7}>
                            其中一邊尚未有完整 summary，暫時不判斷趨勢。
                          </td>
                        </tr>
                      )
                    }

                    const c = row.comparison
                    const aiTrend = classifyTrend(
                      aiRow?.current?.hair_count_avg_3shot ?? null,
                      aiRow?.baseline?.hair_count_avg_3shot ?? null,
                    )
                    const trendLevel = getBackendTrendLevel(aiRow?.current?.trend_direction)
                    const consistency = getPointConsistency(aiRow?.current ?? null)
                    const confidence = getAiConfidenceScore([
                      aiRow?.baseline?.confidence_score ?? null,
                      aiRow?.current?.confidence_score ?? null,
                    ])
                    return (
                      <tr key={row.point} className="border-b border-slate-100">
                        <td className="px-3 py-3 font-medium">{getCapturePointLabel(row.point)}</td>
                        <td className="px-3 py-3">{aiRow?.baseline?.hair_count_avg_3shot ?? '-'}</td>
                        <td className="px-3 py-3">{aiRow?.current?.hair_count_avg_3shot ?? '-'}</td>
                        <td className="px-3 py-3">{formatSignedNumber(aiTrend.delta)}</td>
                        <td className="px-3 py-3">
                          <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getTrendTone(trendLevel)}`}>
                            {aiRow?.current?.trend_direction ?? aiTrend.label}
                          </div>
                        </td>
                        <td className="px-3 py-3">{confidence !== null ? `${confidence}%` : '-'}</td>
                        <td className="px-3 py-3">
                          <div className="text-xs font-medium text-slate-700">{consistency.label}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {typeof consistency.score === 'number' ? `${Math.round(consistency.score * 100)}% 一致性` : consistency.note}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-slate-700">
                          {aiRow?.current?.trend_summary ?? aiTrend.note}
                          <div className="mt-1 text-slate-500">{formatAnalysisMeta(aiRow?.current ?? null)}</div>
                          <div className="mt-1 text-slate-500">{c.comparison_summary}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-medium">AI 髮量趨勢</div>
            <div className="mt-1 text-xs text-slate-500">
              只有超出一般拍攝誤差的變化，才會標示為明顯變化。
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="px-3 py-2">部位</th>
                    <th className="px-3 py-2">之前</th>
                    <th className="px-3 py-2">今次</th>
                    <th className="px-3 py-2">差異</th>
                    <th className="px-3 py-2">解讀</th>
                  </tr>
                </thead>
                <tbody>
                  {aiComparisons.map((row) => {
                    const trend = classifyTrend(
                      row.current?.hair_count_avg_3shot ?? null,
                      row.baseline?.hair_count_avg_3shot ?? null,
                    )
                    const trendLevel = getBackendTrendLevel(row.current?.trend_direction)
                    const confidence = getAiConfidenceScore([
                      row.baseline?.confidence_score ?? null,
                      row.current?.confidence_score ?? null,
                    ])

                    return (
                      <tr key={row.point} className="border-b border-slate-100">
                        <td className="px-3 py-3 font-medium">{getCapturePointLabel(row.point)}</td>
                        <td className="px-3 py-3">{row.baseline?.hair_count_avg_3shot ?? '-'}</td>
                        <td className="px-3 py-3">{row.current?.hair_count_avg_3shot ?? '-'}</td>
                        <td className="px-3 py-3">{formatSignedNumber(trend.delta)}</td>
                        <td className="px-3 py-3">
                          <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${getTrendTone(trendLevel)}`}>
                            {row.current?.trend_direction ?? trend.label}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{row.current?.trend_summary ?? trend.note}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            信心度 {confidence !== null ? `${confidence}%` : '-'}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">{formatAnalysisMeta(row.current)}</div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">快捷操作</div>
              <Button variant="secondary" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                返回頂部
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                href={`/customers/${customerId}`}
              >
                客人詳情
              </Link>
              <Link
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                href={`/sessions/new?customerId=${customerId}`}
              >
                建立新 session
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
