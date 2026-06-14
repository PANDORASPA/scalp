import 'server-only'

import { randomUUID } from 'node:crypto'

import type { ScalpStorageAdapter, ScalpStorageUploadInput, ScalpStorageUploadResult } from './types'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildDemoImageUrl(input: ScalpStorageUploadInput) {
  const label = escapeXml(input.fileName || 'demo scalp image')
  const sizeKb = Math.max(1, Math.round(input.bytes.length / 1024))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f8fafc"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </linearGradient>
  </defs>
  <rect width="720" height="480" fill="url(#bg)"/>
  <circle cx="170" cy="160" r="56" fill="#bfdbfe" opacity="0.7"/>
  <circle cx="540" cy="330" r="78" fill="#bbf7d0" opacity="0.55"/>
  <path d="M120 300 C220 190 330 390 455 230 S625 250 650 155" fill="none" stroke="#334155" stroke-width="8" stroke-linecap="round" opacity="0.3"/>
  <path d="M155 338 C260 230 335 405 500 240" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round" opacity="0.45"/>
  <text x="360" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f172a">Demo scalp image</text>
  <text x="360" y="252" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#475569">${label}</text>
  <text x="360" y="282" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#64748b">${sizeKb} KB uploaded, stored as demo placeholder</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const demoStorageAdapter: ScalpStorageAdapter = {
  provider: 'demo',
  async upload(input: ScalpStorageUploadInput): Promise<ScalpStorageUploadResult> {
    return {
      provider: 'demo',
      fileId: `demo-${randomUUID()}`,
      url: buildDemoImageUrl(input),
      objectKey: input.objectKey,
    }
  },
  async delete() {
    return
  },
}
