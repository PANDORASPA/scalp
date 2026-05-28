import { AppShell } from '@/components/app-shell'
import { Card } from '@/components/ui/card'
import { getSystemStatus } from '@/lib/settings/status'

export default function SettingsPage() {
  const integrations = getSystemStatus()

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Card className="p-6">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">系統設定</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">API 與儲存狀態</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            這頁用來確認工具是否已具備正式使用條件。基礎客戶與 session 需要 Supabase；
            頭皮放大圖上傳需要 Google Drive；OpenAI key 可之後才填，現階段可先用 mock AI 測試流程。
          </p>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {integrations.map((item) => (
            <Card key={item.key} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    item.ready ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {item.ready ? '已設定' : '未完成'}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-600">{item.requiredFor}</div>
              <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">{item.details}</div>
            </Card>
          ))}
        </div>

        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">Vercel Environment Variables</div>
          <p className="mt-2 text-sm text-slate-600">
            為了安全，真正 secret 不會存在前端頁面。請在 Vercel Project Settings → Environment Variables
            填入以下項目，然後 redeploy。這個工具本身會自動檢查設定是否完成。
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
{`SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SCALP_ANALYSIS_STORAGE_PROVIDER=google-drive
GOOGLE_DRIVE_CLIENT_EMAIL=
GOOGLE_DRIVE_PRIVATE_KEY=
GOOGLE_DRIVE_FOLDER_ID=

SCALP_ANALYSIS_AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_VISION_MODEL=gpt-5.5`}
          </pre>
        </Card>

        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">建議設定順序</div>
          <div className="mt-3 grid gap-3 text-sm text-slate-700">
            <div>
              <span className="font-medium">1. Supabase：</span>
              填入 `SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY`，客戶、session、統計與報告才會正式儲存。
            </div>
            <div>
              <span className="font-medium">2. Google Drive：</span>
              在 Google Cloud 建立 service account、啟用 Google Drive API、建立 JSON key，然後把 Drive folder 分享給 service account email。
            </div>
            <div>
              <span className="font-medium">3. AI：</span>
              目前可保持 `SCALP_ANALYSIS_AI_PROVIDER=mock`。之後填 `OPENAI_API_KEY` 再切換 provider。
            </div>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
