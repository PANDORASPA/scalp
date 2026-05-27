import { AppShell } from '@/components/app-shell'
import CaptureClient from '@/app/sessions/[sessionId]/capture/ui/capture-client'

export default function CapturePage() {
  return (
    <AppShell>
      <CaptureClient />
    </AppShell>
  )
}

