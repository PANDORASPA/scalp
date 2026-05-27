import type { MockDb } from '../mockdb/store'
import { computeAiPointAnalysis } from './ai'
import { computeComparison, computePointSummary, validateAllMetricsPresent } from './logic'
import type { CapturePointCode } from './constants'

function getSessionById(db: MockDb, sessionId: string) {
  return db.sessions.find((session) => session.id === sessionId) ?? null
}

function getPreviousSession(db: MockDb, customerId: string, checkDate: string, sessionId: string) {
  return (
    db.sessions
      .filter(
        (session) =>
          session.customer_id === customerId &&
          session.id !== sessionId &&
          session.check_date < checkDate,
      )
      .sort((a, b) => b.check_date.localeCompare(a.check_date))[0] ?? null
  )
}

function getNextSession(db: MockDb, customerId: string, checkDate: string, sessionId: string) {
  return (
    db.sessions
      .filter(
        (session) =>
          session.customer_id === customerId &&
          session.id !== sessionId &&
          session.check_date > checkDate,
      )
      .sort((a, b) => a.check_date.localeCompare(b.check_date))[0] ?? null
  )
}

export function syncSessionPointDerivedData(params: {
  db: MockDb
  customerId: string
  sessionId: string
  capturePointCode: CapturePointCode
  nowISO: string
  cascadeToNext?: boolean
}) {
  const { db, customerId, sessionId, capturePointCode, nowISO, cascadeToNext = true } = params

  const currentSession = getSessionById(db, sessionId)
  if (!currentSession) return

  const imagesForPoint = db.images
    .filter((image) => image.session_id === sessionId && image.capture_point_code === capturePointCode)
    .sort((a, b) => a.shot_index - b.shot_index)

  const metricsByImageId = Object.fromEntries(
    db.metrics
      .filter((metric) => imagesForPoint.some((image) => image.id === metric.image_id))
      .map((metric) => [metric.image_id, metric]),
  )

  const metricsByShot = imagesForPoint.map((image) => {
    const metric = metricsByImageId[image.id]
    return metric
      ? {
          oil_score: metric.oil_score,
          redness_score: metric.redness_score,
          density_score: metric.density_score,
          blockage_score: metric.blockage_score,
          dandruff_score: metric.dandruff_score,
          sensitivity_score: metric.sensitivity_score,
        }
      : {}
  })

  const canComputeSummary =
    imagesForPoint.length === 3 &&
    metricsByShot.length === 3 &&
    metricsByShot.every((metric) => validateAllMetricsPresent(metric))

  const previousSession = getPreviousSession(db, customerId, currentSession.check_date, sessionId)
  const pointShotAnalyses = db.aiShotAnalyses
    .filter((item) => item.session_id === sessionId && item.capture_point_code === capturePointCode)
    .sort((a, b) => a.shot_index - b.shot_index)
  const existingAiPointAnalysis = db.aiPointAnalyses.find(
    (item) => item.session_id === sessionId && item.capture_point_code === capturePointCode,
  )
  const previousAiPointAnalysis = previousSession
    ? db.aiPointAnalyses.find(
        (item) => item.session_id === previousSession.id && item.capture_point_code === capturePointCode,
      ) ?? null
    : null

  const aiPointAnalysis = computeAiPointAnalysis({
    customerId,
    sessionId,
    capturePointCode,
    shotAnalyses: pointShotAnalyses,
    nowISO,
    existing: existingAiPointAnalysis,
    previous: previousAiPointAnalysis,
  })
  const aiPointAnalysisIdx = db.aiPointAnalyses.findIndex((item) => item.id === aiPointAnalysis.id)
  if (aiPointAnalysisIdx === -1) db.aiPointAnalyses.push(aiPointAnalysis)
  else db.aiPointAnalyses[aiPointAnalysisIdx] = aiPointAnalysis

  const existingSummary = db.pointSummaries.find(
    (pointSummary) =>
      pointSummary.session_id === sessionId && pointSummary.capture_point_code === capturePointCode,
  )

  if (canComputeSummary) {
    const summary = computePointSummary({
      customerId,
      sessionId,
      capturePointCode,
      metricsByShot,
      nowISO,
      existingId: existingSummary?.id,
    })
    const summaryIdx = db.pointSummaries.findIndex((pointSummary) => pointSummary.id === summary.id)
    if (summaryIdx === -1) db.pointSummaries.push(summary)
    else db.pointSummaries[summaryIdx] = summary

    if (previousSession) {
      const previousSummary = db.pointSummaries.find(
        (pointSummary) =>
          pointSummary.session_id === previousSession.id &&
          pointSummary.capture_point_code === capturePointCode,
      )

      if (previousSummary?.completed) {
        const existingComparison = db.comparisons.find(
          (comparison) =>
            comparison.current_session_id === sessionId &&
            comparison.previous_session_id === previousSession.id &&
            comparison.capture_point_code === capturePointCode,
        )
        const nextComparison = computeComparison({
          customerId,
          capturePointCode,
          currentSessionId: sessionId,
          previousSessionId: previousSession.id,
          current: summary,
          previous: previousSummary,
          nowISO,
          existingId: existingComparison?.id,
        })

        const comparisonIdx = db.comparisons.findIndex((comparison) => comparison.id === nextComparison.id)
        if (comparisonIdx === -1) db.comparisons.push(nextComparison)
        else db.comparisons[comparisonIdx] = nextComparison
      } else {
        db.comparisons = db.comparisons.filter(
          (comparison) =>
            !(
              comparison.current_session_id === sessionId &&
              comparison.capture_point_code === capturePointCode
            ),
        )
      }
    } else {
      db.comparisons = db.comparisons.filter(
        (comparison) =>
          !(comparison.current_session_id === sessionId && comparison.capture_point_code === capturePointCode),
      )
    }
  } else {
    db.pointSummaries = db.pointSummaries.filter(
      (pointSummary) =>
        !(
          pointSummary.session_id === sessionId &&
          pointSummary.capture_point_code === capturePointCode
        ),
    )
    db.comparisons = db.comparisons.filter(
      (comparison) =>
        !(
          comparison.current_session_id === sessionId &&
          comparison.capture_point_code === capturePointCode
        ),
    )
  }

  if (!cascadeToNext) return

  const nextSession = getNextSession(db, customerId, currentSession.check_date, sessionId)
  if (!nextSession) return

  syncSessionPointDerivedData({
    db,
    customerId,
    sessionId: nextSession.id,
    capturePointCode,
    nowISO,
    cascadeToNext: false,
  })
}
