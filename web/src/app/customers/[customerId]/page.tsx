import { AppShell } from '@/components/app-shell'
import CustomerDetailClient from '@/app/customers/[customerId]/ui/customer-detail-client'
import { getAuthSession } from '@/lib/auth/session'

export default async function CustomerDetailPage() {
  const session = await getAuthSession()
  return (
    <AppShell>
      <CustomerDetailClient role={session?.role ?? 'staff'} />
    </AppShell>
  )
}
