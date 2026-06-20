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

const suspiciousPattern =
  /锛|銆|鐨|杓|鍦|绮|骞|闋|妾|瀵|绱|瑷|纰|鍒|涓||�|璩|瑭|鍎|搴|窔|澶|鐩|浣|嬪|熷|帴|枡|偝|墠|寰|伕|悍|灏|傚|湒|犵|叆|彌/

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
    if (suspiciousPattern.test(line)) {
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
