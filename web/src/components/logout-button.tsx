'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  return (
    <button
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50"
      onClick={async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
        router.refresh()
      }}
    >
      Sign out
    </button>
  )
}
