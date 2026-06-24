export function buildScalpImageStoragePath(params: {
  customerId: string
  sessionId: string
  capturePointCode: string
  shotIndex: 1 | 2 | 3
}) {
  const { customerId, sessionId, capturePointCode, shotIndex } = params
  return `${customerId}/${sessionId}/${capturePointCode}/${shotIndex}.jpg`
}
