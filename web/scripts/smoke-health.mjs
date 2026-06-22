const baseUrl = process.env.APP_BASE_URL?.trim() || process.env.BASE_URL?.trim() || 'http://localhost:3000'
const requireOfficialIntegrations = process.env.REQUIRE_OFFICIAL_INTEGRATIONS === 'true'
const expectedDeploymentCommit = process.env.EXPECTED_DEPLOYMENT_COMMIT?.trim() || ''

function fail(message) {
  throw new Error(message)
}

async function main() {
  console.log(`Checking production health against ${baseUrl}`)
  const res = await fetch(`${baseUrl}/api/health`)
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    fail(`health response was not JSON: ${text}`)
  }

  if (!res.ok) fail(`health endpoint failed with HTTP ${res.status}`)
  if (!json?.ok) fail(`health status is not operational: ${JSON.stringify(json)}`)

  const integrations = Array.isArray(json.integrations) ? json.integrations : []
  for (const key of ['supabase', 'auth', 'google-drive', 'scalp-ai']) {
    const item = integrations.find((candidate) => candidate.key === key)
    if (!item) fail(`health response is missing ${key}`)
    if (!item.ready) fail(`${key} is not ready: ${item.details}`)
  }

  const liveCommit = json.version?.commit
  if (expectedDeploymentCommit) {
    if (!liveCommit) fail(`expected deployment commit ${expectedDeploymentCommit}, but health response did not include a commit`)
    if (!liveCommit.startsWith(expectedDeploymentCommit) && !expectedDeploymentCommit.startsWith(liveCommit)) {
      fail(`live deployment commit mismatch: expected ${expectedDeploymentCommit}, got ${liveCommit}`)
    }
  }

  if (requireOfficialIntegrations && !json.officialReady) {
    const blockers = Array.isArray(json.blockers)
      ? json.blockers.map((item) => `${item.label}: ${item.nextAction || item.details}`).join(' ')
      : 'unknown official readiness blockers'
    fail(`official readiness failed: ${blockers}`)
  }

  console.log(`Health status: ${json.status}`)
  if (json.version?.commit) console.log(`Deployment commit: ${json.version.commit}`)
  if (json.blockers?.length) {
    console.log('Official readiness blockers:')
    for (const blocker of json.blockers) {
      console.log(`- ${blocker.label} (${blocker.mode}): ${blocker.nextAction || blocker.details}`)
    }
  }
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`HEALTH SMOKE FAIL: ${message}`)
  process.exit(1)
})
