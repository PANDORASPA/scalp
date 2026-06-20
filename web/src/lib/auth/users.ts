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
    return {
      ready: true,
      officialReady: true,
      mode: 'official' as const,
      details: '已設定正式員工登入帳號。',
      nextAction: undefined,
    }
  }

  if (configuredUsers && configuredUsers.length === 0) {
    return {
      ready: false,
      officialReady: false,
      mode: 'missing' as const,
      details: 'AUTH_USERS_JSON 已設定，但沒有有效員工帳號。',
      nextAction: '請在 Vercel env 以 JSON array 設定至少一個 admin/staff 帳號。',
    }
  }

  return {
    ready: true,
    officialReady: false,
    mode: 'demo' as const,
    details: '目前使用內建 Demo 登入帳號，可測試流程，但不適合正式公開使用。',
    nextAction: '正式使用前請在 Vercel env 設定 AUTH_USERS_JSON，並使用非預設密碼。',
  }
}
