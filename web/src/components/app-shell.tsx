import Link from 'next/link'

import { LogoutButton } from '@/components/logout-button'
import { getAuthSession } from '@/lib/auth/session'

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()

  return (
    <div>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link className="text-sm font-semibold" href="/">
              頭皮追蹤系統
            </Link>
            <nav className="flex items-center gap-2 text-sm text-slate-600">
              <Link className="hover:text-slate-900" href="/customers">
                客戶
              </Link>
              <span className="text-slate-300">/</span>
              <Link className="hover:text-slate-900" href="/scalp-analysis">
                頭皮分析
              </Link>
              <span className="text-slate-300">/</span>
              <Link className="hover:text-slate-900" href="/comparisons">
                前後比較
              </Link>
              <span className="text-slate-300">/</span>
              <Link className="hover:text-slate-900" href="/settings">
                設定
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {session ? (
              <div className="text-right">
                <div className="text-sm font-medium text-slate-900">{session.name}</div>
                <div className="text-xs text-slate-500">{session.role}</div>
              </div>
            ) : null}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
