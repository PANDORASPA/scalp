import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const testDist = path.resolve('.test-dist', String(process.pid))
rmSync(testDist, { recursive: true, force: true })
process.on('exit', () => rmSync(testDist, { recursive: true, force: true }))

const tsc = spawnSync(
  process.execPath,
  ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json', '--outDir', testDist],
  { stdio: 'inherit' },
)

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1)
}

writeFileSync(path.join(testDist, 'package.json'), JSON.stringify({ type: 'commonjs' }))
mkdirSync(path.join(testDist, 'node_modules/@'), { recursive: true })
symlinkSync(
  path.join(testDist, 'lib'),
  path.join(testDist, 'node_modules/@/lib'),
  'junction',
)
mkdirSync(path.join(testDist, 'node_modules/server-only'), { recursive: true })
writeFileSync(path.join(testDist, 'node_modules/server-only/index.js'), '')

const testPath = (relativePath) => path.join(testDist, relativePath)

const tests = spawnSync(
  process.execPath,
  [
    '--test',
    testPath('lib/api/json.test.js'),
    testPath('lib/api/response.test.js'),
    testPath('lib/auth/login-rate-limit.test.js'),
    testPath('lib/auth/public-paths.test.js'),
    testPath('lib/auth/middleware-placement.test.js'),
    testPath('lib/auth/redirect.test.js'),
    testPath('lib/auth/session.test.js'),
    testPath('lib/config/scalp-analysis-ai.test.js'),
    testPath('lib/config/google-drive.test.js'),
    testPath('lib/scalp-analysis/storage/google-drive-http.test.js'),
    testPath('lib/scalp-analysis/storage/google-drive.test.js'),
    testPath('lib/config/supabase.test.js'),
    testPath('lib/customers/workspace.test.js'),
    testPath('lib/customers/search.test.js'),
    testPath('lib/scalp/ai.test.js'),
    testPath('lib/scalp/pipeline.test.js'),
    testPath('lib/scalp/ownership.test.js'),
    testPath('lib/scalp-analysis/logic.test.js'),
    testPath('lib/scalp-analysis/navigation.test.js'),
    testPath('lib/scalp-analysis/history.test.js'),
    testPath('lib/scalp-analysis/tracking-comparison.test.js'),
    testPath('lib/scalp-analysis/report.test.js'),
    testPath('app/scalp-analysis/ui/annotation-editor-logic.test.js'),
    testPath('lib/scalp-analysis/mock-repository.test.js'),
    testPath('lib/scalp-analysis/service.test.js'),
    testPath('lib/scalp-analysis/storage-cleanup-plan.test.js'),
    testPath('lib/scalp-analysis/storage-consistency.test.js'),
    testPath('lib/settings/health.test.js'),
    testPath('lib/settings/integration-mode.test.js'),
    testPath('lib/settings/secret-merge.test.js'),
    testPath('lib/supabase/storage-path.test.js'),
    testPath('lib/ui/errors.test.js'),
    testPath('lib/ui/fetch.test.js'),
    testPath('lib/ui/home-status.test.js'),
    testPath('lib/ui/workspace-load.test.js'),
    testPath('lib/mockdb/store.test.js'),
  ],
  { stdio: 'inherit' },
)

process.exit(tests.status ?? 1)
