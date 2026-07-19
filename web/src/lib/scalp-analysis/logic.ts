import { SCALP_ANALYSIS_ANNOTATION_LABELS, type ScalpAnalysisAreaKey } from './constants'
import type {
  ScalpAnalysisAnnotations,
  ScalpAnalysisImage,
  ScalpAreaSummary,
  ScalpImageStats,
  ScalpSessionComparison,
  ScalpSessionComparisonMetric,
} from './types'

export function createEmptyAnnotations(): ScalpAnalysisAnnotations {
  return {
    coarse_hairs: [],
    baby_hairs: [],
    empty_follicles: [],
    blockages: [],
    redness_regions: [],
    scores: {
      scalp_empty_ratio: null,
      redness_score: null,
      oiliness_score: null,
      blockage_score: null,
      density_score: null,
    },
    notes: '',
  }
}

export function normalizeAnnotations(input: unknown): ScalpAnalysisAnnotations {
  if (!input || typeof input !== 'object') return createEmptyAnnotations()
  const source = input as Record<string, unknown>
  const fallback = createEmptyAnnotations()

  function finiteOrNull(value: unknown) {
    const number = Number(value)
    return Number.isFinite(number) ? number : null
  }

  function boundedNumber(value: unknown, min: number, max: number) {
    const number = finiteOrNull(value)
    return number === null ? null : Math.max(min, Math.min(max, number))
  }

  function normalizePointArray(key: string) {
    const value = source[key]
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const marker = item as Record<string, unknown>
        return {
          id: typeof marker.id === 'string' ? marker.id : `${key}-${index + 1}`,
          x: Number(marker.x ?? 0),
          y: Number(marker.y ?? 0),
          confidence:
            marker.confidence === null || marker.confidence === undefined
              ? null
              : boundedNumber(marker.confidence, 0, 1),
        }
      })
      .filter((marker) => Number.isFinite(marker.x) && Number.isFinite(marker.y))
  }

  function normalizeCircleArray(key: string) {
    const value = source[key]
    if (!Array.isArray(value)) return []
    return value
      .filter((item) => item && typeof item === 'object')
      .map((item, index) => {
        const marker = item as Record<string, unknown>
        return {
          id: typeof marker.id === 'string' ? marker.id : `${key}-${index + 1}`,
          x: Number(marker.x ?? 0),
          y: Number(marker.y ?? 0),
          radius: boundedNumber(marker.radius ?? 12, 1, 200) ?? 12,
          confidence:
            marker.confidence === null || marker.confidence === undefined
              ? null
              : boundedNumber(marker.confidence, 0, 1),
          severity:
            marker.severity === null || marker.severity === undefined
              ? null
              : boundedNumber(marker.severity, 1, 5),
        }
      })
      .filter(
        (marker) =>
          Number.isFinite(marker.x) && Number.isFinite(marker.y) && Number.isFinite(marker.radius),
      )
  }

  const scores = source.scores && typeof source.scores === 'object' ? (source.scores as Record<string, unknown>) : {}

  return {
    coarse_hairs: normalizePointArray('coarse_hairs'),
    baby_hairs: normalizePointArray('baby_hairs'),
    empty_follicles: normalizePointArray('empty_follicles'),
    blockages: normalizeCircleArray('blockages'),
    redness_regions: normalizeCircleArray('redness_regions'),
    scores: {
      scalp_empty_ratio:
        scores.scalp_empty_ratio === null || scores.scalp_empty_ratio === undefined
          ? fallback.scores.scalp_empty_ratio
          : boundedNumber(scores.scalp_empty_ratio, 0, 100),
      redness_score:
        scores.redness_score === null || scores.redness_score === undefined
          ? fallback.scores.redness_score
          : boundedNumber(scores.redness_score, 0, 10),
      oiliness_score:
        scores.oiliness_score === null || scores.oiliness_score === undefined
          ? fallback.scores.oiliness_score
          : boundedNumber(scores.oiliness_score, 0, 10),
      blockage_score:
        scores.blockage_score === null || scores.blockage_score === undefined
          ? fallback.scores.blockage_score
          : boundedNumber(scores.blockage_score, 0, 10),
      density_score:
        scores.density_score === null || scores.density_score === undefined
          ? fallback.scores.density_score
          : boundedNumber(scores.density_score, 0, 100),
    },
    notes: typeof source.notes === 'string' ? source.notes : '',
    image_width: source.image_width === undefined || source.image_width === null ? null : boundedNumber(source.image_width, 1, 10000),
    image_height: source.image_height === undefined || source.image_height === null ? null : boundedNumber(source.image_height, 1, 10000),
  }
}

export function calculateStatsFromAnnotations(annotations: ScalpAnalysisAnnotations): ScalpImageStats {
  const coarse = annotations.coarse_hairs.length
  const baby = annotations.baby_hairs.length
  const empty = annotations.empty_follicles.length
  const blockage = annotations.blockages.length
  const rednessLevels = annotations.redness_regions
    .map((item) => item.severity)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const rednessScore =
    annotations.scores.redness_score ??
    (rednessLevels.length
      ? Math.round((rednessLevels.reduce((sum, value) => sum + value, 0) / rednessLevels.length) * 10) / 10
      : null)
  const blockageScore =
    annotations.scores.blockage_score ??
    (blockage === 0 ? 0 : Math.min(10, Math.round(blockage / 2)))
  const densityScore =
    annotations.scores.density_score ??
    Math.max(0, Math.min(100, Math.round(coarse * 2.8 + baby * 1.6 - empty * 1.4)))
  const emptyRatio =
    annotations.scores.scalp_empty_ratio ??
    Math.max(0, Math.min(100, Math.round(55 - coarse * 0.9 - baby * 0.45 + empty * 0.8)))

  return {
    coarse_hair_count: coarse,
    baby_hair_count: baby,
    empty_follicle_count: empty,
    blockage_count: blockage,
    scalp_empty_ratio: emptyRatio,
    redness_score: rednessScore,
    oiliness_score: annotations.scores.oiliness_score,
    density_score: densityScore,
  }
}

export function hasCompleteScalpImageStats(stats: ScalpImageStats) {
  return [
    stats.coarse_hair_count,
    stats.baby_hair_count,
    stats.empty_follicle_count,
    stats.blockage_count,
    stats.scalp_empty_ratio,
    stats.redness_score,
    stats.oiliness_score,
    stats.density_score,
  ].every((value) => typeof value === 'number' && Number.isFinite(value))
}

export function isConfirmedScalpAnalysisImage(
  image: Pick<ScalpAnalysisImage, 'analysis_status' | 'confirmed_annotations_json' | 'stats'>,
) {
  if (image.analysis_status !== 'confirmed' || !image.confirmed_annotations_json) return false
  return hasCompleteScalpImageStats(image.stats)
}

export function calculateCaptureConsistencyScore(images: ScalpAnalysisImage[]) {
  const confirmedImages = images.filter(isConfirmedScalpAnalysisImage)
  if (confirmedImages.length !== 3) return null

  const metrics: Array<{ values: Array<number | null>; scale: number }> = [
    { values: confirmedImages.map((image) => image.stats.coarse_hair_count), scale: 0 },
    { values: confirmedImages.map((image) => image.stats.baby_hair_count), scale: 0 },
    { values: confirmedImages.map((image) => image.stats.empty_follicle_count), scale: 0 },
    { values: confirmedImages.map((image) => image.stats.blockage_count), scale: 0 },
    { values: confirmedImages.map((image) => image.stats.scalp_empty_ratio), scale: 100 },
    { values: confirmedImages.map((image) => image.stats.redness_score), scale: 10 },
    { values: confirmedImages.map((image) => image.stats.oiliness_score), scale: 10 },
    { values: confirmedImages.map((image) => image.stats.density_score), scale: 100 },
  ]

  const spreads = metrics
    .map(({ values, scale }) => {
      const ready = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      if (ready.length !== 3) return null
      const spread = Math.max(...ready) - Math.min(...ready)
      if (scale > 0) return Math.min(1, spread / scale)
      const averageValue = ready.reduce((sum, value) => sum + value, 0) / ready.length
      return Math.min(1, spread / Math.max(1, Math.abs(averageValue)))
    })
    .filter((value): value is number => value !== null)

  if (!spreads.length) return null
  return Math.round((1 - spreads.reduce((sum, value) => sum + value, 0) / spreads.length) * 100)
}

export const CAPTURE_CONSISTENCY_REVIEW_THRESHOLD = 70

export function isTrustworthyCaptureConsistencyScore(score: number | null | undefined) {
  // Null keeps legacy summaries usable until their images are recalculated.
  return typeof score !== 'number' || score >= CAPTURE_CONSISTENCY_REVIEW_THRESHOLD
}

function average(values: Array<number | null | undefined>) {
  const ready = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!ready.length) return null
  return Math.round((ready.reduce((sum, value) => sum + value, 0) / ready.length) * 10) / 10
}

export function calculateAreaAverages(images: ScalpAnalysisImage[]) {
  return {
    average_coarse_hair_count: average(images.map((image) => image.stats.coarse_hair_count)),
    average_baby_hair_count: average(images.map((image) => image.stats.baby_hair_count)),
    average_empty_follicle_count: average(images.map((image) => image.stats.empty_follicle_count)),
    average_blockage_count: average(images.map((image) => image.stats.blockage_count)),
    average_scalp_empty_ratio: average(images.map((image) => image.stats.scalp_empty_ratio)),
    average_redness_score: average(images.map((image) => image.stats.redness_score)),
    average_oiliness_score: average(images.map((image) => image.stats.oiliness_score)),
    average_density_score: average(images.map((image) => image.stats.density_score)),
  }
}

function makeMetric(label: string, current: number | null, previous: number | null, higherIsBetter: boolean): ScalpSessionComparisonMetric {
  if (typeof current !== 'number' || typeof previous !== 'number') {
    return {
      previous,
      current,
      delta: null,
      direction: 'inconclusive',
      label: `${label}資料未齊`,
    }
  }

  const delta = Math.round((current - previous) * 10) / 10
  if (Math.abs(delta) < 0.1) {
    return {
      previous,
      current,
      delta,
      direction: 'stable',
      label: `${label}大致持平`,
    }
  }

  const improved = higherIsBetter ? delta > 0 : delta < 0
  return {
    previous,
    current,
    delta,
    direction: improved ? 'improved' : 'declined',
    label: improved ? `${label}改善` : `${label}回落`,
  }
}

export function compareAreaSummaries(params: {
  current: Pick<
    ScalpAreaSummary,
    | 'average_baby_hair_count'
    | 'average_coarse_hair_count'
    | 'average_scalp_empty_ratio'
    | 'average_density_score'
    | 'average_redness_score'
    | 'average_oiliness_score'
    | 'average_blockage_count'
  >
  reference: Pick<
    ScalpAreaSummary,
    | 'average_baby_hair_count'
    | 'average_coarse_hair_count'
    | 'average_scalp_empty_ratio'
    | 'average_density_score'
    | 'average_redness_score'
    | 'average_oiliness_score'
    | 'average_blockage_count'
  >
  referenceSessionId: string
  referenceSessionDate: string
}): ScalpSessionComparison {
  const baby = makeMetric('幼毛', params.current.average_baby_hair_count, params.reference.average_baby_hair_count, true)
  const coarse = makeMetric('粗髮', params.current.average_coarse_hair_count, params.reference.average_coarse_hair_count, true)
  const emptyRatio = makeMetric('空白頭皮比例', params.current.average_scalp_empty_ratio, params.reference.average_scalp_empty_ratio, false)
  const density = makeMetric('密度分數', params.current.average_density_score, params.reference.average_density_score, true)
  const redness = makeMetric('紅腫', params.current.average_redness_score, params.reference.average_redness_score, false)
  const oiliness = makeMetric('出油', params.current.average_oiliness_score, params.reference.average_oiliness_score, false)
  const blockage = makeMetric('堵塞', params.current.average_blockage_count, params.reference.average_blockage_count, false)

  const lines = [
    `幼毛：${formatDeltaLine(baby, '條')}`,
    `粗髮：${formatDeltaLine(coarse, '條')}`,
    `空白頭皮比例：${formatDeltaLine(emptyRatio, '%')}`,
    `密度分數：${formatDeltaLine(density, '')}`,
    `堵塞：${formatDeltaLine(blockage, '個')}`,
  ]

  return {
    reference_session_id: params.referenceSessionId,
    reference_session_date: params.referenceSessionDate,
    baby_hair_count: baby,
    coarse_hair_count: coarse,
    scalp_empty_ratio: emptyRatio,
    density_score: density,
    redness_score: redness,
    oiliness_score: oiliness,
    blockage_count: blockage,
    summary_lines: lines,
  }
}

function formatMetricValue(value: number | null, suffix: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${value}${suffix}`
}

function formatDeltaLine(metric: ScalpSessionComparisonMetric, suffix: string) {
  if (metric.delta === null) return '資料不足'
  const change = metric.delta > 0 ? `增加 ${metric.delta}${suffix}` : metric.delta < 0 ? `減少 ${Math.abs(metric.delta)}${suffix}` : '持平'
  return `上次 ${formatMetricValue(metric.previous, suffix)}，今次 ${formatMetricValue(metric.current, suffix)}，${change}`
}

export function buildAreaReportLine(areaLabel: string, summary: ScalpAreaSummary | null) {
  if (!summary) {
    return `${areaLabel}：未完成 3 張已確認圖片，暫時未能生成報告。`
  }

  const lines = summary.compared_to_previous_json?.summary_lines ?? summary.compared_to_baseline_json?.summary_lines ?? []
  if (!lines.length) {
    return `${areaLabel}：已完成平均統計，但暫時未有可比較的歷史 session。`
  }

  return `${areaLabel}：${lines.join('；')}`
}

export function getAnnotationCountLabel(type: keyof Pick<ScalpAnalysisAnnotations, 'coarse_hairs' | 'baby_hairs' | 'empty_follicles' | 'blockages' | 'redness_regions'>, count: number) {
  return `${SCALP_ANALYSIS_ANNOTATION_LABELS[type]} ${count}`
}

export function isAreaKey(value: string): value is ScalpAnalysisAreaKey {
  return (
    value === 'm_left' ||
    value === 'm_right' ||
    value === 'front_center' ||
    value === 'crown' ||
    value === 'vertex' ||
    value === 'occipital_control'
  )
}
