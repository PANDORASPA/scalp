import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const ignoredDirs = new Set(['.git', '.next', '.test-dist', 'node_modules'])
const allowedExtensions = new Set([
  '.css',
  '.env',
  '.example',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.ts',
  '.tsx',
])

const suspiciousTokens = [
  '\u951b',
  '\u9286',
  '\u9435',
  '\ufffd',
  '\ue05b',
  '\u7410',
  '\u7489',
  '\u9352',
  '\u7dca',
  '\u7ec9',
  '\u95cb',
  '\u6fbe',
  '\u6fb6',
  '\u6d93',
  '\u5a13',
  '\u5b2a',
  '\u5085',
  '\u509a',
  '\u5a09',
  '\u6d60',
  '\u95ab',
  '\u75af',
  '\u93c2',
  '\u93ac',
  '\u9427',
  '\u7f01',
  '\u7efe',
  '\u7eab',
  '\u704f',
  '\u7467',
  '\u74a9',
  '\u7aae',
  '\u940b',
  '\u95d6',
  '\u8bf2',
  '\u5ba0',
]

function hasSuspiciousMojibake(line) {
  return suspiciousTokens.some((token) => line.includes(token))
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue
      files.push(...(await listFiles(path.join(dir, entry.name))))
      continue
    }
    if (!entry.isFile()) continue
    const filePath = path.join(dir, entry.name)
    const ext = path.extname(entry.name)
    if (allowedExtensions.has(ext) || entry.name === '.env.example') files.push(filePath)
  }
  return files
}

const matches = []
for (const file of await listFiles(root)) {
  if (path.relative(root, file) === path.join('scripts', 'check-mojibake.mjs')) continue
  const text = readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (hasSuspiciousMojibake(line)) {
      matches.push({
        file: path.relative(root, file),
        line: index + 1,
        text: line.trim().slice(0, 180),
      })
    }
  })
}

if (matches.length > 0) {
  console.error(`MOJIBAKE CHECK FAIL: found ${matches.length} suspicious line(s).`)
  for (const match of matches) {
    console.error(`${match.file}:${match.line}: ${match.text}`)
  }
  process.exit(1)
}

console.log('Mojibake check passed.')
