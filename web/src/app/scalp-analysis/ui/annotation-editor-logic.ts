import { createEmptyAnnotations, normalizeAnnotations } from '@/lib/scalp-analysis/logic'
import type { ScalpAnalysisAnnotations, ScalpAnalysisImage, ScalpAnalysisScores } from '@/lib/scalp-analysis/types'

type AnnotationSources = Pick<ScalpAnalysisImage, 'ai_result_json' | 'confirmed_annotations_json'>

export type ScalpAnalysisScoreKey = keyof ScalpAnalysisScores

const SCORE_LIMITS: Record<ScalpAnalysisScoreKey, readonly [number, number]> = {
  scalp_empty_ratio: [0, 100],
  redness_score: [0, 10],
  oiliness_score: [0, 10],
  blockage_score: [0, 10],
  density_score: [0, 100],
}

export function shouldCreateMarkerFromCanvasClick(dragged: boolean) {
  return !dragged
}

export function getAnnotationEditorCanvasSize(
  annotations: Pick<ScalpAnalysisAnnotations, 'image_width' | 'image_height'>,
  naturalSize: { width: number; height: number } | null,
) {
  return {
    width: annotations.image_width ?? naturalSize?.width ?? 360,
    height: annotations.image_height ?? naturalSize?.height ?? 240,
  }
}

export function getAnnotationEditorInitialAnnotations(sources: AnnotationSources) {
  return normalizeAnnotations(sources.confirmed_annotations_json ?? sources.ai_result_json ?? createEmptyAnnotations())
}

export function getAnnotationEditorAiResetAnnotations(sources: AnnotationSources) {
  return normalizeAnnotations(sources.ai_result_json ?? createEmptyAnnotations())
}

export function updateAnnotationScore(
  scores: ScalpAnalysisScores,
  key: ScalpAnalysisScoreKey,
  rawValue: string,
) {
  const value = rawValue.trim()
  if (!value) return { ...scores, [key]: null }

  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return { ...scores, [key]: null }

  const [min, max] = SCORE_LIMITS[key]
  return { ...scores, [key]: Math.max(min, Math.min(max, numeric)) }
}
