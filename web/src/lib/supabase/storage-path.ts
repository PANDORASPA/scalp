import { isCapturePointCode } from '../scalp/logic'

export function buildScalpImageStoragePath(params: {
  customerId: string
  sessionId: string
  capturePointCode: string
  shotIndex: 1 | 2 | 3
}) {
  const { customerId, sessionId, capturePointCode, shotIndex } = params
  return `${customerId}/${sessionId}/${capturePointCode}/${shotIndex}.jpg`
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isAllowedScalpImageStoragePath(value: string) {
  const parts = value.split('/')
  if (parts.length !== 4) return false
  const [customerId, sessionId, capturePointCode, fileName] = parts
  return (
    UUID_PATTERN.test(customerId) &&
    UUID_PATTERN.test(sessionId) &&
    isCapturePointCode(capturePointCode) &&
    /^(1|2|3)\.jpg$/i.test(fileName)
  )
}
