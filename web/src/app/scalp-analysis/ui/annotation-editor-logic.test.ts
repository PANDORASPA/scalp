import test from 'node:test'
import assert from 'node:assert/strict'

import { createEmptyAnnotations } from '@/lib/scalp-analysis/logic'
import {
  getAnnotationEditorInitialAnnotations,
  getAnnotationEditorAiResetAnnotations,
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
