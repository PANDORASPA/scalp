import { AppShell } from '@/components/app-shell'
import CustomersClient from '@/app/customers/ui/customers-client'
import { getAuthSession } from '@/lib/auth/session'

export default async function CustomersPage() {
  const session = await getAuthSession()
  return (
    <AppShell>
      <CustomersClient role={session?.role ?? 'staff'} />
    </AppShell>
  )
}
