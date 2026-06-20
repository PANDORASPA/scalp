import { Suspense } from 'react'

import { AppShell } from '@/components/app-shell'
import ComparisonsClient from '@/app/comparisons/ui/comparisons-client'

export default function ComparisonsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-6 text-sm text-slate-600">正在載入...</div>}>
        <ComparisonsClient />
      </Suspense>
    </AppShell>
  )
}
