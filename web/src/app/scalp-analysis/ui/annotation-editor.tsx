'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  SCALP_ANALYSIS_ANNOTATION_COLORS,
  SCALP_ANALYSIS_ANNOTATION_LABELS,
  SCALP_ANALYSIS_ANNOTATION_TYPES,
  type ScalpAnnotationType,
} from '@/lib/scalp-analysis/constants'
import type { ScalpAnalysisAnnotations, ScalpAnalysisImage, ScalpEditorMarker } from '@/lib/scalp-analysis/types'

import {
  getAnnotationEditorAiResetAnnotations,
  getAnnotationEditorInitialAnnotations,
  shouldCreateMarkerFromCanvasClick,
  type ScalpAnalysisScoreKey,
  updateAnnotationScore,
} from './annotation-editor-logic'

const SCORE_FIELDS: Array<{
  key: ScalpAnalysisScoreKey
  label: string
  min: number
  max: number
}> = [
  { key: 'scalp_empty_ratio', label: '空白頭皮比例', min: 0, max: 100 },
  { key: 'redness_score', label: '紅腫分數', min: 0, max: 10 },
  { key: 'oiliness_score', label: '出油分數', min: 0, max: 10 },
  { key: 'blockage_score', label: '堵塞分數', min: 0, max: 10 },
  { key: 'density_score', label: '密度分數', min: 0, max: 100 },
]

function flattenMarkers(annotations: ScalpAnalysisAnnotations): ScalpEditorMarker[] {
  return [
    ...annotations.coarse_hairs.map((item) => ({ ...item, type: 'coarse_hairs' as const })),
    ...annotations.baby_hairs.map((item) => ({ ...item, type: 'baby_hairs' as const })),
    ...annotations.empty_follicles.map((item) => ({ ...item, type: 'empty_follicles' as const })),
    ...annotations.blockages.map((item) => ({ ...item, type: 'blockages' as const })),
    ...annotations.redness_regions.map((item) => ({ ...item, type: 'redness_regions' as const })),
  ]
}

function inflateMarkers(markers: ScalpEditorMarker[], base: ScalpAnalysisAnnotations): ScalpAnalysisAnnotations {
  return {
    ...base,
    coarse_hairs: markers
      .filter((item) => item.type === 'coarse_hairs')
      .map(({ type: _type, radius: _radius, severity: _severity, ...item }) => item),
    baby_hairs: markers
      .filter((item) => item.type === 'baby_hairs')
      .map(({ type: _type, radius: _radius, severity: _severity, ...item }) => item),
    empty_follicles: markers
      .filter((item) => item.type === 'empty_follicles')
      .map(({ type: _type, radius: _radius, severity: _severity, ...item }) => item),
    blockages: markers
      .filter((item) => item.type === 'blockages')
      .map(({ type: _type, radius, severity: _severity, ...item }) => ({ ...item, radius: radius ?? 12 })),
    redness_regions: markers
      .filter((item) => item.type === 'redness_regions')
      .map(({ type: _type, radius, severity, ...item }) => ({
        ...item,
        radius: radius ?? 18,
        severity: severity ?? 3,
      })),
  }
}

export function AnnotationEditor({
  image,
  onConfirm,
  busy,
}: {
  image: ScalpAnalysisImage
  onConfirm: (annotations: ScalpAnalysisAnnotations) => Promise<void>
  busy: boolean
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [tool, setTool] = useState<ScalpAnnotationType>('baby_hairs')
  const [notes, setNotes] = useState('')
  const [markers, setMarkers] = useState<ScalpEditorMarker[]>([])
  const [localError, setLocalError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const dragMovedRef = useRef(false)

  const baseAnnotations = useMemo(
    () =>
      getAnnotationEditorInitialAnnotations({
        ai_result_json: image.ai_result_json,
        confirmed_annotations_json: image.confirmed_annotations_json,
      }),
    [image.ai_result_json, image.confirmed_annotations_json],
  )

  const [scores, setScores] = useState(baseAnnotations.scores)
  const width = baseAnnotations.image_width ?? 360
  const height = baseAnnotations.image_height ?? 240

  useEffect(() => {
    setNotes(baseAnnotations.notes)
    setScores(baseAnnotations.scores)
    setMarkers(flattenMarkers(baseAnnotations))
    setHasUnsavedChanges(false)
  }, [baseAnnotations])

  useEffect(() => {
    if (!hasUnsavedChanges) return
    function warnBeforeLeaving(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving)
  }, [hasUnsavedChanges])

  function pointFromEvent(
    event: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
  ) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return null
    const x = ((event.clientX - rect.left) / rect.width) * width
    const y = ((event.clientY - rect.top) / rect.height) * height
    return {
      x: Math.max(0, Math.min(width, Math.round(x * 10) / 10)),
      y: Math.max(0, Math.min(height, Math.round(y * 10) / 10)),
    }
  }

  async function handleConfirm() {
    setLocalError(null)
    try {
      const next = inflateMarkers(markers, {
        ...baseAnnotations,
        notes,
        scores,
        image_width: width,
        image_height: height,
      })
      await onConfirm(next)
      setHasUnsavedChanges(false)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '保存標記失敗')
    }
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">已確認標記</div>
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={tool}
              onChange={(e) => setTool(e.target.value as ScalpAnnotationType)}
            >
              {SCALP_ANALYSIS_ANNOTATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {SCALP_ANALYSIS_ANNOTATION_LABELS[type]}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              type="button"
              disabled={!image.ai_result_json || busy}
              onClick={() => {
                const next = getAnnotationEditorAiResetAnnotations(image)
                setMarkers(flattenMarkers(next))
                setNotes(next.notes)
                setScores(next.scores)
                setHasUnsavedChanges(true)
              }}
            >
              還原 AI 標記
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleConfirm()}>
              {busy ? '保存中...' : '確認標記'}
            </Button>
          </div>
        </div>

        {hasUnsavedChanges ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            有未保存的標記或備註。離開或刷新頁面前，請先按「確認標記」。
          </div>
        ) : null}

        <div className="text-xs text-slate-500">
          點擊圖片可新增標記；拖動標記可調整位置；下方清單可更改類型或刪除。最終統計以確認後的標記為準。
        </div>

        <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.image_url} alt={`${image.area_key}-${image.image_index}`} className="block w-full object-contain" />
          <svg
            ref={svgRef}
            viewBox={`0 0 ${width} ${height}`}
            className="absolute inset-0 h-full w-full cursor-crosshair"
            onPointerMove={(event) => {
              if (!dragId) return
              const point = pointFromEvent(event)
              if (!point) return
              dragMovedRef.current = true
              setHasUnsavedChanges(true)
              setMarkers((prev) => prev.map((item) => (item.id === dragId ? { ...item, ...point } : item)))
            }}
            onPointerUp={() => setDragId(null)}
            onPointerLeave={() => setDragId(null)}
            onClick={(event) => {
              if (!shouldCreateMarkerFromCanvasClick(dragMovedRef.current)) {
                dragMovedRef.current = false
                return
              }
              const point = pointFromEvent(event)
              if (!point) return
              setMarkers((prev) => [
                ...prev,
                {
                  id: `${tool}-${crypto.randomUUID()}`,
                  type: tool,
                  x: point.x,
                  y: point.y,
                  radius: tool === 'blockages' ? 12 : tool === 'redness_regions' ? 18 : undefined,
                  severity: tool === 'redness_regions' ? 3 : undefined,
                  confidence: null,
                },
              ])
              setHasUnsavedChanges(true)
            }}
          >
            {markers.map((marker) => {
              const color = SCALP_ANALYSIS_ANNOTATION_COLORS[marker.type]
              const radius = marker.radius ?? 7
              const isCircle = marker.type === 'blockages' || marker.type === 'redness_regions'
              return (
                <g
                  key={marker.id}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    dragMovedRef.current = false
                    setDragId(marker.id)
                  }}
                  onClick={(event) => event.stopPropagation()}
                >
                  {isCircle ? (
                    <circle cx={marker.x} cy={marker.y} r={radius} fill="transparent" stroke={color} strokeWidth={3} />
                  ) : (
                    <>
                      <circle cx={marker.x} cy={marker.y} r={6} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
                      <line x1={marker.x - 7} y1={marker.y} x2={marker.x + 7} y2={marker.y} stroke={color} strokeWidth={2} />
                      <line x1={marker.x} y1={marker.y - 7} x2={marker.x} y2={marker.y + 7} stroke={color} strokeWidth={2} />
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="grid gap-2">
          <div className="text-sm font-medium text-slate-700">確認後正式採用分數</div>
          <div className="text-xs text-slate-500">
            可按 AI 結果修改；空白會由可用標記推算，無法推算時保持未提供。
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SCORE_FIELDS.map((field) => (
              <label key={field.key} htmlFor={`annotation-${image.id}-${field.key}`} className="grid gap-1 text-xs text-slate-600">
                {field.label} ({field.min}-{field.max})
                <input
                  id={`annotation-${image.id}-${field.key}`}
                  type="number"
                  min={field.min}
                  max={field.max}
                  step="0.1"
                  value={scores[field.key] ?? ''}
                  onChange={(event) => {
                    setScores((previous) => updateAnnotationScore(previous, field.key, event.target.value))
                    setHasUnsavedChanges(true)
                  }}
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900"
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium text-slate-700">備註</label>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value)
              setHasUnsavedChanges(true)
            }}
            placeholder="輸入這張圖片的人手確認備註..."
          />
        </div>

        <div className="grid gap-2">
          {markers.length === 0 ? (
            <div className="text-xs text-slate-500">暫時未有標記。</div>
          ) : (
            markers.map((marker) => (
              <div key={marker.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div className="text-xs text-slate-600">
                  {SCALP_ANALYSIS_ANNOTATION_LABELS[marker.type]} | x {marker.x} / y {marker.y}
                </div>
                <select
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  value={marker.type}
                  onChange={(event) => {
                    setHasUnsavedChanges(true)
                    setMarkers((prev) =>
                      prev.map((item) =>
                        item.id === marker.id ? { ...item, type: event.target.value as ScalpAnnotationType } : item,
                      ),
                    )
                  }}
                >
                  {SCALP_ANALYSIS_ANNOTATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SCALP_ANALYSIS_ANNOTATION_LABELS[type]}
                    </option>
                  ))}
                </select>
                <Button
                  variant="danger"
                  type="button"
                  onClick={() => {
                    setHasUnsavedChanges(true)
                    setMarkers((prev) => prev.filter((item) => item.id !== marker.id))
                  }}
                >
                  刪除
                </Button>
              </div>
            ))
          )}
        </div>

        {localError ? <div className="text-sm text-red-700">{localError}</div> : null}
      </div>
    </Card>
  )
}
