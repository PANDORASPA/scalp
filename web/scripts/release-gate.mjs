import { spawn } from 'node:child_process'

const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || ''
const username = process.env.SMOKE_USERNAME?.trim() || 'admin'
const password = process.env.SMOKE_PASSWORD?.trim() || 'admin123'
const requireOfficialIntegrations = process.env.REQUIRE_OFFICIAL_INTEGRATIONS === 'true'

function fail(message) {
  console.error(`RELEASE GATE FAIL: ${message}`)
  process.exit(1)
}

function warn(message) {
  console.warn(`RELEASE GATE WARN: ${message}`)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}`)
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      shell: process.platform === 'win32',
      stdio: 'inherit',
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with ${code}`))
    })
  })
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

function getIntegration(integrations, key) {
  const integration = integrations.find((item) => item.key === key)
  if (!integration) fail(`settings status did not include ${key}`)
  return integration
}

async function verifyLiveSettings(headers) {
  const status = await fetchJson(`${baseUrl}/api/settings/status`, { headers })
  const integrations = status.json?.integrations
  if (!Array.isArray(integrations)) fail('settings status did not return integrations')

  const supabase = getIntegration(integrations, 'supabase')
  const googleDrive = getIntegration(integrations, 'google-drive')
  const scalpAi = getIntegration(integrations, 'scalp-ai')

  if (!supabase.ready) fail(`Supabase is not ready: ${supabase.details}`)
  if (!googleDrive.ready) fail(`Image storage is not ready: ${googleDrive.details}`)
  if (!scalpAi.ready) fail(`Scalp AI is not ready: ${scalpAi.details}`)

  const officialIssues = []
  if (!googleDrive.officialReady) {
    officialIssues.push('Image storage is still in demo mode. Real customer image storage needs Google Drive credentials.')
  }
  if (!scalpAi.officialReady) {
    officialIssues.push('Scalp AI is still in mock mode. Real AI counting needs an OpenAI key/model.')
  }

  if (officialIssues.length > 0) {
    const message = officialIssues.join(' ')
    if (requireOfficialIntegrations) fail(message)
    for (const issue of officialIssues) warn(issue)
  }
}

async function verifyIntegrationTests(headers) {
  for (const target of ['supabase', 'google-drive', 'scalp-ai']) {
    const result = await fetchJson(`${baseUrl}/api/settings/test`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    })
    if (!result.json?.ok) fail(`${target} connection test returned ok=false`)
    console.log(`${target}: ${result.json.message}`)
  }
}

async function main() {
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check:mojibake'])
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test'])
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'])

  if (!baseUrl) {
    warn('APP_BASE_URL is not set, so live API/settings/scalp-analysis smoke checks were skipped.')
    warn('Set APP_BASE_URL=https://scalp-lake.vercel.app and rerun this gate before release.')
    return
  }

  console.log(`\nRunning live release gate against ${baseUrl}`)
  const headers = await login()
  await verifyLiveSettings(headers)
  await verifyIntegrationTests(headers)
  await run('node', ['./scripts/smoke-scalp-analysis.mjs'])
  console.log('\nRelease gate passed.')
}

await main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error))
})
