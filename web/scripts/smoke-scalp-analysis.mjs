const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000'
const username = process.env.SMOKE_USERNAME?.trim() || 'admin'
const password = process.env.SMOKE_PASSWORD?.trim() || 'admin123'
const cleanupSmokeCustomer = process.env.SMOKE_CLEANUP === 'true'

const areaKeys = ['m_left', 'm_right', 'front_center', 'crown', 'vertex', 'occipital_control']

function fail(message) {
  throw new Error(message)
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 45000)
  let res
  let text
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
    text = await res.text()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${init.method || 'GET'} ${url} timed out after 45000ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${url} failed (${res.status}): ${JSON.stringify(json)}`)
  }
  return { res, json }
}

function buildTinyPngBuffer() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sotYVUAAAAASUVORK5CYII=',
    'base64',
  )
}

function fallbackAnnotations(areaKey, imageIndex, sessionNumber) {
  const base = areaKeys.indexOf(areaKey) + imageIndex
  const improvement = sessionNumber === 2 ? 4 : 0
  const stressReduction = sessionNumber === 2 ? 1 : 0
  return {
    coarse_hairs: Array.from({ length: 10 + base + improvement }, (_, index) => ({
      id: `coarse-${areaKey}-${imageIndex}-${index + 1}`,
      x: 40 + index * 8,
      y: 60 + index * 3,
      confidence: 0.8,
    })),
    baby_hairs: Array.from({ length: 2 + imageIndex + improvement }, (_, index) => ({
      id: `baby-${areaKey}-${imageIndex}-${index + 1}`,
      x: 80 + index * 12,
      y: 90 + index * 5,
      confidence: 0.76,
    })),
    empty_follicles: [{ id: `empty-${areaKey}-${imageIndex}`, x: 180, y: 120, confidence: 0.72 }],
    blockages: [{ id: `blockage-${areaKey}-${imageIndex}`, x: 140, y: 130, radius: 12, confidence: 0.7, severity: null }],
    redness_regions: [{ id: `redness-${areaKey}-${imageIndex}`, x: 220, y: 160, radius: 20, confidence: 0.68, severity: 2 }],
    scores: {
      scalp_empty_ratio: 35 - improvement,
      redness_score: 2 - stressReduction,
      oiliness_score: 3 - stressReduction,
      blockage_score: 2 - stressReduction,
      density_score: 65 + improvement * 2,
    },
    notes: 'Smoke-test confirmed annotations.',
    image_width: 720,
    image_height: 480,
  }
}

async function createAndCompleteSession({ customerId, headers, sessionNumber }) {
  const createdSession = await fetchJson(`${baseUrl}/api/scalp-analysis/sessions`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      sessionDate: new Date(Date.UTC(2026, 0, sessionNumber)).toISOString(),
      notes: `Full 6-area smoke test session ${sessionNumber}`,
    }),
  })
  const sessionId = createdSession.json?.id
  if (!sessionId) fail('scalp-analysis session creation did not return an id')

  for (const areaKey of areaKeys) {
    console.log(`Session ${sessionNumber}: uploading and confirming ${areaKey}`)
    for (const imageIndex of [1, 2, 3]) {
      const form = new FormData()
      form.set('sessionId', sessionId)
      form.set('customerId', customerId)
      form.set('areaKey', areaKey)
      form.set('imageIndex', String(imageIndex))
      form.set('file', new File([buildTinyPngBuffer()], `${areaKey}-${imageIndex}.png`, { type: 'image/png' }))

      const uploaded = await fetchJson(`${baseUrl}/api/scalp-analysis/images`, {
        method: 'POST',
        headers,
        body: form,
      })
      const image = uploaded.json
      if (!image?.id) fail(`upload did not return image id for ${areaKey}/${imageIndex}`)

      const annotations = fallbackAnnotations(areaKey, imageIndex, sessionNumber)
      await fetchJson(`${baseUrl}/api/scalp-analysis/images/${image.id}/confirm`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations }),
      })
    }
  }

  const state = await fetchJson(`${baseUrl}/api/scalp-analysis/sessions/${sessionId}`, { headers })
  const areas = state.json?.areas ?? []
  if (areas.length !== 6) fail(`expected 6 areas, got ${areas.length}`)

  for (const area of areas) {
    if (area.images.length !== 3) fail(`${area.area_key} expected 3 images, got ${area.images.length}`)
    if (!area.ready_for_average) fail(`${area.area_key} is not ready_for_average after three confirmations`)
    if (!area.summary) fail(`${area.area_key} did not generate an area summary`)
    if (typeof area.summary.average_coarse_hair_count !== 'number') {
      fail(`${area.area_key} summary is missing average_coarse_hair_count`)
    }
    if (typeof area.summary.average_baby_hair_count !== 'number') {
      fail(`${area.area_key} summary is missing average_baby_hair_count`)
    }
    if (sessionNumber === 1) {
      if (area.summary.compared_to_previous_json) fail(`${area.area_key} baseline session should not have previous comparison`)
      if (area.summary.compared_to_baseline_json) fail(`${area.area_key} baseline session should not compare to itself`)
    }
    if (sessionNumber === 2) {
      if (!area.summary.compared_to_previous_json) fail(`${area.area_key} second session is missing previous comparison`)
      if (!area.summary.compared_to_baseline_json) fail(`${area.area_key} second session is missing baseline comparison`)
      if (area.summary.compared_to_previous_json.baby_hair_count.direction !== 'improved') {
        fail(`${area.area_key} second session baby hair trend should be improved`)
      }
      if (area.summary.compared_to_baseline_json.density_score.direction !== 'improved') {
        fail(`${area.area_key} second session density baseline trend should be improved`)
      }
    }
  }

  if (!Array.isArray(state.json?.report_lines) || state.json.report_lines.length !== 6) {
    fail(`expected 6 report lines, got ${state.json?.report_lines?.length ?? 0}`)
  }

  return { sessionId, state: state.json }
}

async function main() {
  console.log(`Running scalp-analysis smoke flow against ${baseUrl}`)
  let headers = null
  let customerId = null
  let smokePassed = false

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookie = login.res.headers.get('set-cookie')
  if (!cookie) fail('login succeeded but no auth cookie was returned')
  headers = { Cookie: cookie }

  try {
    const customerName = `Scalp Smoke ${Date.now()}`
    const createdCustomer = await fetchJson(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: customerName,
        phone: '0900 000 000',
        notes: 'Created by smoke-scalp-analysis.mjs',
      }),
    })
    customerId = createdCustomer.json?.customer?.id || createdCustomer.json?.id
    if (!customerId) fail('customer creation did not return an id')

    const baseline = await createAndCompleteSession({ customerId, headers, sessionNumber: 1 })
    const followUp = await createAndCompleteSession({ customerId, headers, sessionNumber: 2 })

    const overview = await fetchJson(`${baseUrl}/api/customers/${customerId}/overview`, { headers })
    if (overview.json?.customer?.id !== customerId) fail('customer overview did not return the smoke customer')

    smokePassed = true
    console.log(
      `Scalp-analysis smoke flow passed for customer ${customerId}, baseline ${baseline.sessionId}, follow-up ${followUp.sessionId}.`,
    )
  } finally {
    if (cleanupSmokeCustomer && customerId && headers) {
      try {
        await fetchJson(`${baseUrl}/api/customers/${customerId}`, {
          method: 'DELETE',
          headers,
        })
        console.log(`Cleaned up smoke customer ${customerId}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`SCALP ANALYSIS SMOKE CLEANUP FAIL: ${message}`)
      }
    }
  }
  console.log('If this ran with SCALP_ANALYSIS_STORAGE_PROVIDER=demo, repeat once with Google Drive credentials before using real customer images.')
  if (!smokePassed) fail('scalp-analysis smoke flow did not complete')
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`SCALP ANALYSIS SMOKE FAIL: ${message}`)
  process.exit(1)
})
