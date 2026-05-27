import { NextResponse } from 'next/server'

import { hasSupabaseServerEnv } from '@/lib/config/supabase'
import { updateDb } from '@/lib/mockdb/store'
import { CAPTURE_POINT_CODES } from '@/lib/scalp/constants'
import { computeAiPointAnalysis } from '@/lib/scalp/ai'
import { computeComparison } from '@/lib/scalp/logic'
import {
  createCustomerInSupabase,
  createSessionInSupabase,
  getWorkspaceSnapshot,
  replaceDerivedPointDataInSupabase,
  seedCapturePointsIfNeeded,
  toRepositoryError,
} from '@/lib/supabase/repository'
import type { Customer, ScalpAiPointAnalysis, ScalpAiShotAnalysis, ScalpPointSummary, ScalpSession } from '@/lib/scalp/types'

export const runtime = 'nodejs'

type SeedResult = {
  created: boolean
  message?: string
  customerId?: string
  currentSessionId?: string
}

export async function POST() {
  const now = new Date().toISOString()
  type ScoreMatrix = Record<(typeof CAPTURE_POINT_CODES)[number], readonly [number, number, number, number, number, number]>

  if (hasSupabaseServerEnv()) {
    try {
      const workspace = await getWorkspaceSnapshot()
      if (workspace.customers.length > 0 || workspace.sessions.length > 0) {
        return NextResponse.json({
          created: false,
          message: 'existing_data',
        } satisfies SeedResult)
      }

      await seedCapturePointsIfNeeded()

      const customerId = crypto.randomUUID()
      const previousSessionId = crypto.randomUUID()
      const currentSessionId = crypto.randomUUID()

      const customer = await createCustomerInSupabase({
        name: 'Demo Customer',
        phone: '0912-345-678',
        notes: 'Seeded demo data for workflow testing',
        nowISO: now,
      })

      const previousSession = await createSessionInSupabase({
        customer_id: customer.id,
        check_date: '2026-02-18T10:00:00.000Z',
        staff_name: 'Amy',
        notes: 'Initial baseline check',
        nowISO: now,
      })
      const currentSession = await createSessionInSupabase({
        customer_id: customer.id,
        check_date: '2026-03-16T10:00:00.000Z',
        staff_name: 'Amy',
        notes: 'Second visit',
        nowISO: now,
      })

      const previousValues: ScoreMatrix = {
        front: [7.2, 5.8, 5.1, 6.1, 4.8, 5.2],
        left: [6.5, 5.2, 5.4, 5.8, 4.1, 4.8],
        right: [6.8, 5.4, 5.2, 5.9, 4.4, 5.1],
        crown: [7.5, 5.9, 4.8, 6.4, 4.9, 5.6],
        back: [5.9, 4.1, 5.7, 4.9, 3.8, 4.3],
      }

      const currentValues: ScoreMatrix = {
        front: [6.1, 4.7, 5.7, 5.2, 3.9, 4.4],
        left: [5.7, 4.5, 5.9, 5.1, 3.5, 4.2],
        right: [6.0, 4.8, 5.8, 5.2, 3.8, 4.3],
        crown: [6.6, 5.0, 5.4, 5.6, 4.2, 4.9],
        back: [5.2, 3.9, 6.0, 4.5, 3.2, 4.0],
      }

      const previousSummaries: ScalpPointSummary[] = CAPTURE_POINT_CODES.map((code) => ({
        id: crypto.randomUUID(),
        customer_id: customer.id,
        session_id: previousSession.id,
        capture_point_code: code,
        oil_avg: previousValues[code][0],
        redness_avg: previousValues[code][1],
        density_avg: previousValues[code][2],
        blockage_avg: previousValues[code][3],
        dandruff_avg: previousValues[code][4],
        sensitivity_avg: previousValues[code][5],
        completed: true,
        computed_at: now,
      }))

      const currentSummaries: ScalpPointSummary[] = CAPTURE_POINT_CODES.map((code) => ({
        id: crypto.randomUUID(),
        customer_id: customer.id,
        session_id: currentSession.id,
        capture_point_code: code,
        oil_avg: currentValues[code][0],
        redness_avg: currentValues[code][1],
        density_avg: currentValues[code][2],
        blockage_avg: currentValues[code][3],
        dandruff_avg: currentValues[code][4],
        sensitivity_avg: currentValues[code][5],
        completed: true,
        computed_at: now,
      }))

      const comparisons = CAPTURE_POINT_CODES.map((code) =>
        computeComparison({
          customerId: customer.id,
          capturePointCode: code,
          currentSessionId: currentSession.id,
          previousSessionId: previousSession.id,
          current: currentSummaries.find((item) => item.capture_point_code === code)!,
          previous: previousSummaries.find((item) => item.capture_point_code === code)!,
          nowISO: now,
        }),
      )

      const buildAiShotAnalyses = (sessionId: string, source: ScoreMatrix) =>
        CAPTURE_POINT_CODES.flatMap((code) =>
          [1, 2, 3].map((shotIndex) => {
            const base = Math.round(28 + source[code][2] * 11 - source[code][3] * 1.4 - source[code][4] * 0.9 - source[code][1] * 0.4)
            return {
              id: crypto.randomUUID(),
              customer_id: customer.id,
              session_id: sessionId,
              image_id: crypto.randomUUID(),
              capture_point_code: code,
              shot_index: shotIndex as 1 | 2 | 3,
              hair_count_estimate: base + (shotIndex - 2) * 2,
              confidence_score: 0.67,
              provider_name: 'heuristic',
              analysis_method: 'baseline-density-v1',
              model_version: 'heuristic-2026-03-18',
              status: 'ready' as const,
              notes: 'Seeded baseline AI result',
              fallback_used: false,
              fallback_reason: null,
              raw_output_ref: null,
              created_at: now,
              updated_at: now,
            } satisfies ScalpAiShotAnalysis
          }),
        )

      const previousAiShotAnalyses = buildAiShotAnalyses(previousSession.id, previousValues)
      const currentAiShotAnalyses = buildAiShotAnalyses(currentSession.id, currentValues)
      const previousAiPointAnalyses = CAPTURE_POINT_CODES.map((code) =>
        computeAiPointAnalysis({
          customerId: customer.id,
          sessionId: previousSession.id,
          capturePointCode: code,
          shotAnalyses: previousAiShotAnalyses.filter((item) => item.capture_point_code === code),
          nowISO: now,
        }),
      )
      const previousAiPointMap = new Map(previousAiPointAnalyses.map((item) => [item.capture_point_code, item]))
      const currentAiPointAnalyses = CAPTURE_POINT_CODES.map((code) =>
        computeAiPointAnalysis({
          customerId: customer.id,
          sessionId: currentSession.id,
          capturePointCode: code,
          shotAnalyses: currentAiShotAnalyses.filter((item) => item.capture_point_code === code),
          nowISO: now,
          previous: previousAiPointMap.get(code) ?? null,
        }),
      )

      const snapshot = {
        customers: [customer],
        sessions: [currentSession, previousSession],
        images: [],
        metrics: [],
        pointSummaries: [...previousSummaries, ...currentSummaries],
        comparisons,
        aiShotAnalyses: [],
        aiPointAnalyses: [...previousAiPointAnalyses, ...currentAiPointAnalyses],
      }

      for (const code of CAPTURE_POINT_CODES) {
        await replaceDerivedPointDataInSupabase({
          customerId: customer.id,
          capturePointCode: code,
          snapshot,
        })
      }

      return NextResponse.json({
        created: true,
        customerId: customer.id,
        currentSessionId: currentSession.id,
      } satisfies SeedResult)
    } catch (error) {
      return NextResponse.json({ error: toRepositoryError(error) }, { status: 500 })
    }
  }

  const result = await updateDb<SeedResult>(async (db) => {
    if (db.customers.length > 0 || db.sessions.length > 0) {
      return {
        db,
        result: {
          created: false,
          message: 'existing_data',
        },
      }
    }

    const customerId = crypto.randomUUID()
    const previousSessionId = crypto.randomUUID()
    const currentSessionId = crypto.randomUUID()

    const customer: Customer = {
      id: customerId,
      name: 'Demo Customer',
      phone: '0912-345-678',
      notes: 'Seeded demo data for workflow testing',
      created_at: now,
      updated_at: now,
    }

    const sessions: ScalpSession[] = [
      {
        id: currentSessionId,
        customer_id: customerId,
        check_date: '2026-03-16T10:00:00.000Z',
        staff_name: 'Amy',
        notes: 'Second visit',
        created_at: now,
        updated_at: now,
      },
      {
        id: previousSessionId,
        customer_id: customerId,
        check_date: '2026-02-18T10:00:00.000Z',
        staff_name: 'Amy',
        notes: 'Initial baseline check',
        created_at: now,
        updated_at: now,
      },
    ]

    const previousValues: ScoreMatrix = {
      front: [7.2, 5.8, 5.1, 6.1, 4.8, 5.2],
      left: [6.5, 5.2, 5.4, 5.8, 4.1, 4.8],
      right: [6.8, 5.4, 5.2, 5.9, 4.4, 5.1],
      crown: [7.5, 5.9, 4.8, 6.4, 4.9, 5.6],
      back: [5.9, 4.1, 5.7, 4.9, 3.8, 4.3],
    }

    const currentValues: ScoreMatrix = {
      front: [6.1, 4.7, 5.7, 5.2, 3.9, 4.4],
      left: [5.7, 4.5, 5.9, 5.1, 3.5, 4.2],
      right: [6.0, 4.8, 5.8, 5.2, 3.8, 4.3],
      crown: [6.6, 5.0, 5.4, 5.6, 4.2, 4.9],
      back: [5.2, 3.9, 6.0, 4.5, 3.2, 4.0],
    }

    const previousSummaries: ScalpPointSummary[] = CAPTURE_POINT_CODES.map((code) => ({
      id: crypto.randomUUID(),
      customer_id: customerId,
      session_id: previousSessionId,
      capture_point_code: code,
      oil_avg: previousValues[code][0],
      redness_avg: previousValues[code][1],
      density_avg: previousValues[code][2],
      blockage_avg: previousValues[code][3],
      dandruff_avg: previousValues[code][4],
      sensitivity_avg: previousValues[code][5],
      completed: true,
      computed_at: now,
    }))

    const currentSummaries: ScalpPointSummary[] = CAPTURE_POINT_CODES.map((code) => ({
      id: crypto.randomUUID(),
      customer_id: customerId,
      session_id: currentSessionId,
      capture_point_code: code,
      oil_avg: currentValues[code][0],
      redness_avg: currentValues[code][1],
      density_avg: currentValues[code][2],
      blockage_avg: currentValues[code][3],
      dandruff_avg: currentValues[code][4],
      sensitivity_avg: currentValues[code][5],
      completed: true,
      computed_at: now,
    }))

    const comparisons = CAPTURE_POINT_CODES.map((code) =>
      computeComparison({
        customerId,
        capturePointCode: code,
        currentSessionId,
        previousSessionId,
        current: currentSummaries.find((item) => item.capture_point_code === code)!,
        previous: previousSummaries.find((item) => item.capture_point_code === code)!,
        nowISO: now,
      }),
    )

    const buildAiShotAnalyses = (sessionId: string, source: ScoreMatrix) =>
      CAPTURE_POINT_CODES.flatMap((code) =>
        [1, 2, 3].map((shotIndex) => {
          const base = Math.round(28 + source[code][2] * 11 - source[code][3] * 1.4 - source[code][4] * 0.9 - source[code][1] * 0.4)
          return {
            id: crypto.randomUUID(),
            customer_id: customerId,
            session_id: sessionId,
            image_id: crypto.randomUUID(),
            capture_point_code: code,
            shot_index: shotIndex as 1 | 2 | 3,
            hair_count_estimate: base + (shotIndex - 2) * 2,
            confidence_score: 0.67,
            provider_name: 'heuristic',
            analysis_method: 'baseline-density-v1',
            model_version: 'heuristic-2026-03-18',
            status: 'ready' as const,
            notes: 'Seeded baseline AI result',
            fallback_used: false,
            fallback_reason: null,
            raw_output_ref: null,
            created_at: now,
            updated_at: now,
          } satisfies ScalpAiShotAnalysis
        }),
      )

    const previousAiShotAnalyses = buildAiShotAnalyses(previousSessionId, previousValues)
    const currentAiShotAnalyses = buildAiShotAnalyses(currentSessionId, currentValues)

    const buildAiPointAnalyses = (
      sessionId: string,
      shotAnalyses: ScalpAiShotAnalysis[],
      previousByPoint: Map<string, ScalpAiPointAnalysis> | null,
    ) =>
      CAPTURE_POINT_CODES.map((code) =>
        computeAiPointAnalysis({
          customerId,
          sessionId,
          capturePointCode: code,
          shotAnalyses: shotAnalyses.filter((item) => item.capture_point_code === code),
          nowISO: now,
          previous: previousByPoint?.get(code) ?? null,
        }),
      )

    const previousAiPointAnalyses = buildAiPointAnalyses(previousSessionId, previousAiShotAnalyses, null)
    const previousAiPointMap = new Map(previousAiPointAnalyses.map((item) => [item.capture_point_code, item]))
    const currentAiPointAnalyses = buildAiPointAnalyses(currentSessionId, currentAiShotAnalyses, previousAiPointMap)

    db.customers.push(customer)
    db.sessions.push(...sessions)
    db.pointSummaries.push(...previousSummaries, ...currentSummaries)
    db.comparisons.push(...comparisons)
    db.aiShotAnalyses.push(...previousAiShotAnalyses, ...currentAiShotAnalyses)
    db.aiPointAnalyses.push(...previousAiPointAnalyses, ...currentAiPointAnalyses)

    return {
      db,
      result: {
        created: true,
        customerId,
        currentSessionId,
      },
    }
  })

  return NextResponse.json(result)
}
