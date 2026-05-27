import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type {
  Customer,
  ScalpAiPointAnalysis,
  ScalpAiShotAnalysis,
  ScalpComparison,
  ScalpImage,
  ScalpImageMetrics,
  ScalpPointSummary,
  ScalpSession,
} from '@/lib/scalp/types'

export type MockDb = {
  customers: Customer[]
  sessions: ScalpSession[]
  images: ScalpImage[]
  metrics: ScalpImageMetrics[]
  pointSummaries: ScalpPointSummary[]
  comparisons: ScalpComparison[]
  aiShotAnalyses: ScalpAiShotAnalysis[]
  aiPointAnalyses: ScalpAiPointAnalysis[]
}

const DB_PATH = path.join(process.cwd(), '.data', 'mock-db.json')

export async function readDb(): Promise<MockDb> {
  const raw = await readFile(DB_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as Partial<MockDb>

  return {
    customers: parsed.customers ?? [],
    sessions: parsed.sessions ?? [],
    images: parsed.images ?? [],
    metrics: parsed.metrics ?? [],
    pointSummaries: parsed.pointSummaries ?? [],
    comparisons: parsed.comparisons ?? [],
    aiShotAnalyses: parsed.aiShotAnalyses ?? [],
    aiPointAnalyses: parsed.aiPointAnalyses ?? [],
  }
}

export async function writeDb(db: MockDb): Promise<void> {
  await writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
}

export async function updateDb<T>(fn: (db: MockDb) => Promise<{ db: MockDb; result: T }> | { db: MockDb; result: T }) {
  const db = await readDb()
  const { db: nextDb, result } = await fn(db)
  await writeDb(nextDb)
  return result
}
