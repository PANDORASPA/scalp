import test from 'node:test'
import assert from 'node:assert/strict'

import { SCALP_ANALYSIS_AREA_KEYS, SCALP_ANALYSIS_AREA_LABELS } from './constants'
import { createEmptyAnnotations } from './logic'
import { buildScalpAnalysisReport, buildScalpAnalysisCsv } from './report'
import type { ScalpAnalysisSessionState } from './types'

function buildState(overrides: Partial<ScalpAnalysisSessionState['areas'][number]> = {}) {
  const summary = {
    id: 'summary-1',
    customer_id: 'customer-1',
    session_id: 'session-1',
    area_key: 'm_left' as const,
    average_coarse_hair_count: 20,
    average_baby_hair_count: 6,
    average_empty_follicle_count: 2,
    average_blockage_count: 1,
    average_scalp_empty_ratio: 30,
    average_redness_score: 2,
    average_oiliness_score: 3,
    average_density_score: 65,
    compared_to_previous_json: null,
    compared_to_baseline_json: null,
    report_summary: 'M 左：幼毛 6 條，密度 65。',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }
  const completeImages = [1, 2, 3].map((imageIndex) => ({
    id: `image-${imageIndex}`,
    customer_id: 'customer-1',
    session_id: 'session-1',
    area_key: 'm_left' as const,
    image_index: imageIndex as 1 | 2 | 3,
    image_url: `/image-${imageIndex}`,
    drive_file_id: `drive-${imageIndex}`,
    storage_provider: 'demo',
    storage_object_key: null,
    analysis_status: 'confirmed' as const,
    ai_result_json: createEmptyAnnotations(),
    confirmed_annotations_json: createEmptyAnnotations(),
    stats: {
      coarse_hair_count: 20,
      baby_hair_count: 6,
      empty_follicle_count: 2,
      blockage_count: 1,
      scalp_empty_ratio: 30,
      redness_score: 2,
      oiliness_score: 3,
      density_score: 65,
    },
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
  }))
  const areas = SCALP_ANALYSIS_AREA_KEYS.map((area_key) => ({
    area_key,
    label: SCALP_ANALYSIS_AREA_LABELS[area_key],
    images: area_key === 'm_left' ? completeImages : [],
    summary: area_key === 'm_left' ? summary : null,
    uploaded_images: area_key === 'm_left' ? 3 : 0,
    confirmed_images: area_key === 'm_left' ? 3 : 0,
    pending_confirmation_images: 0,
    missing_images: area_key === 'm_left' ? 0 : 3,
    ready_for_average: area_key === 'm_left',
    ...(area_key === 'm_left' ? overrides : {}),
  }))

  return {
    session: {
      id: 'session-1',
      customer_id: 'customer-1',
      check_date: '2026-07-01T00:00:00.000Z',
      staff_name: null,
      notes: 'Follow-up',
      workflow_type: 'scalp_analysis_tracking' as const,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    },
    customer: { id: 'customer-1', name: 'Amy', phone: null },
    areas,
  } as Pick<ScalpAnalysisSessionState, 'session' | 'customer' | 'areas'>
}

test('structured report keeps incomplete areas out of official metrics', () => {
  const report = buildScalpAnalysisReport(buildState())

  assert.equal(report.completed_areas, 1)
  assert.equal(report.incomplete_areas, 5)
  assert.equal(report.session_complete, false)
  assert.equal(report.areas.find((area) => area.area_key === 'm_left')?.metrics.average_baby_hair_count, 6)
  assert.equal(report.areas.find((area) => area.area_key === 'm_right')?.metrics.average_baby_hair_count, null)
  assert.ok(report.warnings.some((warning) => warning.includes('M 字右')))
})

test('structured report marks a fully confirmed six-area session complete', () => {
  const base = buildState()
  const mLeft = base.areas[0]
  const areas = base.areas.map((area) => ({
    ...area,
    images: mLeft.images,
    summary: mLeft.summary,
    uploaded_images: 3,
    confirmed_images: 3,
    missing_images: 0,
    ready_for_average: true,
  }))

  const report = buildScalpAnalysisReport({ ...base, areas })

  assert.equal(report.completed_areas, 6)
  assert.equal(report.incomplete_areas, 0)
  assert.equal(report.session_complete, true)
  assert.equal(report.warnings.length, 0)
})

test('structured report flags completed areas with low capture consistency for review', () => {
  const state = buildState()
  const area = state.areas[0]
  area.images = area.images.map((image, index) =>
    index === 2
      ? {
          ...image,
          stats: {
            ...image.stats,
            coarse_hair_count: 100,
            baby_hair_count: 60,
            empty_follicle_count: 50,
            blockage_count: 20,
            scalp_empty_ratio: 95,
            redness_score: 10,
            oiliness_score: 10,
            density_score: 5,
          },
        }
      : image,
  )

  const report = buildScalpAnalysisReport(state)
  const reportedArea = report.areas.find((item) => item.area_key === 'm_left')

  assert.equal(reportedArea?.status, 'complete')
  assert.equal(reportedArea?.consistency_warning, true)
  assert.ok(report.warnings.some((warning) => warning.includes('一致性') && warning.includes('M 字左')))
})

test('CSV report export keeps incomplete areas visible and escapes cell content', () => {
  const report = buildScalpAnalysisReport(buildState())
  const csv = buildScalpAnalysisCsv({
    ...report,
    areas: report.areas.map((area) =>
      area.area_key === 'm_left'
        ? { ...area, report_summary: '需要覆核，備註："重拍"\n第二行' }
        : area,
    ),
  })

  assert.ok(csv.startsWith('\uFEFF部位,狀態'))
  assert.ok(csv.includes('M 字左,已完成'))
  assert.ok(csv.includes('M 字右,未完成'))
  assert.ok(csv.includes('"需要覆核，備註：""重拍""\n第二行"'))
})
