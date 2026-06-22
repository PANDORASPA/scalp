export type StaffUser = {
  username: string
  password: string
  name: string
  role: 'admin' | 'staff'
}

const DEMO_STAFF_USERS: StaffUser[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Salon Admin',
    role: 'admin',
  },
  {
    username: 'staff',
    password: 'staff123',
    name: 'Front Desk',
    role: 'staff',
  },
]

const DEMO_PASSWORDS = new Set(['admin123', 'staff123', 'password', 'password123'])

function getSessionSecretSafetyIssue() {
  const secret = process.env.AUTH_SESSION_SECRET?.trim()
  if (!secret) return 'AUTH_SESSION_SECRET is not set.'
  if (secret.length < 32) return 'AUTH_SESSION_SECRET must be at least 32 characters.'
  if (secret.toLowerCase().includes('change-this') || secret.toLowerCase().includes('secret')) {
    return 'AUTH_SESSION_SECRET still looks like a placeholder.'
  }
  return null
}

function parseAuthUsersJson(value: string | undefined): StaffUser[] | null {
  if (!value?.trim()) return null

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const row = item as Partial<StaffUser>
        const username = row.username?.trim()
        const password = row.password?.trim()
        const name = row.name?.trim()
        const role = row.role
        if (!username || !password || !name) return null
        if (role !== 'admin' && role !== 'staff') return null
        return { username, password, name, role } satisfies StaffUser
      })
      .filter((item): item is StaffUser => Boolean(item))
  } catch {
    return []
  }
}

function getCredentialSafetyIssue(users: StaffUser[]) {
  for (const user of users) {
    const password = user.password.trim()
    const loweredPassword = password.toLowerCase()
    const loweredUsername = user.username.trim().toLowerCase()

    if (password.length < 12) {
      return `Password for "${user.username}" must be at least 12 characters.`
    }
    if (DEMO_PASSWORDS.has(loweredPassword)) {
      return `Password for "${user.username}" is a demo/default password.`
    }
    if (loweredPassword.includes('change-this') || loweredPassword.includes('password')) {
      return `Password for "${user.username}" still looks like a placeholder.`
    }
    if (loweredPassword === loweredUsername) {
      return `Password for "${user.username}" cannot match the username.`
    }
  }

  return null
}

export function getConfiguredStaffUsers() {
  return parseAuthUsersJson(process.env.AUTH_USERS_JSON)
}

export function getStaffUsers() {
  const configuredUsers = getConfiguredStaffUsers()
  if (configuredUsers) return configuredUsers
  return DEMO_STAFF_USERS
}

export function getAuthReadinessStatus() {
  const configuredUsers = getConfiguredStaffUsers()

  if (configuredUsers && configuredUsers.length > 0) {
    const safetyIssue = getCredentialSafetyIssue(configuredUsers)
    if (safetyIssue) {
      return {
        ready: true,
        officialReady: false,
        mode: 'demo' as const,
        details: `AUTH_USERS_JSON is configured, but it is not safe for official use. ${safetyIssue}`,
        nextAction:
          'Generate a stronger AUTH_USERS_JSON with npm run setup:auth-users, save it in Vercel Production env, then redeploy.',
      }
    }

    const sessionSecretIssue = getSessionSecretSafetyIssue()
    if (sessionSecretIssue) {
      return {
        ready: true,
        officialReady: false,
        mode: 'demo' as const,
        details: `Official staff accounts are configured, but session signing is not safe for official use. ${sessionSecretIssue}`,
        nextAction:
          'Set a strong AUTH_SESSION_SECRET in Vercel Production env, then redeploy.',
      }
    }

    return {
      ready: true,
      officialReady: true,
      mode: 'official' as const,
      details: 'Official staff login accounts are configured.',
      nextAction: undefined,
    }
  }

  if (configuredUsers && configuredUsers.length === 0) {
    return {
      ready: false,
      officialReady: false,
      mode: 'missing' as const,
      details: 'AUTH_USERS_JSON is set, but it does not contain any valid staff accounts.',
      nextAction: 'Set AUTH_USERS_JSON in Vercel env as a JSON array with at least one admin or staff account.',
    }
  }

  return {
    ready: true,
    officialReady: false,
    mode: 'demo' as const,
    details: 'Demo staff login is active. This is useful for testing but not safe for official public use.',
    nextAction: 'Before official use, set AUTH_USERS_JSON in Vercel env with non-default strong passwords.',
  }
}
