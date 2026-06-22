import crypto from 'node:crypto'

function readArg(name, fallback) {
  const prefix = `--${name}=`
  const arg = process.argv.find((item) => item.startsWith(prefix))
  const envName = name.replaceAll('-', '_').toUpperCase()
  return arg ? arg.slice(prefix.length).trim() : process.env[envName]?.trim() || fallback
}

function randomPassword() {
  return crypto.randomBytes(18).toString('base64url')
}

function randomSessionSecret() {
  return crypto.randomBytes(32).toString('base64url')
}

const ownerUsername = readArg('owner-username', 'owner')
const ownerName = readArg('owner-name', 'Owner')
const staffUsername = readArg('staff-username', 'frontdesk')
const staffName = readArg('staff-name', 'Front Desk')

const users = [
  {
    username: ownerUsername,
    password: readArg('owner-password', randomPassword()),
    name: ownerName,
    role: 'admin',
  },
  {
    username: staffUsername,
    password: readArg('staff-password', randomPassword()),
    name: staffName,
    role: 'staff',
  },
]

console.log('Generated AUTH_USERS_JSON for official staff login.')
console.log('Store this value as a Production env var in Vercel. Do not commit it.')
console.log('')
console.log(JSON.stringify(users))
console.log('')
console.log('Generated AUTH_SESSION_SECRET for signed staff session cookies.')
console.log('Store this value as a separate Production env var in Vercel. Do not commit it.')
console.log('')
console.log(`AUTH_SESSION_SECRET=${randomSessionSecret()}`)
console.log('')
console.log('Vercel CLI example:')
console.log('  echo \'<paste-json-above>\' | vercel env add AUTH_USERS_JSON production')
console.log('  echo \'<paste-secret-above>\' | vercel env add AUTH_SESSION_SECRET production')
console.log('')
console.log('After deployment, run:')
console.log("  $env:APP_BASE_URL='https://scalp-lake.vercel.app'; npm.cmd run smoke:health")
