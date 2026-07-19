export const DEFAULT_WORKSPACE_LOAD_TIMEOUT_MS = 8000

export function withWorkspaceLoadTimeout<T>(
  load: () => Promise<T>,
  timeoutMs = DEFAULT_WORKSPACE_LOAD_TIMEOUT_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Supabase workspace load timed out after ${timeoutMs}ms.`))
    }, timeoutMs)
  })

  return Promise.race([load(), timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}
