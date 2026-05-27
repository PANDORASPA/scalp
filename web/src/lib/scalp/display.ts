import type { CapturePointCode, MetricKey } from '@/lib/scalp/constants'

export const CAPTURE_POINT_LABELS: Record<CapturePointCode, string> = {
  front: 'Front',
  left: 'Left',
  right: 'Right',
  crown: 'Crown',
  back: 'Back',
}

export const METRIC_LABELS: Record<MetricKey, string> = {
  oil_score: 'Oil',
  redness_score: 'Redness',
  density_score: 'Density',
  blockage_score: 'Blockage',
  dandruff_score: 'Dandruff',
  sensitivity_score: 'Sensitivity',
}

export function getCapturePointLabel(code: CapturePointCode) {
  return CAPTURE_POINT_LABELS[code]
}
