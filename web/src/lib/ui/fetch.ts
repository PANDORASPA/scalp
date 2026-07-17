'use client'

import { getHumanErrorMessage } from './errors'

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    const errorCode = body?.error ?? `request_failed_${response.status}`
    throw new Error(getHumanErrorMessage(errorCode))
  }

  return (await response.json()) as T
}
