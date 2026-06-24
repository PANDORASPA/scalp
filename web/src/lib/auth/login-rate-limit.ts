type LoginAttemptState = {
  count: number
  firstAttemptAt: number
  lockedUntil: number
}

const WINDOW_MS = 10 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 8

const attempts = new Map<string, LoginAttemptState>()

export type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number }

export function buildLoginRateLimitKey(params: { ip: string; username: string }) {
  return `${params.ip.trim() || 'unknown'}:${params.username.trim().toLowerCase()}`
}

export function checkLoginRateLimit(key: string, now = Date.now()): LoginRateLimitResult {
  const state = attempts.get(key)
  if (!state) return { allowed: true }
  if (state.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000),
    }
  }
  if (now - state.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key)
  }
  return { allowed: true }
}

export function recordLoginFailure(key: string, now = Date.now()) {
  const current = attempts.get(key)
  const state =
    current && now - current.firstAttemptAt <= WINDOW_MS
      ? current
      : {
          count: 0,
          firstAttemptAt: now,
          lockedUntil: 0,
        }

  state.count += 1
  if (state.count >= MAX_FAILURES) state.lockedUntil = now + LOCK_MS
  attempts.set(key, state)

  return checkLoginRateLimit(key, now)
}

export function clearLoginFailures(key: string) {
  attempts.delete(key)
}

export function resetLoginRateLimitForTests() {
  attempts.clear()
}
