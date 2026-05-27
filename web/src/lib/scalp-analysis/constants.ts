export const SCALP_ANALYSIS_AREA_KEYS = [
  'm_left',
  'm_right',
  'front_center',
  'crown',
  'vertex',
  'occipital_control',
] as const

export type ScalpAnalysisAreaKey = (typeof SCALP_ANALYSIS_AREA_KEYS)[number]

export const SCALP_ANALYSIS_AREA_LABELS: Record<ScalpAnalysisAreaKey, string> = {
  m_left: 'M字左',
  m_right: 'M字右',
  front_center: '前額中線',
  crown: '頭頂',
  vertex: '頭頂旋位',
  occipital_control: '後枕健康對照區',
}

export const SCALP_ANALYSIS_ANNOTATION_TYPES = [
  'coarse_hairs',
  'baby_hairs',
  'empty_follicles',
  'blockages',
  'redness_regions',
] as const

export type ScalpAnnotationType = (typeof SCALP_ANALYSIS_ANNOTATION_TYPES)[number]

export const SCALP_ANALYSIS_ANNOTATION_LABELS: Record<ScalpAnnotationType, string> = {
  coarse_hairs: '粗髮',
  baby_hairs: '幼毛 / 新生毛',
  empty_follicles: '空毛囊',
  blockages: '堵塞',
  redness_regions: '紅腫',
}

export const SCALP_ANALYSIS_ANNOTATION_COLORS: Record<ScalpAnnotationType, string> = {
  coarse_hairs: '#2563eb',
  baby_hairs: '#16a34a',
  empty_follicles: '#eab308',
  blockages: '#f97316',
  redness_regions: '#dc2626',
}

export const SCALP_ANALYSIS_WORKFLOW_TYPE = 'scalp_analysis_tracking'
