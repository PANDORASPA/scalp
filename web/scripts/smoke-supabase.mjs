import { createClient } from '@supabase/supabase-js'
import dns from 'node:dns/promises'

const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || ''
const supabaseUrl = process.env.SUPABASE_URL?.trim() || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'scalp-images'

function fail(message) {
  console.error(`SMOKE FAIL: ${message}`)
  process.exit(1)
}

function requireEnv(name, value) {
  if (!value) fail(`${name} is required`)
}

function parseSupabaseUrl() {
  let parsed
  try {
    parsed = new URL(supabaseUrl)
  } catch {
    fail(`SUPABASE_URL is not a valid URL: ${supabaseUrl || '<empty>'}`)
  }
  if (parsed.protocol !== 'https:') fail(`SUPABASE_URL must start with https://, got ${parsed.protocol}`)
  return parsed
}

function checkServiceRoleKeyShape() {
  if (!supabaseKey.startsWith('eyJ') || supabaseKey.split('.').length !== 3 || supabaseKey.length < 100) {
    fail('SUPABASE_SERVICE_ROLE_KEY does not look like a valid service role JWT')
  }
}

async function checkSupabaseDns(hostname) {
  try {
    await dns.lookup(hostname)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(
      `DNS cannot resolve ${hostname}: ${message}. Copy SUPABASE_URL from Supabase Settings > API instead of guessing from the dashboard URL.`,
    )
  }
}

async function fetchJson(url, init = {}) {
  const res = await fetch(url, init)
  const text = await res.text()
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

async function main() {
  requireEnv('SUPABASE_URL', supabaseUrl)
  requireEnv('SUPABASE_SERVICE_ROLE_KEY', supabaseKey)
  const parsedSupabaseUrl = parseSupabaseUrl()
  checkServiceRoleKeyShape()
  await checkSupabaseDns(parsedSupabaseUrl.hostname)

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const checks = [
    ['customers', 'customers'],
    ['scalp_sessions', 'scalp_sessions'],
    ['scalp_images', 'scalp_images'],
    ['scalp_image_metrics', 'scalp_image_metrics'],
    ['scalp_point_summaries', 'scalp_point_summaries'],
    ['scalp_comparisons', 'scalp_comparisons'],
    ['scalp_ai_shot_analyses', 'scalp_ai_shot_analyses'],
    ['scalp_ai_point_analyses', 'scalp_ai_point_analyses'],
    ['scalp_capture_points', 'scalp_capture_points'],
  ]

  for (const [table, label] of checks) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true })
    if (error) fail(`table ${label} is unavailable: ${error.message}`)
  }

  const { data: bucketInfo, error: bucketError } = await client.storage.getBucket(bucket)
  if (bucketError) fail(`storage bucket "${bucket}" is unavailable: ${bucketError.message}`)
  if (!bucketInfo) fail(`storage bucket "${bucket}" was not found`)

  const { data: capturePoints, error: capturePointError } = await client
    .from('scalp_capture_points')
    .select('code')
  if (capturePointError) fail(`capture point query failed: ${capturePointError.message}`)
  if (!capturePoints || capturePoints.length < 5) fail('capture points are missing; run migrations 0001-0003')

  console.log('Supabase schema and storage checks passed.')

  if (!baseUrl) {
    console.log('APP_BASE_URL not set; skipping API smoke flow.')
    return
  }

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  })
  const cookie = login.res.headers.get('set-cookie')
  if (!cookie) fail('login succeeded but no auth cookie was returned')

  const headers = { Cookie: cookie }

  const seeded = await fetchJson(`${baseUrl}/api/demo/seed`, {
    method: 'POST',
    headers,
  })

  let customerId = seeded.json?.customerId
  let sessionId = seeded.json?.currentSessionId

  if (!customerId) {
    const createdCustomer = await fetchJson(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Smoke Customer ${Date.now()}`,
        phone: '0900 000 000',
        notes: 'Created by smoke-supabase.mjs',
      }),
    })
    customerId = createdCustomer.json.id

    const createdSession = await fetchJson(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        check_date: new Date().toISOString(),
        staff_name: 'Smoke Tester',
        notes: 'Created by smoke-supabase.mjs',
      }),
    })
    sessionId = createdSession.json.id
  }

  if (!customerId || !sessionId) fail('could not resolve customerId/sessionId for API smoke test')

  const form = new FormData()
  form.set('customer_id', customerId)
  form.set('session_id', sessionId)
  form.set('capture_point_code', 'front')
  form.set('shot_index', '1')
  form.set('image_type', 'micro')
  form.set('magnification', '200x')
  form.set('lighting_mode', 'bright')
  form.set('hair_state', 'dry')
  form.set('density_score', '6')
  form.set('oil_score', '4')
  form.set('redness_score', '2')
  form.set('blockage_score', '3')
  form.set('dandruff_score', '1')
  form.set('sensitivity_score', '2')
  form.set('file', new File([buildTinyPngBuffer()], 'shot.png', { type: 'image/png' }))

  await fetchJson(`${baseUrl}/api/scalp-images`, {
    method: 'POST',
    headers,
    body: form,
  })

  const state = await fetchJson(`${baseUrl}/api/sessions/${sessionId}/state`, {
    headers,
  })
  if (!state.json?.images?.length) fail('session state did not return uploaded images')

  const image = state.json.images.find((item) => item.capture_point_code === 'front' && item.shot_index === 1)
  if (!image) fail('uploaded front/1 shot was not found in session state')

  const expectedPath = `${customerId}/${sessionId}/front/1.jpg`
  if (!String(image.image_url).includes(expectedPath)) {
    fail(`image_url does not contain expected storage path ${expectedPath}`)
  }

  const { count, error: duplicateError } = await client
    .from('scalp_images')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
  if (duplicateError) fail(`could not count scalp_images rows: ${duplicateError.message}`)
  if (!count || count < 1) fail('expected at least one scalp_images row after upload')

  await fetchJson(
    `${baseUrl}/api/scalp-images?sessionId=${encodeURIComponent(sessionId)}&capturePointCode=front&shotIndex=1`,
    {
      method: 'DELETE',
      headers,
    },
  )

  const afterDelete = await fetchJson(`${baseUrl}/api/sessions/${sessionId}/state`, {
    headers,
  })
  const stillThere = afterDelete.json?.images?.some(
    (item) => item.capture_point_code === 'front' && item.shot_index === 1,
  )
  if (stillThere) fail('deleted shot still appears in session state')

  console.log('API smoke flow passed.')
}

await main()
