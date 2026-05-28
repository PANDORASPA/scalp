'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { IntegrationStatus } from '@/lib/settings/status'
import { getHumanErrorMessage } from '@/lib/ui/errors'

type Props = {
  initialIntegrations: IntegrationStatus[]
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

export function SettingsClient({ initialIntegrations }: Props) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const [clientEmail, setClientEmail] = useState('')
  const [privateKey, setPrivateKey] = useState('')
  const [folderId, setFolderId] = useState('')
  const [provider, setProvider] = useState<'mock' | 'openai-5.5'>('mock')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('gpt-5.5')
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSaveGoogleDrive() {
    setSaving('google-drive')
    setMessage(null)
    setError(null)
    try {
      const next = await saveSettings({
        googleDrive: {
          clientEmail,
          privateKey,
          folderId,
        },
      })
      setIntegrations(next)
      setPrivateKey('')
      setMessage('Google Drive 設定已保存。')
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
      setMessage('AI 設定已保存。')
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
        <div className="text-sm font-semibold text-slate-900">在工具內設定 Google Drive</div>
        <p className="mt-2 text-sm text-slate-600">
          請貼上 Google Cloud service account 的資料。Private key 只會送到後端保存，不會再次顯示。
        </p>
        <div className="mt-4 grid gap-3">
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
          </div>
          <div className="grid gap-1">
            <Label>Google Drive folder id</Label>
            <Input value={folderId} onChange={(event) => setFolderId(event.target.value)} placeholder="Drive folder ID" />
          </div>
          <Button onClick={() => void handleSaveGoogleDrive()} disabled={saving === 'google-drive'}>
            {saving === 'google-drive' ? '保存中...' : '保存 Google Drive 設定'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="text-sm font-semibold text-slate-900">在工具內設定 AI</div>
        <p className="mt-2 text-sm text-slate-600">未有 OpenAI key 時保持 mock，即可先完成流程測試。</p>
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
