import dns from 'node:dns/promises'

const supabaseUrl = process.env.SUPABASE_URL?.trim() || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

function fail(message) {
  console.error(`SUPABASE DIAGNOSE FAIL: ${message}`)
  process.exit(1)
}

function ok(message) {
  console.log(`OK: ${message}`)
}

function redact(value) {
  if (!value) return '<empty>'
  if (value.length <= 12) return `<redacted:${value.length}>`
  return `${value.slice(0, 6)}...${value.slice(-4)} (${value.length} chars)`
}

function parseUrl() {
  if (!supabaseUrl) fail('SUPABASE_URL is missing.')

  let parsed
  try {
    parsed = new URL(supabaseUrl)
  } catch {
    fail(`SUPABASE_URL is not a valid URL: ${supabaseUrl}`)
  }

  if (parsed.protocol !== 'https:') {
    fail(`SUPABASE_URL must start with https://, got ${parsed.protocol}`)
  }
  if (!parsed.hostname.endsWith('.supabase.co')) {
    console.warn(`WARN: SUPABASE_URL host is not a standard *.supabase.co host: ${parsed.hostname}`)
  }

  ok(`SUPABASE_URL format looks valid: ${parsed.origin}`)
  return parsed
}

function checkKeyShape() {
  if (!serviceRoleKey) fail('SUPABASE_SERVICE_ROLE_KEY is missing.')
  if (!serviceRoleKey.startsWith('eyJ') || serviceRoleKey.split('.').length !== 3 || serviceRoleKey.length < 100) {
    fail(`SUPABASE_SERVICE_ROLE_KEY does not look like a service-role JWT: ${redact(serviceRoleKey)}`)
  }
  ok(`SUPABASE_SERVICE_ROLE_KEY shape looks like a JWT: ${redact(serviceRoleKey)}`)
}

async function checkDns(hostname) {
  try {
    const addresses = await dns.lookup(hostname, { all: true })
    if (addresses.length === 0) fail(`DNS returned no addresses for ${hostname}`)
    ok(`DNS resolves ${hostname}: ${addresses.map((item) => item.address).join(', ')}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(
      `DNS cannot resolve ${hostname}: ${message}. Copy the Project URL directly from Supabase Settings > API and update Vercel SUPABASE_URL.`,
    )
  }
}

async function checkRestEndpoint(origin) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(`${origin}/rest/v1/scalp_capture_points?select=id&limit=1`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    })
    const text = await res.text()
    if (!res.ok) {
      fail(`REST check failed (${res.status}): ${text.slice(0, 500)}`)
    }
    ok('REST check reached scalp_capture_points.')
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'timeout after 10000ms'
        : error instanceof Error
          ? error.message
          : String(error)
    fail(`REST check could not reach Supabase: ${message}`)
  } finally {
    clearTimeout(timeout)
  }
}

const parsed = parseUrl()
checkKeyShape()
await checkDns(parsed.hostname)
await checkRestEndpoint(parsed.origin)

console.log('Supabase env diagnostics passed.')
