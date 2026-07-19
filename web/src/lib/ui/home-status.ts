import { explainSupabaseErrorMessage } from '@/lib/config/supabase'

export type WorkspaceLoadError = {
  kind: 'supabase' | 'unknown'
  message: string
  detail: string
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function getWorkspaceLoadError(error: unknown): WorkspaceLoadError {
  const raw = getErrorMessage(error)
  const normalized = raw.toLowerCase()
  const isSupabaseError =
    normalized.includes('supabase') ||
    normalized.includes('getaddrinfo') ||
    normalized.includes('fetch failed') ||
    normalized.includes('timed out') ||
    normalized.includes('timeout')

  if (isSupabaseError) {
    return {
      kind: 'supabase',
      message: '工作台暫時未能載入，Supabase 資料庫連線未完成。',
      detail: explainSupabaseErrorMessage(raw),
    }
  }

  return {
    kind: 'unknown',
    message: '工作台資料暫時未能載入。',
    detail: '請先重試；如果問題持續，請到設定頁檢查系統狀態或保留這段錯誤給管理員。',
  }
}
