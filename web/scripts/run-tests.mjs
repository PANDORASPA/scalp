import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

rmSync('.test-dist', { recursive: true, force: true })

const tsc = spawnSync(
  process.execPath,
  ['./node_modules/typescript/bin/tsc', '-p', 'tsconfig.test.json'],
  { stdio: 'inherit' },
)

if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1)
}

writeFileSync('.test-dist/package.json', JSON.stringify({ type: 'commonjs' }))
mkdirSync('.test-dist/node_modules/@', { recursive: true })
symlinkSync(
  path.resolve('.test-dist/lib'),
  path.resolve('.test-dist/node_modules/@/lib'),
  'junction',
)
mkdirSync('.test-dist/node_modules/server-only', { recursive: true })
writeFileSync('.test-dist/node_modules/server-only/index.js', '')

const tests = spawnSync(
  process.execPath,
  [
    '--test',
    '.test-dist/lib/api/json.test.js',
    '.test-dist/lib/api/response.test.js',
    '.test-dist/lib/auth/login-rate-limit.test.js',
    '.test-dist/lib/auth/public-paths.test.js',
    '.test-dist/lib/auth/middleware-placement.test.js',
    '.test-dist/lib/auth/redirect.test.js',
    '.test-dist/lib/auth/session.test.js',
    '.test-dist/lib/config/scalp-analysis-ai.test.js',
    '.test-dist/lib/config/google-drive.test.js',
    '.test-dist/lib/config/supabase.test.js',
    '.test-dist/lib/customers/workspace.test.js',
    '.test-dist/lib/scalp/ai.test.js',
    '.test-dist/lib/scalp/pipeline.test.js',
    '.test-dist/lib/scalp-analysis/logic.test.js',
    '.test-dist/lib/scalp-analysis/navigation.test.js',
    '.test-dist/lib/scalp-analysis/history.test.js',
    '.test-dist/lib/scalp-analysis/report.test.js',
    '.test-dist/app/scalp-analysis/ui/annotation-editor-logic.test.js',
    '.test-dist/lib/scalp-analysis/mock-repository.test.js',
    '.test-dist/lib/scalp-analysis/service.test.js',
    '.test-dist/lib/scalp-analysis/storage-cleanup-plan.test.js',
    '.test-dist/lib/scalp-analysis/storage-consistency.test.js',
    '.test-dist/lib/settings/health.test.js',
    '.test-dist/lib/settings/secret-merge.test.js',
    '.test-dist/lib/supabase/storage-path.test.js',
    '.test-dist/lib/ui/errors.test.js',
    '.test-dist/lib/mockdb/store.test.js',
  ],
  { stdio: 'inherit' },
)

process.exit(tests.status ?? 1)
