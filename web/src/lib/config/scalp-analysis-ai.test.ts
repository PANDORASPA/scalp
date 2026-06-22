import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeScalpAnalysisAiProvider } from './scalp-analysis-ai'

test('normalizeScalpAnalysisAiProvider only enables supported real providers', () => {
  assert.equal(normalizeScalpAnalysisAiProvider('openai-5.5'), 'openai-5.5')
  assert.equal(normalizeScalpAnalysisAiProvider(' OpenAI-5.5 '), 'openai-5.5')
  assert.equal(normalizeScalpAnalysisAiProvider(undefined), 'mock')
  assert.equal(normalizeScalpAnalysisAiProvider('openai'), 'mock')
  assert.equal(normalizeScalpAnalysisAiProvider('gemini'), 'mock')
})
