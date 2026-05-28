'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SCALP_ANALYSIS_ANNOTATION_COLORS, SCALP_ANALYSIS_ANNOTATION_LABELS, SCALP_ANALYSIS_ANNOTATION_TYPES, type ScalpAnnotationType } from '@/lib/scalp-analysis/constants'
import { createEmptyAnnotations, normalizeAnnotations } from '@/lib/scalp-analysis/logic'
import type { ScalpAnalysisAnnotations, ScalpAnalysisImage, ScalpEditorMarker } from '@/lib/scalp-analysis/types'

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
  const [dragId, setDragId] = useState<string | null>(null)

  const baseAnnotations = useMemo(
    () => normalizeAnnotations(image.confirmed_annotations_json ?? image.ai_result_json ?? createEmptyAnnotations()),
    [image.ai_result_json, image.confirmed_annotations_json],
  )

  const width = baseAnnotations.image_width ?? 360
  const height = baseAnnotations.image_height ?? 240

  useEffect(() => {
    setNotes(baseAnnotations.notes)
    setMarkers(flattenMarkers(baseAnnotations))
  }, [baseAnnotations])

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
        image_width: width,
        image_height: height,
      })
      await onConfirm(next)
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : '儲存標記失敗')
    }
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">Confirmed annotations</div>
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
            <Button variant="secondary" type="button" onClick={() => setMarkers(flattenMarkers(baseAnnotations))}>
              還原 AI 標記
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleConfirm()}>
              {busy ? '儲存中...' : '確認標記'}
            </Button>
          </div>
        </div>

        <div className="text-xs text-slate-500">
          點擊圖片可新增標記；拖動標記可調整位置；下方清單可更改類型或刪除。
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
              setMarkers((prev) => prev.map((item) => (item.id === dragId ? { ...item, ...point } : item)))
            }}
            onPointerUp={() => setDragId(null)}
            onPointerLeave={() => setDragId(null)}
            onClick={(event) => {
              if (dragId) return
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
                    setDragId(marker.id)
                  }}
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
          <label className="text-sm font-medium text-slate-700">備註</label>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="輸入這張圖片的人工確認備註..."
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
                  onChange={(event) =>
                    setMarkers((prev) =>
                      prev.map((item) =>
                        item.id === marker.id ? { ...item, type: event.target.value as ScalpAnnotationType } : item,
                      ),
                    )
                  }
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
                  onClick={() => setMarkers((prev) => prev.filter((item) => item.id !== marker.id))}
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
