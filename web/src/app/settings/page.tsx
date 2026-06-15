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
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">API 與正式上線狀態</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            這頁用來確認系統是否已具備正式使用條件，亦可以直接保存 Google Drive 與 AI 設定。
            Supabase 建議繼續放在 Vercel server env，因為它是客戶、session、分析結果與報告的核心資料庫連線。
          </p>
        </Card>

        <SettingsClient initialIntegrations={integrations} />

        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">建議設定順序</div>
          <div className="mt-3 grid gap-3 text-sm text-slate-700">
            <div>
              <span className="font-medium">1. Supabase：</span>
              先在 Vercel 填入 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，並確認 migrations 已跑完。
            </div>
            <div>
              <span className="font-medium">2. Google Drive：</span>
              建立 service account、啟用 Google Drive API、下載 JSON key，然後把 Drive folder 分享給 service account email。
            </div>
            <div>
              <span className="font-medium">3. AI：</span>
              未有 OpenAI key 時可保留 Mock AI；正式分析前，請填入 OpenAI API key 並測試 model 連線。
            </div>
            <div>
              <span className="font-medium">4. Release gate：</span>
              正式上線前在本機執行 `APP_BASE_URL=https://scalp-lake.vercel.app REQUIRE_OFFICIAL_INTEGRATIONS=true npm run release:gate`。
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
