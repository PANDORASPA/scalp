export const CAPTURE_POINT_CODES = [
  'front',
  'left',
  'right',
  'crown',
  'back',
] as const

export type CapturePointCode = (typeof CAPTURE_POINT_CODES)[number]

export const IMAGE_TYPES = ['micro'] as const

export type ImageType = (typeof IMAGE_TYPES)[number]

export const METRIC_KEYS = [
  'oil_score',
  'redness_score',
  'density_score',
  'blockage_score',
  'dandruff_score',
  'sensitivity_score',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

export const AVG_KEYS = [
  'oil_avg',
  'redness_avg',
  'density_avg',
  'blockage_avg',
  'dandruff_avg',
  'sensitivity_avg',
] as const

export type AvgKey = (typeof AVG_KEYS)[number]

export const CHANGE_KEYS = [
  'oil_change',
  'redness_change',
  'density_change',
  'blockage_change',
  'dandruff_change',
  'sensitivity_change',
] as const

export type ChangeKey = (typeof CHANGE_KEYS)[number]

