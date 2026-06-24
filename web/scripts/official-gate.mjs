import { spawn } from 'node:child_process'

const env = {
  ...process.env,
  APP_BASE_URL: process.env.APP_BASE_URL?.trim() || 'https://scalp-lake.vercel.app',
  REQUIRE_OFFICIAL_INTEGRATIONS: 'true',
  SMOKE_CLEANUP: process.env.SMOKE_CLEANUP?.trim() || 'true',
}

const command = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(command, ['run', 'release:gate'], {
  cwd: process.cwd(),
  env,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(`OFFICIAL GATE FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
