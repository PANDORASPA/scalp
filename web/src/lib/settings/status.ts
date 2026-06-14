import { hasGoogleDriveEnv } from '@/lib/config/google-drive'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { getScalpStorageProviderName } from '@/lib/scalp-analysis/storage'
import { getAppSettings, hasCompleteGoogleDriveSettings, hasOpenAiApiKey } from '@/lib/settings/repository'

export type IntegrationStatus = {
  key: string
  label: string
  ready: boolean
  requiredFor: string
  details: string
}

export async function getSystemStatus(): Promise<IntegrationStatus[]> {
  const settings = await getAppSettings()
  const aiProvider = settings.openAi.provider ?? process.env.SCALP_ANALYSIS_AI_PROVIDER?.trim().toLowerCase() ?? 'mock'
  const storageProvider = getScalpStorageProviderName()
  const demoStorageReady = storageProvider === 'demo'
  const googleDriveReady = demoStorageReady || hasCompleteGoogleDriveSettings(settings.googleDrive) || hasGoogleDriveEnv()
  const openAiReady = aiProvider === 'mock' || hasOpenAiApiKey(settings.openAi) || Boolean(process.env.OPENAI_API_KEY?.trim())

  return [
    {
      key: 'supabase',
      label: 'Supabase 資料庫',
      ready: hasSupabaseServerEnv(),
      requiredFor: '客戶、session、分析結果與報告儲存',
      details: hasSupabaseServerEnv()
        ? '已連接正式資料庫。'
        : '尚未設定 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY。',
    },
    {
      key: 'google-drive',
      label: 'Google Drive 圖片儲存',
      ready: googleDriveReady,
      requiredFor: '頭皮放大圖上傳與圖片長期保存',
      details: demoStorageReady
        ? '目前使用 demo storage，可測試完整流程；正式客人圖片仍需設定 Google Drive。'
        : googleDriveReady
          ? '已設定 Google Drive service account。'
          : '尚未設定 GOOGLE_DRIVE_CLIENT_EMAIL / GOOGLE_DRIVE_PRIVATE_KEY / GOOGLE_DRIVE_FOLDER_ID。',
    },
    {
      key: 'scalp-ai',
      label: 'AI 分析 Provider',
      ready: openAiReady,
      requiredFor: '上傳後自動產生初步標記',
      details:
        aiProvider === 'mock'
          ? '目前使用 mock AI，可先完成流程測試；之後可切換 OpenAI Vision。'
          : openAiReady
            ? `已設定 ${aiProvider}。`
            : '已選 OpenAI Vision，但尚未設定 OPENAI_API_KEY。',
    },
  ]
}
