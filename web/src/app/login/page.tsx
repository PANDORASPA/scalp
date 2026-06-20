'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">系統登入</h1>
          <p className="text-sm text-slate-600">
            請使用已設定的員工帳號登入。正式使用前請在設定頁確認 production health。
          </p>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-1">
            <Label htmlFor="username">帳號</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="password">密碼</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error ? <div className="text-sm text-red-700">{error}</div> : null}

          <Button
            disabled={loading}
            onClick={async () => {
              if (!username.trim() || !password.trim()) {
                setError('請輸入帳號和密碼。')
                return
              }

              setLoading(true)
              setError(null)
              try {
                const res = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username, password }),
                })
                if (!res.ok) throw new Error('帳號或密碼不正確')
                router.push('/')
                router.refresh()
              } catch (e) {
                setError(e instanceof Error ? e.message : '登入失敗')
                setLoading(false)
              }
            }}
          >
            {loading ? '登入中...' : '登入'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
