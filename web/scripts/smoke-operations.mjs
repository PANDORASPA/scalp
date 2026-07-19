const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000'
const username = process.env.SMOKE_USERNAME?.trim() || 'admin'
const password = process.env.SMOKE_PASSWORD?.trim() || 'admin123'

function fail(message) {
  throw new Error(message)
}

async function fetchJson(url, init = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  let res
  let text
  try {
    res = await fetch(url, { ...init, signal: controller.signal })
    text = await res.text()
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${init.method || 'GET'} ${url} timed out after 30000ms`)
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

async function expectJsonFailure(url, init, expectedStatus, expectedError) {
  const res = await fetch(url, init)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  if (res.status !== expectedStatus || json?.error !== expectedError) {
    fail(
      `${init.method || 'GET'} ${url} expected ${expectedStatus}/${expectedError}, got ${res.status}/${JSON.stringify(json)}`,
    )
  }
}

async function login() {
  const loginResult = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookie = loginResult.res.headers.get('set-cookie')
  if (!cookie) fail('login succeeded but no auth cookie was returned')
  return { Cookie: cookie }
}

async function main() {
  console.log(`Running operations smoke flow against ${baseUrl}`)
  const headers = await login()
  let customerId = null
  let sessionId = null

  try {
    const createdCustomer = await fetchJson(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Ops Smoke ${Date.now()}`,
        phone: '0900 111 222',
        notes: 'Created by smoke-operations.mjs',
      }),
    })
    customerId = createdCustomer.json?.id
    if (!customerId) fail('customer creation did not return an id')

    const customer = await fetchJson(`${baseUrl}/api/customers/${customerId}`, { headers })
    if (customer.json?.id !== customerId) fail('created customer could not be read back')

    const overview = await fetchJson(`${baseUrl}/api/customers/${customerId}/overview`, { headers })
    if (overview.json?.customer?.id !== customerId) fail('customer overview did not return created customer')

    const patchedCustomer = await fetchJson(`${baseUrl}/api/customers/${customerId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${createdCustomer.json.name} Updated`,
        phone: '0900 333 444',
        notes: 'Updated by smoke-operations.mjs',
      }),
    })
    if (!patchedCustomer.json?.name?.endsWith('Updated')) fail('customer update was not persisted')

    const createdSession = await fetchJson(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_id: customerId,
        check_date: new Date(Date.UTC(2026, 5, 20, 9, 0, 0)).toISOString(),
        staff_name: 'Ops Smoke',
        notes: 'Created by smoke-operations.mjs',
      }),
    })
    sessionId = createdSession.json?.id
    if (!sessionId) fail('session creation did not return an id')

    await expectJsonFailure(
      `${baseUrl}/api/sessions`,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: '00000000-0000-0000-0000-000000000000',
          check_date: new Date(Date.UTC(2026, 5, 20, 9, 0, 0)).toISOString(),
        }),
      },
      404,
      'customer_not_found',
    )

    const mismatchedImage = new FormData()
    mismatchedImage.set('customer_id', '00000000-0000-0000-0000-000000000000')
    mismatchedImage.set('session_id', sessionId)
    mismatchedImage.set('capture_point_code', 'front')
    mismatchedImage.set('shot_index', '1')
    mismatchedImage.set('file', new Blob(['smoke'], { type: 'image/jpeg' }), 'smoke.jpg')
    await expectJsonFailure(
      `${baseUrl}/api/scalp-images`,
      { method: 'POST', headers, body: mismatchedImage },
      404,
      'session_not_found',
    )

    const session = await fetchJson(`${baseUrl}/api/sessions/${sessionId}`, { headers })
    if (session.json?.id !== sessionId) fail('created session could not be read back')

    const patchedSession = await fetchJson(`${baseUrl}/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        check_date: new Date(Date.UTC(2026, 5, 21, 9, 0, 0)).toISOString(),
        staff_name: 'Ops Smoke Updated',
        notes: 'Updated by smoke-operations.mjs',
      }),
    })
    if (patchedSession.json?.staff_name !== 'Ops Smoke Updated') fail('session update was not persisted')

    const sessions = await fetchJson(`${baseUrl}/api/sessions?customerId=${encodeURIComponent(customerId)}`, { headers })
    if (!Array.isArray(sessions.json) || !sessions.json.some((item) => item.id === sessionId)) {
      fail('customer session list did not include created session')
    }

    const overviewAfterSession = await fetchJson(`${baseUrl}/api/customers/${customerId}/overview`, { headers })
    if (!overviewAfterSession.json?.sessions?.some((item) => item.id === sessionId)) {
      fail('customer overview did not include created session')
    }

    console.log(`Operations smoke flow passed for customer ${customerId} and session ${sessionId}.`)
  } finally {
    if (customerId) {
      try {
        await fetchJson(`${baseUrl}/api/customers/${customerId}`, {
          method: 'DELETE',
          headers,
        })
        console.log(`Cleaned up operations smoke customer ${customerId}.`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`OPERATIONS SMOKE CLEANUP FAIL: ${message}`)
      }
    }
  }
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`OPERATIONS SMOKE FAIL: ${message}`)
  process.exit(1)
})
