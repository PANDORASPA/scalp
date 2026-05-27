import { Suspense } from 'react'

import { AppShell } from '@/components/app-shell'
import NewSessionClient from '@/app/sessions/new/ui/new-session-client'

export default function NewSessionPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-6 text-sm text-slate-600">Loading...</div>}>
        <NewSessionClient />
      </Suspense>
    </AppShell>
  )
}
