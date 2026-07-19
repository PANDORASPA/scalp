'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CAPTURE_POINT_CODES, METRIC_KEYS } from '@/lib/scalp/constants'
import { getCapturePointLabel, METRIC_LABELS } from '@/lib/scalp/display'
import type {
  MetricInput,
  ScalpAiPointAnalysis,
  ScalpAiShotAnalysis,
  ScalpComparison,
  ScalpImage,
  ScalpPointSummary,
  ScalpSession,
} from '@/lib/scalp/types'
import { formatDate } from '@/lib/ui/format'

type SessionState = {
  session: ScalpSession
  customer: { id: string; name: string } | null
  images: ScalpImage[]
  metricsByImageId: Record<string, MetricInput>
  pointSummaries: ScalpPointSummary[]
  comparisons: ScalpComparison[]
  aiShotAnalysesByImageId: Record<string, ScalpAiShotAnalysis>
  aiPointAnalyses: ScalpAiPointAnalysis[]
}

const MAX_DIMENSION = 1600

async function compressImage(file: File) {
  if (!file.type.startsWith('image/')) return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return file

  context.drawImage(bitmap, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', 0.82)
  })
  bitmap.close()

  if (!blob) return file

  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
    lastModified: Date.now(),
  })
}

function MetricGrid({
  value,
  onChange,
}: {
  value: MetricInput
  onChange: (next: MetricInput) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {METRIC_KEYS.map((k) => (
        <div key={k} className="grid gap-1">
          <Label>{METRIC_LABELS[k]}</Label>
          <Input
            inputMode="decimal"
            type="number"
            step="0.1"
            min={0}
            max={10}
            value={value[k] ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              onChange({
                ...value,
                [k]: raw === '' ? null : Number(raw),
              })
            }}
          />
        </div>
      ))}
    </div>
  )
}

function getTrendQuality(score: number | null) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return {
      score: null as number | null,
      label: 'Pending',
      note: 'Need all 3 shots before we can judge capture consistency.',
    }
  }

  if (score >= 0.8) {
    return {
      score,
      label: 'High consistency',
      note: 'The 3 shots are tightly grouped, so this point is more trustworthy.',
    }
  }

  if (score >= 0.55) {
    return {
      score,
      label: 'Moderate consistency',
      note: 'The 3 shots agree reasonably well, but keep an eye on shot-to-shot spread.',
    }
  }

  return {
    score,
    label: 'Low consistency',
    note: 'The 3 shots are spread out, so interpret this point with extra caution.',
  }
}

function getConfidenceLabel(confidence: number | null) {
  if (typeof confidence !== 'number' || !Number.isFinite(confidence)) return 'Unavailable'
  if (confidence >= 75) return 'High confidence'
  if (confidence >= 55) return 'Moderate confidence'
  return 'Low confidence'
}

function formatAnalysisMeta(params: {
  providerName?: string | null
  analysisMethod?: string | null
  modelVersion?: string | null
  fallbackUsed?: boolean
}) {
  const parts = [
    params.analysisMethod?.trim() || null,
    params.providerName?.trim() || null,
    params.modelVersion?.trim() || null,
    params.fallbackUsed ? 'fallback' : null,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(' · ') : 'Analysis metadata pending'
}

export default function CaptureClient() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [data, setData] = useState<SessionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [files, setFiles] = useState<Record<string, File | null>>({})
  const [batchFiles, setBatchFiles] = useState<Record<string, File[]>>({})
  const [meta, setMeta] = useState<
    Record<
      string,
      {
        image_type: 'micro'
        magnification: string
        lighting_mode: string
        hair_state: string
      }
    >
  >({})
  const [metrics, setMetrics] = useState<Record<string, MetricInput>>({})

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/state`)
      if (!res.ok) throw new Error('找不到 session')
      const json = (await res.json()) as SessionState
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入 session 失敗')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const imagesByKey = useMemo(() => {
    const m = new Map<string, ScalpImage>()
    for (const img of data?.images ?? []) {
      m.set(`${img.capture_point_code}:${img.shot_index}`, img)
    }
    return m
  }, [data?.images])

  const summaryByPoint = useMemo(() => {
    const m = new Map<string, ScalpPointSummary>()
    for (const s of data?.pointSummaries ?? []) m.set(s.capture_point_code, s)
    return m
  }, [data?.pointSummaries])

  const comparisonByPoint = useMemo(() => {
    const m = new Map<string, ScalpComparison>()
    for (const c of data?.comparisons ?? []) m.set(c.capture_point_code, c)
    return m
  }, [data?.comparisons])

  const aiPointByCode = useMemo(() => {
    const m = new Map<string, ScalpAiPointAnalysis>()
    for (const item of data?.aiPointAnalyses ?? []) m.set(item.capture_point_code, item)
    return m
  }, [data?.aiPointAnalyses])

  if (loading) {
    return <div className="mx-auto max-w-6xl p-6 text-sm text-slate-600">正在載入...</div>
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card className="p-4">
          <div className="text-sm text-red-700">{error ?? '載入 session 失敗'}</div>
          <div className="mt-3">
            <Link className="text-blue-700 hover:underline" href="/customers">
              返回客人列表
            </Link>
          </div>
        </Card>
      </div>
    )
  }

  const customerId = data.session.customer_id
  const customerName = data.customer?.name ?? customerId
  const completedPoints = data.pointSummaries.filter((item) => item.completed).length
  const uploadedShots = data.images.length

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-sm text-slate-500">
            <Link className="hover:underline" href={`/customers/${customerId}`}>
              返回客人詳情
            </Link>
          </div>
          <h1 className="mt-1 text-lg font-semibold">拍攝及評分</h1>
          <div className="text-sm text-slate-600">
            客人：{customerName} | Session：{formatDate(data.session.check_date)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => void refresh()}>
            重新整理
          </Button>
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            href={`/comparisons?customerId=${customerId}&currentSessionId=${data.session.id}`}
          >
            打開比較
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Uploaded shots</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{uploadedShots}/15</div>
          <div className="mt-1 text-sm text-slate-600">Three shots are expected for each of the five points.</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Completed points</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{completedPoints}/5</div>
          <div className="mt-1 text-sm text-slate-600">A point is complete only when all scores are present.</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Tip</div>
          <div className="mt-2 text-sm text-slate-900">You can now update scores and metadata without re-uploading the image.</div>
          <div className="mt-1 text-sm text-slate-600">Use delete only when the shot should be removed from the record.</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {CAPTURE_POINT_CODES.map((point) => {
          const images = [1, 2, 3]
            .map((idx) => imagesByKey.get(`${point}:${idx}`))
            .filter(Boolean) as ScalpImage[]
          const capturedCount = images.length
          const summary = summaryByPoint.get(point)
          const comparison = comparisonByPoint.get(point)
          const aiPoint = aiPointByCode.get(point)
          const consistency = getTrendQuality(aiPoint?.capture_consistency_score ?? null)
          const confidence = typeof aiPoint?.confidence_score === 'number' ? Math.round(aiPoint.confidence_score * 100) : null
          const pointTitle = getCapturePointLabel(point)

          return (
            <Card key={point} className="p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold">{pointTitle}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-600">
                    <span>{capturedCount}/3 shots uploaded</span>
                    {summary?.completed ? <span>Summary ready</span> : <span>Summary pending</span>}
                    {aiPoint?.completed && typeof aiPoint.hair_count_avg_3shot === 'number' ? (
                      <span>AI avg {aiPoint.hair_count_avg_3shot}</span>
                    ) : (
                      <span>AI avg pending</span>
                    )}
                    <span>{confidence !== null ? `${getConfidenceLabel(aiPoint?.confidence_score ?? null)} (${confidence}%)` : 'Confidence pending'}</span>
                    <span>{consistency.label}</span>
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Storage: metadata in Supabase; source images use the configured storage adapter (Google Drive or demo).
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Batch upload</div>
                    <div className="mt-1 text-xs text-slate-600">
                      Select up to 3 images. They will be assigned to shots 1-3 in order and may overwrite existing shots.
                    </div>
                    <div className="mt-3">
                      <Input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={async (e) => {
                          const picked = Array.from(e.target.files ?? []).slice(0, 3)
                          const compressed = await Promise.all(picked.map((file) => compressImage(file)))
                          setBatchFiles((prev) => ({ ...prev, [point]: compressed }))
                        }}
                      />
                    </div>
                    {batchFiles[point]?.length ? (
                      <div className="mt-2 text-xs text-slate-500">
                        Ready: {batchFiles[point].map((file) => file.name).join(', ')}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!batchFiles[point]?.length || busyKey === `batch:${point}`}
                    onClick={async () => {
                      const picked = batchFiles[point] ?? []
                      if (picked.length === 0) return
                      setBusyKey(`batch:${point}`)
                      try {
                        for (const [index, selectedFile] of picked.entries()) {
                          const fd = new FormData()
                          fd.set('customer_id', customerId)
                          fd.set('session_id', data.session.id)
                          fd.set('capture_point_code', point)
                          fd.set('shot_index', String(index + 1))
                          fd.set('image_type', 'micro')
                          fd.set('magnification', '')
                          fd.set('lighting_mode', '')
                          fd.set('hair_state', '')
                          fd.set('file', selectedFile)
                          const res = await fetch('/api/scalp-images', {
                            method: 'POST',
                            body: fd,
                          })
                          if (!res.ok) throw new Error(`Failed to upload ${selectedFile.name}`)
                        }

                        setBatchFiles((prev) => ({ ...prev, [point]: [] }))
                        await refresh()
                      } catch (e) {
                        alert(e instanceof Error ? e.message : 'Batch upload failed')
                      } finally {
                        setBusyKey(null)
                      }
                    }}
                  >
                    Upload selected shots
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                {[1, 2, 3].map((shotIndex) => {
                  const key = `${point}:${shotIndex}`
                  const img = imagesByKey.get(key)
                  const metricExisting = img ? data.metricsByImageId[img.id] : undefined
                  const currentMetric = metrics[key] ?? (metricExisting ? { ...metricExisting } : {})
                  const currentMeta = meta[key] ?? {
                    image_type: 'micro' as const,
                    magnification: img?.magnification ?? '',
                    lighting_mode: img?.lighting_mode ?? '',
                    hair_state: img?.hair_state ?? '',
                  }
                  const file = files[key] ?? null
                  const busy = busyKey === key
                  const aiShot = img ? data.aiShotAnalysesByImageId[img.id] : undefined

                  return (
                    <div key={key} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">Shot {shotIndex}</div>
                        <div className="text-xs text-slate-500">{img ? 'Uploaded' : 'Not uploaded'}</div>
                      </div>

                      <div className="mt-2">
                        {img ? (
                          <div className="relative aspect-video w-full overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                            <Image
                              src={img.image_url}
                              alt={`${point}-${shotIndex}`}
                              fill
                              className="object-contain"
                              sizes="(max-width: 1024px) 100vw, 33vw"
                            />
                          </div>
                        ) : (
                          <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500">
                            No image uploaded yet
                          </div>
                        )}
                      </div>

                      <div className="mt-3 grid gap-2">
                        <div className="grid gap-1">
                          <Label>Select image (jpg/png)</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={async (e) => {
                              const picked = e.target.files?.[0] ?? null
                              const f = picked ? await compressImage(picked) : null
                              setFiles((prev) => ({ ...prev, [key]: f }))
                            }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label>Magnification</Label>
                            <Input
                              value={currentMeta.magnification}
                              onChange={(e) =>
                                setMeta((prev) => ({
                                  ...prev,
                                  [key]: { ...currentMeta, magnification: e.target.value },
                                }))
                              }
                              placeholder="Example: 200x"
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label>Lighting mode</Label>
                            <Input
                              value={currentMeta.lighting_mode}
                              onChange={(e) =>
                                setMeta((prev) => ({
                                  ...prev,
                                  [key]: { ...currentMeta, lighting_mode: e.target.value },
                                }))
                              }
                              placeholder="Example: bright"
                            />
                          </div>
                          <div className="col-span-2 grid gap-1">
                            <Label>Hair state</Label>
                            <Input
                              value={currentMeta.hair_state}
                              onChange={(e) =>
                                setMeta((prev) => ({
                                  ...prev,
                                  [key]: { ...currentMeta, hair_state: e.target.value },
                                }))
                              }
                              placeholder="Example: dry / oily / after wash"
                            />
                          </div>
                        </div>

                        <div className="pt-1">
                          <div className="mb-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
                            {aiShot?.status === 'ready' && typeof aiShot.hair_count_estimate === 'number'
                              ? `AI hair count estimate: ${aiShot.hair_count_estimate} strands (confidence ${Math.round((aiShot.confidence_score ?? 0) * 100)}%)`
                              : 'AI hair count estimate will appear after the image and density score are saved.'}
                            <div className="mt-1 text-[11px] text-emerald-800">
                              {formatAnalysisMeta({
                                providerName: aiShot?.provider_name,
                                analysisMethod: aiShot?.analysis_method,
                                modelVersion: aiShot?.model_version,
                                fallbackUsed: aiShot?.fallback_used,
                              })}
                            </div>
                          </div>
                          <div className="text-xs font-medium text-slate-700">Manual score</div>
                          <div className="mt-2">
                            <MetricGrid
                              value={currentMetric}
                              onChange={(next) => setMetrics((prev) => ({ ...prev, [key]: next }))}
                            />
                          </div>
                        </div>

                        <div className="flex justify-between gap-2">
                          <Button
                            variant="danger"
                            disabled={!img || busy}
                            onClick={async () => {
                              if (!img) return
                              if (!window.confirm(`確定刪除「${pointTitle}」第 ${shotIndex} 張圖片？`)) return
                              setBusyKey(key)
                              try {
                                const qs = new URLSearchParams({
                                  sessionId: data.session.id,
                                  capturePointCode: point,
                                  shotIndex: String(shotIndex),
                                })
                                const res = await fetch(`/api/scalp-images?${qs.toString()}`, {
                                  method: 'DELETE',
                                })
                                if (!res.ok) throw new Error('刪除圖片失敗')
                                setFiles((prev) => ({ ...prev, [key]: null }))
                                await refresh()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : '刪除失敗')
                              } finally {
                                setBusyKey(null)
                              }
                            }}
                          >
                            刪除圖片
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={(!file && !img) || busy}
                            onClick={async () => {
                              if (!file && !img) return
                              setBusyKey(key)
                              try {
                                const fd = new FormData()
                                fd.set('customer_id', customerId)
                                fd.set('session_id', data.session.id)
                                fd.set('capture_point_code', point)
                                fd.set('shot_index', String(shotIndex))
                                fd.set('image_type', 'micro')
                                fd.set('magnification', currentMeta.magnification)
                                fd.set('lighting_mode', currentMeta.lighting_mode)
                                fd.set('hair_state', currentMeta.hair_state)

                                for (const metricKey of METRIC_KEYS) {
                                  const v = currentMetric[metricKey]
                                  fd.set(metricKey, v === null || v === undefined ? '' : String(v))
                                }

                                if (file) fd.set('file', file)

                                const res = await fetch('/api/scalp-images', {
                                  method: 'POST',
                                  body: fd,
                                })
                                if (!res.ok) throw new Error('保存圖片失敗')

                                setFiles((prev) => ({ ...prev, [key]: null }))
                                await refresh()
                              } catch (e) {
                                alert(e instanceof Error ? e.message : '保存失敗')
                              } finally {
                                setBusyKey(null)
                              }
                            }}
                          >
                            {img ? '保存更新' : '保存圖片'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <Card className="p-4">
                  <div className="text-sm font-medium">Current summary</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>Oil: {summary?.oil_avg ?? '-'}</div>
                    <div>Redness: {summary?.redness_avg ?? '-'}</div>
                    <div>Density: {summary?.density_avg ?? '-'}</div>
                    <div>Blockage: {summary?.blockage_avg ?? '-'}</div>
                    <div>Dandruff: {summary?.dandruff_avg ?? '-'}</div>
                    <div>Sensitivity: {summary?.sensitivity_avg ?? '-'}</div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    {summary?.completed
                      ? 'Complete: all 3 shots and scores are present.'
                      : 'Incomplete: 3 shots with all metric scores are required.'}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm font-medium">AI hair count</div>
                  <div className="mt-2 text-sm">
                    {aiPoint?.completed && typeof aiPoint.hair_count_avg_3shot === 'number'
                      ? `3-shot average: ${aiPoint.hair_count_avg_3shot} strands`
                      : 'Complete and save all three shots to compute the average.'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {formatAnalysisMeta({
                      providerName: aiPoint?.provider_name,
                      analysisMethod: aiPoint?.analysis_method,
                      fallbackUsed: aiPoint?.fallback_used,
                    })}
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-600 md:grid-cols-2">
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="font-medium text-slate-700">Confidence</div>
                      <div className="mt-1 text-slate-900">
                        {confidence !== null ? `${getConfidenceLabel(aiPoint?.confidence_score ?? null)} (${confidence}%)` : 'Pending'}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-200 bg-white p-2">
                      <div className="font-medium text-slate-700">Consistency</div>
                      <div className="mt-1 text-slate-900">{consistency.label}</div>
                      <div className="mt-1 text-slate-500">
                        {consistency.score !== null ? `${Math.round(consistency.score * 100)}%` : 'Pending'}
                      </div>
                    </div>
                    <div>Min: {aiPoint?.hair_count_min ?? '-'}</div>
                    <div>Max: {aiPoint?.hair_count_max ?? '-'}</div>
                    <div>Change vs previous: {aiPoint?.change_vs_previous ?? '-'}</div>
                    <div>Spread: {typeof aiPoint?.hair_count_min === 'number' && typeof aiPoint?.hair_count_max === 'number' ? aiPoint.hair_count_max - aiPoint.hair_count_min : '-'}</div>
                  </div>
                  <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    {aiPoint?.trend_summary ?? consistency.note}
                    <div className="mt-1">
                      {aiPoint?.fallback_used
                        ? 'Using fallback analysis until the configured provider is available again.'
                        : aiPoint?.completed
                        ? 'This point is ready for trend comparison.'
                        : 'We wait for all 3 shots before using this point in before/after comparisons.'}
                    </div>
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm font-medium">Previous-session comparison</div>
                  <div className="mt-2 text-sm">
                    {comparison?.comparison_summary ?? 'No comparison yet. A previous summary is required.'}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {comparison
                      ? 'Treat small changes as directional only. Bigger swings are more likely to be meaningful.'
                      : 'Comparison becomes available only after the current point is fully scored and a previous session exists.'}
                  </div>
                  {comparison ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div>Oil change: {comparison.oil_change ?? '-'}</div>
                      <div>Redness change: {comparison.redness_change ?? '-'}</div>
                      <div>Density change: {comparison.density_change ?? '-'}</div>
                      <div>Blockage change: {comparison.blockage_change ?? '-'}</div>
                      <div>Dandruff change: {comparison.dandruff_change ?? '-'}</div>
                      <div>Sensitivity change: {comparison.sensitivity_change ?? '-'}</div>
                    </div>
                  ) : null}
                </Card>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
