import { hasGoogleDriveEnv } from '@/lib/config/google-drive'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { getAuthReadinessStatus } from '@/lib/auth/users'
import { getScalpStorageProviderName } from '@/lib/scalp-analysis/storage'
import { getSupabaseAdminClient } from '@/lib/supabase/client'
import { getAppSettings, hasCompleteGoogleDriveSettings, hasOpenAiApiKey } from '@/lib/settings/repository'

export type IntegrationStatus = {
  key: string
  label: string
  ready: boolean
  officialReady: boolean
  mode: 'official' | 'demo' | 'mock' | 'missing'
  requiredFor: string
  details: string
  nextAction?: string
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'unknown connection error'
  const cause = error.cause
  if (cause instanceof Error && cause.message) return `${error.message}: ${cause.message}`
  if (cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
    return `${error.message}: ${cause.message}`
  }
  return error.message
}

async function getSupabaseConnectionStatus() {
  if (!hasSupabaseServerEnv()) {
    return {
      ready: false,
      details: '尚未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。',
    }
  }

  try {
    const client = getSupabaseAdminClient()
    const { error } = await client.from('scalp_capture_points').select('id', { head: true, count: 'exact' }).limit(1)
    if (error) {
      return {
        ready: false,
        details: `已設定 Supabase env，但資料庫連線失敗：${error.message}`,
      }
    }
    return {
      ready: true,
      details: '已連接正式 Supabase 資料庫。',
    }
  } catch (error) {
    const message = getErrorMessage(error)
    console.error('Supabase connection status check failed', error)
    return {
      ready: false,
      details: `已設定 Supabase env，但資料庫連線失敗：${message}`,
    }
  }
}

export async function getSystemStatus(): Promise<IntegrationStatus[]> {
  const settings = await getAppSettings()
  const supabase = await getSupabaseConnectionStatus()
  const auth = getAuthReadinessStatus()
  const aiProvider = settings.openAi.provider ?? process.env.SCALP_ANALYSIS_AI_PROVIDER?.trim().toLowerCase() ?? 'mock'
  const storageProvider = await getScalpStorageProviderName()
  const demoStorageReady = storageProvider === 'demo'
  const officialGoogleDriveReady = hasCompleteGoogleDriveSettings(settings.googleDrive) || hasGoogleDriveEnv()
  const googleDriveReady = demoStorageReady || officialGoogleDriveReady
  const officialOpenAiReady = hasOpenAiApiKey(settings.openAi) || Boolean(process.env.OPENAI_API_KEY?.trim())
  const openAiReady = aiProvider === 'mock' || officialOpenAiReady

  return [
    {
      key: 'supabase',
      label: 'Supabase 資料庫',
      ready: supabase.ready,
      officialReady: supabase.ready,
      mode: supabase.ready ? 'official' : 'missing',
      requiredFor: '客戶、session、分析結果與報告長期儲存',
      details: supabase.details,
      nextAction: supabase.ready
        ? undefined
        : '在 Vercel server env 設定 Supabase URL 和 service role key，並確認 migrations 已跑完。',
    },
    {
      key: 'auth',
      label: '登入帳號',
      ready: auth.ready,
      officialReady: auth.officialReady,
      mode: auth.mode,
      requiredFor: '員工登入、權限控制與正式公開使用',
      details: auth.details,
      nextAction: auth.nextAction,
    },
    {
      key: 'google-drive',
      label: 'Google Drive 圖片儲存',
      ready: googleDriveReady,
      officialReady: !demoStorageReady && officialGoogleDriveReady,
      mode: demoStorageReady ? 'demo' : officialGoogleDriveReady ? 'official' : 'missing',
      requiredFor: '頭皮放大圖上傳與圖片長期保存',
      details: demoStorageReady
        ? '目前使用 Demo storage，可測試完整流程；正式客人圖片仍需設定 Google Drive。'
        : officialGoogleDriveReady
          ? '已設定 Google Drive service account，可作正式圖片儲存。'
          : '尚未設定 GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID。',
      nextAction: demoStorageReady
        ? '正式使用前請切換到 Google Drive，填入 service account email、private key 和 folder id，再按測試連線。'
        : officialGoogleDriveReady
          ? undefined
          : '建立 Google Cloud service account，啟用 Drive API，並把目標 Drive folder 分享給 service account email。',
    },
    {
      key: 'scalp-ai',
      label: 'AI 分析 Provider',
      ready: openAiReady,
      officialReady: aiProvider !== 'mock' && officialOpenAiReady,
      mode: aiProvider === 'mock' ? 'mock' : officialOpenAiReady ? 'official' : 'missing',
      requiredFor: '上傳後自動產生初步標記與統計建議',
      details:
        aiProvider === 'mock'
          ? '目前使用 Mock AI，可先完成流程測試；正式計數需要切換 OpenAI Vision。'
          : officialOpenAiReady
            ? `已設定 ${aiProvider}。`
            : '已選 OpenAI Vision，但尚未設定 OPENAI_API_KEY。',
      nextAction:
        aiProvider === 'mock'
          ? '取得 OpenAI API key 後，切換到 OpenAI Vision，填入 key 和 model，再按測試連線。'
          : officialOpenAiReady
            ? undefined
            : '填入 OpenAI API key，並確認 model 名稱可用。',
    },
  ]
}
