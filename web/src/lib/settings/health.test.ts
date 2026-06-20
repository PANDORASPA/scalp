import test from 'node:test'
import assert from 'node:assert/strict'

import { buildHealthSummary } from './health'
import type { IntegrationStatus } from './status'

function integration(overrides: Partial<IntegrationStatus>): IntegrationStatus {
  return {
    key: overrides.key ?? 'supabase',
    label: overrides.label ?? 'Supabase',
    ready: overrides.ready ?? true,
    officialReady: overrides.officialReady ?? true,
    mode: overrides.mode ?? 'official',
    requiredFor: overrides.requiredFor ?? 'records',
    details: overrides.details ?? 'ready',
    nextAction: overrides.nextAction,
  }
}

const version = {
  commit: 'abc123',
  branch: 'main',
  deploymentUrl: 'example.vercel.app',
}

test('buildHealthSummary marks all-official integrations as official_ready', () => {
  const summary = buildHealthSummary({
    checkedAt: '2026-06-20T00:00:00.000Z',
    version,
    integrations: [
      integration({ key: 'supabase' }),
      integration({ key: 'google-drive' }),
      integration({ key: 'scalp-ai' }),
    ],
  })

  assert.equal(summary.ok, true)
  assert.equal(summary.officialReady, true)
  assert.equal(summary.status, 'official_ready')
  assert.deepEqual(summary.blockers, [])
  assert.equal(summary.version.commit, 'abc123')
})

test('buildHealthSummary keeps operational mode separate from official readiness', () => {
  const summary = buildHealthSummary({
    checkedAt: '2026-06-20T00:00:00.000Z',
    version,
    integrations: [
      integration({ key: 'supabase' }),
      integration({
        key: 'google-drive',
        label: 'Google Drive',
        ready: true,
        officialReady: false,
        mode: 'demo',
        details: 'Demo storage is active.',
        nextAction: 'Add Google Drive credentials.',
      }),
      integration({
        key: 'scalp-ai',
        label: 'AI',
        ready: true,
        officialReady: false,
        mode: 'mock',
        details: 'Mock AI is active.',
        nextAction: 'Add OpenAI key.',
      }),
    ],
  })

  assert.equal(summary.ok, true)
  assert.equal(summary.officialReady, false)
  assert.equal(summary.status, 'operational_with_demo_integrations')
  assert.deepEqual(summary.blockers.map((item) => item.key), ['google-drive', 'scalp-ai'])
  assert.equal(summary.blockers[0]?.nextAction, 'Add Google Drive credentials.')
  assert.equal(summary.blockers[1]?.mode, 'mock')
})

test('buildHealthSummary marks missing required integrations as not_ready', () => {
  const summary = buildHealthSummary({
    checkedAt: '2026-06-20T00:00:00.000Z',
    version,
    integrations: [
      integration({
        key: 'supabase',
        label: 'Supabase',
        ready: false,
        officialReady: false,
        mode: 'missing',
        details: 'Missing server env.',
      }),
      integration({ key: 'google-drive' }),
    ],
  })

  assert.equal(summary.ok, false)
  assert.equal(summary.officialReady, false)
  assert.equal(summary.status, 'not_ready')
  assert.deepEqual(summary.blockers.map((item) => item.key), ['supabase'])
  assert.equal(summary.blockers[0]?.nextAction, null)
})
