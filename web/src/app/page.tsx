import Link from 'next/link'

import { AppShell } from '@/components/app-shell'
import { DemoSeedButton } from '@/components/demo-seed-button'
import { Card } from '@/components/ui/card'
import { getAuthSession } from '@/lib/auth/session'
import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { buildCustomerWorkspaceRows } from '@/lib/customers/workspace'
import { readDb } from '@/lib/mockdb/store'
import { getWorkspaceSnapshot } from '@/lib/supabase/repository'

export default async function HomePage() {
  const session = await getAuthSession()
  const db = hasSupabaseServerEnv()
    ? await getWorkspaceSnapshot()
    : await readDb()
  const { summary } = buildCustomerWorkspaceRows({
    customers: db.customers,
    sessions: db.sessions,
    pointSummaries: db.pointSummaries,
  })

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">Salon workflow dashboard</h1>
              <p className="text-sm text-slate-600">
                Signed in as {session?.name ?? 'Unknown user'}. Use the workspace below to move customers through the daily queue.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                href="/customers"
              >
                Open workspace
              </Link>
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                href="/scalp-analysis"
              >
                Open scalp analysis
              </Link>
              <DemoSeedButton />
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Needs session</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.needs_session}</div>
            <div className="mt-1 text-sm text-slate-600">Customers without a first visit yet.</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Needs capture</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.needs_capture}</div>
            <div className="mt-1 text-sm text-slate-600">Latest session still missing full point coverage.</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Ready compare</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.ready_compare}</div>
            <div className="mt-1 text-sm text-slate-600">Latest session complete and ready for review.</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Follow-up due</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.stale_follow_up}</div>
            <div className="mt-1 text-sm text-slate-600">No recent visit in the last 30 days.</div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-sm font-semibold">1. Front desk</div>
            <p className="mt-2 text-sm text-slate-600">
              Use customer filters to find who needs a new visit, who still needs capture work, and who is overdue.
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold">2. Capture station</div>
            <p className="mt-2 text-sm text-slate-600">
              Batch upload point images, then refine per-shot scoring and metadata without re-uploading.
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold">3. Review</div>
            <p className="mt-2 text-sm text-slate-600">
              Once all five points are complete, open comparison to discuss changes with the customer.
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
