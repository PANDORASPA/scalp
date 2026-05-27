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

            if (!res.ok) throw new Error('Failed to create demo data')

            if (json.created) {
              setMessage('Demo data is ready. You can now test the full flow.')
            } else {
              setMessage('Existing data was found, so nothing was overwritten.')
            }

            onSeeded?.()
            router.refresh()
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Failed to create demo data')
          } finally {
            setLoading(false)
          }
        }}
      >
        {loading ? 'Creating demo data...' : 'Load demo data'}
      </Button>
      {message ? <div className="mt-2 text-xs text-slate-600">{message}</div> : null}
    </div>
  )
}
