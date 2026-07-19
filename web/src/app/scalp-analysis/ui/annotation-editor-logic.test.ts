import test from 'node:test'
import assert from 'node:assert/strict'

import { createEmptyAnnotations } from '@/lib/scalp-analysis/logic'
import {
  getAnnotationEditorCanvasSize,
  getAnnotationEditorInitialAnnotations,
  getAnnotationEditorAiResetAnnotations,
  shouldEndAnnotationDragOnPointerEvent,
  updateAnnotationScore,
} from './annotation-editor-logic'

test('annotation editor starts from confirmed annotations when available', () => {
  const ai = createEmptyAnnotations()
  ai.baby_hairs = [{ id: 'ai-baby', x: 10, y: 10, confidence: 0.8 }]
  const confirmed = createEmptyAnnotations()
  confirmed.baby_hairs = [{ id: 'confirmed-baby', x: 20, y: 20, confidence: null }]

  const initial = getAnnotationEditorInitialAnnotations({
    ai_result_json: ai,
    confirmed_annotations_json: confirmed,
  })

  assert.deepEqual(initial.baby_hairs.map((item) => item.id), ['confirmed-baby'])
})

test('annotation editor AI reset always uses the AI result instead of confirmed annotations', () => {
  const ai = createEmptyAnnotations()
  ai.baby_hairs = [{ id: 'ai-baby', x: 10, y: 10, confidence: 0.8 }]
  const confirmed = createEmptyAnnotations()
  confirmed.baby_hairs = [{ id: 'confirmed-baby', x: 20, y: 20, confidence: null }]

  const reset = getAnnotationEditorAiResetAnnotations({
    ai_result_json: ai,
    confirmed_annotations_json: confirmed,
  })

  assert.deepEqual(reset.baby_hairs.map((item) => item.id), ['ai-baby'])
})

test('annotation editor clamps manual score corrections to supported ranges', () => {
  const scores = createEmptyAnnotations().scores

  assert.equal(updateAnnotationScore(scores, 'scalp_empty_ratio', '125').scalp_empty_ratio, 100)
  assert.equal(updateAnnotationScore(scores, 'redness_score', '-2').redness_score, 0)
  assert.equal(updateAnnotationScore(scores, 'density_score', '').density_score, null)
  assert.equal(updateAnnotationScore(scores, 'oiliness_score', 'not-a-number').oiliness_score, null)
})

test('annotation editor uses natural image dimensions when AI dimensions are unavailable', () => {
  const annotations = createEmptyAnnotations()

  assert.deepEqual(getAnnotationEditorCanvasSize(annotations, { width: 1600, height: 900 }), {
    width: 1600,
    height: 900,
  })
  assert.deepEqual(
    getAnnotationEditorCanvasSize({ ...annotations, image_width: 720, image_height: 480 }, { width: 1600, height: 900 }),
    { width: 720, height: 480 },
  )
})

test('annotation editor keeps a drag alive when the pointer leaves the canvas', () => {
  assert.equal(shouldEndAnnotationDragOnPointerEvent('pointerleave'), false)
  assert.equal(shouldEndAnnotationDragOnPointerEvent('pointerup'), true)
  assert.equal(shouldEndAnnotationDragOnPointerEvent('pointercancel'), true)
})
