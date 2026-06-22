import { rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

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

const tests = spawnSync(
  process.execPath,
  [
    '--test',
    '.test-dist/lib/auth/public-paths.test.js',
    '.test-dist/lib/auth/session.test.js',
    '.test-dist/lib/config/scalp-analysis-ai.test.js',
    '.test-dist/lib/customers/workspace.test.js',
    '.test-dist/lib/scalp/ai.test.js',
    '.test-dist/lib/scalp/pipeline.test.js',
    '.test-dist/lib/scalp-analysis/logic.test.js',
    '.test-dist/lib/settings/health.test.js',
  ],
  { stdio: 'inherit' },
)

process.exit(tests.status ?? 1)
