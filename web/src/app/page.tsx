import Link from 'next/link'

import { AppShell } from '@/components/app-shell'
import { DemoSeedButton } from '@/components/demo-seed-button'
import { Card } from '@/components/ui/card'
import { getAuthSession } from '@/lib/auth/session'
import { isDeployedRuntime } from '@/lib/config/supabase'
import { buildCustomerWorkspaceRows } from '@/lib/customers/workspace'
import { readDb, type MockDb } from '@/lib/mockdb/store'
import { getWorkspaceSnapshot } from '@/lib/supabase/repository'
import { getWorkspaceLoadError, shouldUseSupabaseWorkspace } from '@/lib/ui/home-status'
import { withWorkspaceLoadTimeout } from '@/lib/ui/workspace-load'
import type { TrackingAreaProgress } from '@/lib/customers/workspace'
import type { ScalpAreaSummary } from '@/lib/scalp-analysis/types'
import type { ScalpSession } from '@/lib/scalp/types'

type HomeWorkspaceData = Pick<MockDb, 'customers' | 'sessions' | 'pointSummaries'> & {
  trackingSessions?: ScalpSession[]
  trackingCompletedAreas?: TrackingAreaProgress[]
  trackingAreaSummaries?: ScalpAreaSummary[]
}

export default async function HomePage() {
  const session = await getAuthSession()
  let db: HomeWorkspaceData | null = null
  let loadError: ReturnType<typeof getWorkspaceLoadError> | null = null

  try {
    db = shouldUseSupabaseWorkspace()
      ? await withWorkspaceLoadTimeout(() => getWorkspaceSnapshot())
      : await readDb()
  } catch (error) {
    loadError = getWorkspaceLoadError(error)
  }

  if (loadError || !db) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-4 p-6">
          <Card className="border-red-200 bg-red-50 p-6">
            <div className="text-xs font-medium uppercase tracking-wide text-red-700">工作台資料暫時不可用</div>
            <h1 className="mt-2 text-xl font-semibold text-red-950">{loadError?.message ?? '工作台未能載入。'}</h1>
            <p className="mt-3 text-sm text-red-900">
              系統沒有顯示空白統計，避免將連線故障誤當成沒有客人資料。
            </p>
            <div className="mt-4 rounded-md border border-red-200 bg-white/70 p-3 text-xs text-red-800">
              {loadError?.detail ?? '請到設定頁檢查系統狀態。'}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" href="/settings">
                檢查系統設定
              </Link>
              <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50" href="/">
                重新載入
              </Link>
            </div>
          </Card>
        </div>
      </AppShell>
    )
  }

  const { summary } = buildCustomerWorkspaceRows({
    customers: db.customers,
    sessions: db.sessions,
    pointSummaries: db.pointSummaries,
    trackingSessions: db.trackingSessions,
    trackingCompletedAreas:
      db.trackingCompletedAreas ??
      db.trackingAreaSummaries?.map(({ customer_id, session_id }) => ({ customer_id, session_id })),
  })
  const canLoadDemoData =
    !isDeployedRuntime() &&
    session?.role === 'admin' &&
    db.customers.length === 0 &&
    db.sessions.length === 0

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Card className="p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">頭皮檢查工作台</h1>
              <p className="text-sm text-slate-600">
                目前登入：{session?.name ?? '未知使用者'}。請用下方工作台安排客人、建立檢查、上傳圖片與查看比較。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                href="/customers"
              >
                打開客戶工作台
              </Link>
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                href="/scalp-analysis"
              >
                打開頭皮分析
              </Link>
              {canLoadDemoData ? <DemoSeedButton /> : null}
            </div>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">未建立一般檢查</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.needs_session}</div>
            <div className="mt-1 text-sm text-slate-600">已建立客戶但未有第一次檢查的客人。</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">待上傳圖片</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.needs_capture}</div>
            <div className="mt-1 text-sm text-slate-600">最新 session 仍未完成所有部位拍攝。</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">可作比較</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.ready_compare}</div>
            <div className="mt-1 text-sm text-slate-600">最新 session 已完成，可和歷史紀錄比較。</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">需要跟進</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.stale_follow_up}</div>
            <div className="mt-1 text-sm text-slate-600">超過 30 日未有新檢查的客人。</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">放大圖待完成</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{summary.tracking_incomplete}</div>
            <div className="mt-1 text-sm text-slate-600">已開始 tracking 但仍未完成 6 個固定部位的客人。</div>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <div className="text-sm font-semibold">1. 前台建檔</div>
            <p className="mt-2 text-sm text-slate-600">
              用客戶工作台快速找出未建立 session、未完成拍攝，或需要跟進的客人。
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold">2. 拍攝工作站</div>
            <p className="mt-2 text-sm text-slate-600">
              每個固定部位上傳 3 張圖，之後可補充分數與資料，不需要重建 session。
            </p>
          </Card>
          <Card className="p-5">
            <div className="text-sm font-semibold">3. 報告與比較</div>
            <p className="mt-2 text-sm text-slate-600">
              完成拍攝及確認後，打開比較頁向客人展示變化。
            </p>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}
