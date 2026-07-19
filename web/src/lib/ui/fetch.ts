'use client'

import { getHumanErrorMessage } from './errors'

export const DEFAULT_UI_REQUEST_TIMEOUT_MS = 30000

export function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_UI_REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const sourceSignal = init.signal
  const abortFromSource = () => controller.abort(sourceSignal?.reason)

  if (sourceSignal) {
    if (sourceSignal.aborted) abortFromSource()
    else sourceSignal.addEventListener('abort', abortFromSource, { once: true })
  }

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      const errorCode = body?.error ?? `request_failed_${response.status}`
      throw new Error(getHumanErrorMessage(errorCode))
    }

    return (await response.json()) as T
  } catch (error) {
    if (timedOut) throw new Error(getHumanErrorMessage('request_timeout'))
    if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
      throw new Error(getHumanErrorMessage('request_network_failed'))
    }
    throw error
  } finally {
    clearTimeout(timeout)
    sourceSignal?.removeEventListener('abort', abortFromSource)
  }
}
