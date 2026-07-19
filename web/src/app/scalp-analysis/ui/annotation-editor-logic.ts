import { createEmptyAnnotations, normalizeAnnotations } from '@/lib/scalp-analysis/logic'
import type { ScalpAnalysisImage } from '@/lib/scalp-analysis/types'

type AnnotationSources = Pick<ScalpAnalysisImage, 'ai_result_json' | 'confirmed_annotations_json'>

export function shouldCreateMarkerFromCanvasClick(dragged: boolean) {
  return !dragged
}

export function getAnnotationEditorInitialAnnotations(sources: AnnotationSources) {
  return normalizeAnnotations(sources.confirmed_annotations_json ?? sources.ai_result_json ?? createEmptyAnnotations())
}

export function getAnnotationEditorAiResetAnnotations(sources: AnnotationSources) {
  return normalizeAnnotations(sources.ai_result_json ?? createEmptyAnnotations())
}
