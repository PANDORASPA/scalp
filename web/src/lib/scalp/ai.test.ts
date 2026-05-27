import test from 'node:test'
import assert from 'node:assert/strict'

import { buildHairCountShotAnalysis, computeAiPointAnalysis } from './ai'
import { buildHeuristicHairCountResult } from './providers/heuristic'

test('buildHairCountShotAnalysis maps a ready heuristic provider result', () => {
  const result = buildHairCountShotAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-1',
    imageId: 'image-1',
    capturePointCode: 'front',
    shotIndex: 1,
    nowISO: '2026-03-18T10:00:00.000Z',
    result: buildHeuristicHairCountResult({
      input: {
        customerId: 'customer-1',
        sessionId: 'session-1',
        imageId: 'image-1',
        imageUrl: '/image-1.jpg',
        capturePointCode: 'front',
        shotIndex: 1,
        metrics: {
          density_score: 6,
          blockage_score: 4,
          dandruff_score: 3,
          redness_score: 2,
        },
        nowISO: '2026-03-18T10:00:00.000Z',
      },
    }),
  })

  assert.equal(result.status, 'ready')
  assert.equal(result.provider_name, 'heuristic')
  assert.equal(result.analysis_method, 'baseline-density-v1')
  assert.equal(result.model_version, 'heuristic-2026-03-18')
  assert.equal(result.hair_count_estimate, 85)
  assert.equal(result.fallback_used, false)
})

test('buildHairCountShotAnalysis preserves pending fallback metadata', () => {
  const result = buildHairCountShotAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-1',
    imageId: 'image-1',
    capturePointCode: 'front',
    shotIndex: 1,
    nowISO: '2026-03-18T10:00:00.000Z',
    result: buildHeuristicHairCountResult({
      input: {
        customerId: 'customer-1',
        sessionId: 'session-1',
        imageId: 'image-1',
        imageUrl: '/image-1.jpg',
        capturePointCode: 'front',
        shotIndex: 1,
        metrics: {
          blockage_score: 4,
        },
        nowISO: '2026-03-18T10:00:00.000Z',
      },
      fallbackReason: 'Provider timed out',
    }),
  })

  assert.equal(result.status, 'pending')
  assert.equal(result.hair_count_estimate, null)
  assert.equal(result.fallback_used, true)
  assert.equal(result.fallback_reason, 'Provider timed out')
  assert.equal(result.raw_output_ref, null)
})

test('computeAiPointAnalysis averages three ready shot analyses and computes trend', () => {
  const baseline = computeAiPointAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-0',
    capturePointCode: 'front',
    shotAnalyses: [
      {
        id: 'a',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-a',
        capture_point_code: 'front',
        shot_index: 1,
        hair_count_estimate: 70,
        confidence_score: 0.6,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'b',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-b',
        capture_point_code: 'front',
        shot_index: 2,
        hair_count_estimate: 74,
        confidence_score: 0.62,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'c',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-c',
        capture_point_code: 'front',
        shot_index: 3,
        hair_count_estimate: 76,
        confidence_score: 0.64,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
    ],
    nowISO: '2026-03-18T10:00:00.000Z',
  })

  const current = computeAiPointAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-1',
    capturePointCode: 'front',
    shotAnalyses: [
      {
        id: 'x',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-x',
        capture_point_code: 'front',
        shot_index: 1,
        hair_count_estimate: 78,
        confidence_score: 0.7,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'y',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-y',
        capture_point_code: 'front',
        shot_index: 2,
        hair_count_estimate: 80,
        confidence_score: 0.72,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'z',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-z',
        capture_point_code: 'front',
        shot_index: 3,
        hair_count_estimate: 82,
        confidence_score: 0.74,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
    ],
    nowISO: '2026-03-18T10:00:00.000Z',
    previous: baseline,
  })

  assert.equal(baseline.completed, true)
  assert.equal(baseline.hair_count_avg_3shot, 73.33)
  assert.equal(baseline.hair_count_min, 70)
  assert.equal(baseline.hair_count_max, 76)
  assert.equal(baseline.provider_name, 'heuristic')
  assert.equal(baseline.capture_consistency_score, 0.9)
  assert.equal(baseline.fallback_used, false)
  assert.equal(baseline.trend_direction, 'inconclusive')
  assert.equal(current.completed, true)
  assert.equal(current.hair_count_avg_3shot, 80)
  assert.equal(current.change_vs_previous, 6.67)
  assert.equal(current.capture_consistency_score, 0.94)
  assert.equal(current.trend_direction, 'improved')
})

test('computeAiPointAnalysis treats small changes as stable and large shot spread as inconclusive', () => {
  const previous = computeAiPointAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-0',
    capturePointCode: 'front',
    shotAnalyses: [
      {
        id: 'p1',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-p1',
        capture_point_code: 'front',
        shot_index: 1,
        hair_count_estimate: 100,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'p2',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-p2',
        capture_point_code: 'front',
        shot_index: 2,
        hair_count_estimate: 100,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'p3',
        customer_id: 'customer-1',
        session_id: 'session-0',
        image_id: 'img-p3',
        capture_point_code: 'front',
        shot_index: 3,
        hair_count_estimate: 100,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
    ],
    nowISO: '2026-03-18T10:00:00.000Z',
  })

  const stable = computeAiPointAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-1',
    capturePointCode: 'front',
    shotAnalyses: [
      {
        id: 's1',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-s1',
        capture_point_code: 'front',
        shot_index: 1,
        hair_count_estimate: 101,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 's2',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-s2',
        capture_point_code: 'front',
        shot_index: 2,
        hair_count_estimate: 102,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 's3',
        customer_id: 'customer-1',
        session_id: 'session-1',
        image_id: 'img-s3',
        capture_point_code: 'front',
        shot_index: 3,
        hair_count_estimate: 101,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
    ],
    nowISO: '2026-03-18T10:00:00.000Z',
    previous,
  })

  const inconclusive = computeAiPointAnalysis({
    customerId: 'customer-1',
    sessionId: 'session-2',
    capturePointCode: 'front',
    shotAnalyses: [
      {
        id: 'i1',
        customer_id: 'customer-1',
        session_id: 'session-2',
        image_id: 'img-i1',
        capture_point_code: 'front',
        shot_index: 1,
        hair_count_estimate: 60,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'i2',
        customer_id: 'customer-1',
        session_id: 'session-2',
        image_id: 'img-i2',
        capture_point_code: 'front',
        shot_index: 2,
        hair_count_estimate: 100,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
      {
        id: 'i3',
        customer_id: 'customer-1',
        session_id: 'session-2',
        image_id: 'img-i3',
        capture_point_code: 'front',
        shot_index: 3,
        hair_count_estimate: 140,
        confidence_score: 0.8,
        provider_name: 'heuristic',
        analysis_method: 'baseline-density-v1',
        model_version: 'heuristic-2026-03-18',
        status: 'ready',
        notes: null,
        fallback_used: false,
        fallback_reason: null,
        raw_output_ref: null,
        created_at: '2026-03-18T10:00:00.000Z',
        updated_at: '2026-03-18T10:00:00.000Z',
      },
    ],
    nowISO: '2026-03-18T10:00:00.000Z',
    previous,
  })

  assert.equal(stable.change_vs_previous, 1.33)
  assert.equal(stable.trend_direction, 'stable')
  assert.match(stable.trend_summary, /stable/i)
  assert.equal(inconclusive.capture_consistency_score, 0.07)
  assert.equal(inconclusive.trend_direction, 'inconclusive')
})
