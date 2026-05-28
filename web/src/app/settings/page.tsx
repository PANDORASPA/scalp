import { AppShell } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { getSystemStatus } from '@/lib/settings/status'

import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const integrations = await getSystemStatus()

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">系統設定</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">API 與儲存狀態</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            這頁用來確認工具是否已具備正式使用條件，亦可以直接保存 Google Drive 與 AI 設定。
            Supabase 仍建議放在 Vercel server env，因為它是整個系統資料庫連線的基礎。
          </p>
        </Card>

        <SettingsClient initialIntegrations={integrations} />

        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">建議設定順序</div>
          <div className="mt-3 grid gap-3 text-sm text-slate-700">
            <div>
              <span className="font-medium">1. Supabase：</span>
              先在 Vercel 填入 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，客戶、session、統計與報告才會正式儲存。
            </div>
            <div>
              <span className="font-medium">2. Google Drive：</span>
              在 Google Cloud 建立 service account、啟用 Google Drive API、建立 JSON key，然後把 Drive folder 分享給 service account email。
              之後可直接在本頁保存 Drive 設定。
            </div>
            <div>
              <span className="font-medium">3. AI：</span>
              未有 OpenAI key 時保持 mock；之後可在本頁貼上 `OPENAI_API_KEY` 並切換到 OpenAI Vision。
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
