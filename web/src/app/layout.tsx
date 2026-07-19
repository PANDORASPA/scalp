import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: 'Scalp Check Tool V1',
  description: 'A lightweight workflow for scalp capture, manual scoring, summary generation, and comparison.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  )
}
