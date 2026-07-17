'use client'

import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntegrationStatus } from '@/lib/settings/status'
import { getHumanErrorMessage } from '@/lib/ui/errors'

type Props = {
  initialIntegrations: IntegrationStatus[]
}

type TestTarget = 'supabase' | 'auth' | 'google-drive' | 'scalp-ai'

type HealthResponse = {
  ok: boolean
  officialReady: boolean
  status: 'official_ready' | 'operational_with_demo_integrations' | 'not_ready'
  checkedAt: string
  version: {
    commit: string | null
    branch: string | null
    deploymentUrl: string | null
  }
  integrations: IntegrationStatus[]
  blockers: Array<{
    key: string
    label: string
    mode: IntegrationStatus['mode']
    details: string
    nextAction: string | null
  }>
}

async function saveSettings(body: unknown) {
  const res = await fetch('/api/settings/status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as { error?: string; integrations?: IntegrationStatus[] } | null
  if (!res.ok) throw new Error(getHumanErrorMessage(json?.error ?? 'settings_save_failed'))
  return json?.integrations ?? []
}

async function testIntegration(target: TestTarget) {
  const res = await fetch('/api/settings/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null
  if (!res.ok || !json?.ok) throw new Error(json?.message ?? 'connection_test_failed')
  return json.message ?? '測試成功'
}

async function fetchHealth() {
  const res = await fetch('/api/health')
  const json = (await res.json().catch(() => null)) as HealthResponse | { error?: string } | null
  if (!res.ok || !json || !('status' in json)) {
    throw new Error('讀取 production health 失敗')
  }
  return json
}

function getModeLabel(item: IntegrationStatus) {
  if (item.mode === 'official') return '正式可用'
  if (item.mode === 'demo') return 'Demo 可測'
  if (item.mode === 'mock') return 'Mock 可測'
  return '未完成'
}

function getModeClass(item: IntegrationStatus) {
  if (item.mode === 'official') return 'bg-emerald-50 text-emerald-700'
  if (item.mode === 'demo' || item.mode === 'mock') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

export function SettingsClient({ initialIntegrations }: Props) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const initialStorageMode = initialIntegrations.find((item) => item.key === 'google-drive')?.mode
  const initialPublicAccess = initialIntegrations.find((item) => item.key === 'google-drive')?.publicAccess ?? false
  const initialAiMode = initialIntegrations.find((item) => item.key === 'scalp-ai')?.mode
  const [storageProvider, setStorageProvider] = useState<'google-drive' | 'demo'>(
    initialStorageMode === 'demo' ? 'demo' : 'google-drive',
  )
  const [clientEmail, setClientEmail] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [folderId, setFolderId] = useState('')
  const [publicAccess, setPublicAccess] = useState(initialPublicAccess)
  const [provider, setProvider] = useState<'mock' | 'openai-5.5'>(
    initialAiMode === 'official' || initialAiMode === 'missing' ? 'openai-5.5' : 'mock',
  )
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-5.5')
  const [saving, setSaving] = useState<string | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const officialReadyCount = integrations.filter((item) => item.officialReady).length
  const allOfficialReady = officialReadyCount === integrations.length
  const supabaseBlocker = health?.blockers.find((item) => item.key === 'supabase')

  const handleRefreshHealth = useCallback(async () => {
    setHealthLoading(true)
    setError(null)
    try {
      const next = await fetchHealth()
      setHealth(next)
      setIntegrations(next.integrations)
      setPublicAccess(next.integrations.find((item) => item.key === 'google-drive')?.publicAccess ?? false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '讀取 production health 失敗')
    } finally {
      setHealthLoading(false)
    }
  }, [])

  useEffect(() => {
    void handleRefreshHealth()
  }, [handleRefreshHealth])

  async function handleTest(target: TestTarget) {
    setTesting(target)
    setMessage(null)
    setError(null)
    try {
      const result = await testIntegration(target)
      setMessage(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : '測試連線失敗')
    } finally {
      setTesting(null)
    }
  }

  async function handleSaveGoogleDrive() {
    setSaving('google-drive')
    setMessage(null)
    setError(null)
    try {
      const next = await saveSettings({
        googleDrive: {
          storageProvider,
          clientEmail,
          privateKey,
          folderId,
          publicAccess,
        },
      })
      setIntegrations(next)
      setPrivateKey('')
      setMessage('Google Drive 設定已保存。請按「測試連線」確認 folder 權限。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 Google Drive 設定失敗')
    } finally {
      setSaving(null)
    }
  }

  async function handleSaveOpenAi() {
    setSaving('openai')
    setMessage(null)
    setError(null)
    try {
      const next = await saveSettings({
        openAi: {
          provider,
          apiKey,
          model,
          timeoutMs: 30000,
        },
      })
      setIntegrations(next)
      setApiKey('')
      setMessage('AI 設定已保存。請按「測試連線」確認 API key 和 model。')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存 AI 設定失敗')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      {message ? <Card className="border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</Card> : null}
      {error ? <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</Card> : null}

      <Card className={`p-5 ${health?.officialReady ? 'border-emerald-200 bg-emerald-50' : health?.ok ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Production health</div>
            <p className="mt-1 text-sm text-slate-700">
              {healthLoading && !health
                ? '正在檢查 production 狀態...'
                : health?.officialReady
                  ? '系統已達正式上線條件。'
                  : health?.ok
                    ? '系統可正常操作，但仍未達正式 100% 條件。'
                    : '系統尚未通過 operational health check。'}
            </p>
            {health?.version.commit ? (
              <div className="mt-2 text-xs text-slate-600">
                部署 commit：{health.version.commit.slice(0, 7)}
                {health.version.branch ? ` | branch：${health.version.branch}` : ''}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                health?.officialReady
                  ? 'bg-emerald-100 text-emerald-800'
                  : health?.ok
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
              }`}
            >
              {health?.officialReady ? 'Official ready' : health?.ok ? 'Operational' : 'Not ready'}
            </span>
            <Button variant="secondary" onClick={() => void handleRefreshHealth()} disabled={healthLoading}>
              {healthLoading ? '檢查中...' : '重新檢查'}
            </Button>
          </div>
        </div>

        {health?.blockers.length ? (
          <div className="mt-4 grid gap-2 text-sm text-slate-700">
            {health.blockers.map((blocker) => (
              <div key={blocker.key} className="rounded-md border border-amber-200 bg-white/70 p-3">
                <div className="font-medium text-slate-900">
                  {blocker.label}（{blocker.mode}）
                </div>
                <div className="mt-1 text-slate-600">{blocker.nextAction ?? blocker.details}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      {supabaseBlocker ? (
        <Card className="border-red-200 bg-white p-5">
          <div className="text-sm font-semibold text-slate-900">Supabase 連線修復</div>
          <p className="mt-2 text-sm text-slate-700">
            系統暫時未能連到 Supabase，所以新增客人、建立紀錄和保存分析都會失敗。請先完成以下四步，再重新部署。
          </p>
          <div className="mt-3 rounded-md border border-red-100 bg-red-50 p-3 text-xs text-red-700">
            {supabaseBlocker.details}
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>到 Supabase Dashboard 的 Project Settings &gt; API，直接複製 Project URL，不要用 dashboard 網址推斷。</li>
            <li>同一頁複製 service_role key，填入 Vercel Production env：SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY。</li>
            <li>Redeploy Vercel production deployment，讓新 env 生效。</li>
            <li>本機或部署後跑 `npm run diagnose:supabase` 和 `npm run smoke:health` 確認連線。</li>
          </ol>
          <div className="mt-4 rounded-md bg-slate-900 p-3 font-mono text-xs text-slate-100">
            npm.cmd run diagnose:supabase
          </div>
        </Card>
      ) : null}

      <Card className={`p-5 ${allOfficialReady ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">正式上線 readiness</div>
            <p className="mt-1 text-sm text-slate-700">
              {allOfficialReady
                ? 'Supabase、Google Drive、AI provider 都已達到正式模式。'
                : `目前 ${officialReadyCount}/${integrations.length} 項達到正式模式；Demo/Mock 可測流程，但未等於正式上線。`}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              allOfficialReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {allOfficialReady ? '可跑正式 release gate' : '仍有正式設定未完成'}
          </span>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-700">
          {integrations.map((item) => (
            <div key={item.key} className="flex items-start gap-2">
              <span className={item.officialReady ? 'text-emerald-700' : 'text-amber-700'}>
                {item.officialReady ? '✓' : '•'}
              </span>
              <span>
                <span className="font-medium">{item.label}：</span>
                {item.officialReady ? '正式模式已完成。' : item.nextAction ?? '仍需完成設定。'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {integrations.map((item) => (
          <Card key={item.key} className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${getModeClass(item)}`}>
                {getModeLabel(item)}
              </span>
            </div>
            <div className="mt-3 text-sm text-slate-600">{item.requiredFor}</div>
            <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs text-slate-600">{item.details}</div>
            {item.nextAction ? <div className="mt-3 text-xs text-amber-700">{item.nextAction}</div> : null}
            <Button
              className="mt-4"
              variant="secondary"
              onClick={() => void handleTest(item.key as TestTarget)}
              disabled={testing === item.key}
            >
              {testing === item.key ? '測試中...' : '測試連線'}
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">設定 Google Drive 圖片儲存</div>
        <p className="mt-2 text-sm text-slate-600">
          正式客人圖片應使用 Google Drive。Demo storage 只適合測試流程，不適合作長期保存。
        </p>
        <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Google Drive API 設定步驟</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>在 Google Cloud 建立 project，啟用 Google Drive API。</li>
            <li>建立 service account，下載 JSON key。</li>
            <li>在 Google Drive 建立專用 folder，把 folder 分享給 service account email。</li>
            <li>把 JSON 內的 client_email、private_key 和 Drive folder id 填到下方。</li>
            <li>保存後按「測試連線」，確認 folder 權限正確。</li>
          </ol>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1">
            <Label>圖片儲存模式</Label>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={storageProvider}
              onChange={(event) => setStorageProvider(event.target.value as 'google-drive' | 'demo')}
            >
              <option value="google-drive">Google Drive 正式儲存</option>
              <option value="demo">Demo 測試儲存</option>
            </select>
          </div>
          <div className="grid gap-1">
            <Label>Service account email</Label>
            <Input value={clientEmail} onChange={(event) => setClientEmail(event.target.value)} placeholder="name@project.iam.gserviceaccount.com" />
          </div>
          <div className="grid gap-1">
            <Label>Private key</Label>
            <textarea
              className="min-h-28 rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={privateKey}
              onChange={(event) => setPrivateKey(event.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----..."
            />
            <div className="text-xs text-slate-500">保存後不會回填顯示 private key；如要更換，重新貼上新 key 即可。</div>
          </div>
          <div className="grid gap-1">
            <Label>Google Drive folder id</Label>
            <Input value={folderId} onChange={(event) => setFolderId(event.target.value)} placeholder="Drive folder ID" />
          </div>
          <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              type="checkbox"
              className="mt-1"
              checked={publicAccess}
              onChange={(event) => setPublicAccess(event.target.checked)}
            />
            <span>
              <span className="font-medium">允許圖片公開連結</span>
              <span className="mt-1 block text-xs text-amber-800">
                不建議用於客人資料。關閉後圖片會以登入後的 server proxy 顯示，OpenAI 分析會使用 server-side image bytes。
              </span>
            </span>
          </label>
          <Button onClick={() => void handleSaveGoogleDrive()} disabled={saving === 'google-drive'}>
            {saving === 'google-drive' ? '保存中...' : '保存 Google Drive 設定'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">設定 AI 分析</div>
        <p className="mt-2 text-sm text-slate-600">
          未有 OpenAI key 時可以保留 Mock AI，先測完整操作流程；正式計數請切換 OpenAI Vision。
        </p>
        <div className="mt-4 rounded-md bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-medium text-slate-900">AI 接入策略</div>
          <div className="mt-2">
            第一版已保留 structured JSON adapter。之後只要填入 OpenAI API key 和可用 vision model，就可以把 mock 初步標記換成真 AI 分析；人手確認後的 annotations 仍然是正式統計依據。
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          <div className="grid gap-1">
            <Label>AI provider</Label>
            <select
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'mock' | 'openai-5.5')}
            >
              <option value="mock">Mock AI</option>
              <option value="openai-5.5">OpenAI Vision</option>
            </select>
          </div>
          <div className="grid gap-1">
            <Label>OpenAI API key</Label>
            <Input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-..." />
          </div>
          <div className="grid gap-1">
            <Label>Vision model</Label>
            <Input value={model} onChange={(event) => setModel(event.target.value)} />
          </div>
          <Button onClick={() => void handleSaveOpenAi()} disabled={saving === 'openai'}>
            {saving === 'openai' ? '保存中...' : '保存 AI 設定'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
