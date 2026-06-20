const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000'
const username = process.env.SMOKE_USERNAME?.trim() || 'admin'
const password = process.env.SMOKE_PASSWORD?.trim() || 'admin123'
const confirmDelete = process.env.CONFIRM_DELETE_SMOKE_DATA === 'true'

function fail(message) {
  console.error(`SMOKE CLEANUP FAIL: ${message}`)
  process.exit(1)
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

function isSmokeCustomer(customer) {
  return (
    typeof customer?.id === 'string' &&
    typeof customer?.name === 'string' &&
    customer.name.startsWith('Scalp Smoke ') &&
    customer.notes === 'Created by smoke-scalp-analysis.mjs'
  )
}

async function main() {
  console.log(`Checking smoke customers against ${baseUrl}`)

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookie = login.res.headers.get('set-cookie')
  if (!cookie) fail('login succeeded but no auth cookie was returned')
  const headers = { Cookie: cookie }

  const customers = await fetchJson(`${baseUrl}/api/customers?q=${encodeURIComponent('Scalp Smoke')}`, { headers })
  const smokeCustomers = Array.isArray(customers.json) ? customers.json.filter(isSmokeCustomer) : []

  if (smokeCustomers.length === 0) {
    console.log('No smoke customers found.')
    return
  }

  console.log(`Found ${smokeCustomers.length} smoke customer(s):`)
  for (const customer of smokeCustomers) {
    console.log(`- ${customer.id} | ${customer.name} | updated ${customer.updated_at}`)
  }

  if (!confirmDelete) {
    console.log('Dry run only. Set CONFIRM_DELETE_SMOKE_DATA=true to delete these smoke customers.')
    return
  }

  for (const customer of smokeCustomers) {
    await fetchJson(`${baseUrl}/api/customers/${customer.id}`, {
      method: 'DELETE',
      headers,
    })
    console.log(`Deleted smoke customer ${customer.id}.`)
  }
}

await main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
