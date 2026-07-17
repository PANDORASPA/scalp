import { AppShell } from '@/components/app-shell'
import { getAuthSession } from '@/lib/auth/session'

import ScalpAnalysisClient from './ui/scalp-analysis-client'

export default async function ScalpAnalysisPage() {
  const session = await getAuthSession()
  return (
    <AppShell>
      <ScalpAnalysisClient role={session?.role ?? 'staff'} />
    </AppShell>
  )
}
