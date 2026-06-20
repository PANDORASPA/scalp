'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'

export function DemoSeedButton({
  className,
  onSeeded,
}: {
  className?: string
  onSeeded?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <div className={className}>
      <Button
        variant="secondary"
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          setMessage(null)
          try {
            const res = await fetch('/api/demo/seed', { method: 'POST' })
            const json = (await res.json()) as {
              created: boolean
              message?: string
            }

            if (!res.ok) throw new Error('建立示範資料失敗')

            if (json.created) {
              setMessage('示範資料已建立，可以開始測試完整流程。')
            } else {
              setMessage('系統已有資料，沒有覆蓋現有紀錄。')
            }

            onSeeded?.()
            router.refresh()
          } catch (e) {
            setMessage(e instanceof Error ? e.message : '建立示範資料失敗')
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? '正在建立示範資料...' : '載入示範資料'}
      </Button>
      {message ? <div className="mt-2 text-xs text-slate-600">{message}</div> : null}
    </div>
  )
}
