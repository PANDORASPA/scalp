import { readFileSync } from 'node:fs'

function readArg(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  const envName = name.replaceAll('-', '_').toUpperCase()
  return arg ? arg.slice(prefix.length).trim() : process.env[envName]?.trim()
}

function extractFolderId(value) {
  if (!value) return ''
  const trimmed = value.trim()
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch?.[1]) return folderMatch[1]
  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParamMatch?.[1]) return idParamMatch[1]
  return trimmed
}

function fail(message) {
  console.error(`Google Drive setup failed: ${message}`)
  process.exit(1)
}

const keyFile = readArg('key-file')
const folder = readArg('folder') ?? readArg('folder-id')

if (!keyFile) {
  fail('missing --key-file=/path/to/service-account.json')
}

if (!folder) {
  fail('missing --folder=https://drive.google.com/drive/folders/... or --folder-id=...')
}

let parsed = null
try {
  parsed = JSON.parse(readFileSync(keyFile, 'utf8').replace(/^\uFEFF/, ''))
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  fail(`could not read service account JSON: ${message}`)
}

const clientEmail = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : ''
const privateKey = typeof parsed.private_key === 'string' ? parsed.private_key.trim() : ''
const folderId = extractFolderId(folder)

if (!clientEmail.endsWith('.gserviceaccount.com')) {
  fail('service account JSON is missing a valid client_email')
}

if (!privateKey.includes('BEGIN PRIVATE KEY') || !privateKey.includes('END PRIVATE KEY')) {
  fail('service account JSON is missing a valid private_key')
}

if (!folderId) {
  fail('folder id could not be extracted')
}

const escapedPrivateKey = privateKey.replace(/\r?\n/g, '\\n')

console.log('Generated Google Drive env values.')
console.log('Store these as Production env vars in Vercel or paste them into /settings.')
console.log('Do not commit these values.')
console.log('')
console.log(`SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive`)
console.log(`GOOGLE_DRIVE_CLIENT_EMAIL=${clientEmail}`)
console.log(`GOOGLE_DRIVE_PRIVATE_KEY=${escapedPrivateKey}`)
console.log(`GOOGLE_DRIVE_FOLDER_ID=${folderId}`)
console.log('')
console.log('Important:')
console.log(`- Share the Drive folder with ${clientEmail} as Editor before testing.`)
console.log('- After saving env vars, redeploy Vercel and press "Test connection" in /settings.')
console.log('')
console.log('After deployment, run:')
console.log("  $env:APP_BASE_URL='https://scalp-lake.vercel.app'; npm.cmd run smoke:health")
