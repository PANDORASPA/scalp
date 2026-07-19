import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
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
} from '../scalp/types'
import type { ScalpAnalysisImage, ScalpAreaSummary } from '../scalp-analysis/types'

export type MockDb = {
  customers: Customer[]
  sessions: ScalpSession[]
  images: ScalpImage[]
  metrics: ScalpImageMetrics[]
  pointSummaries: ScalpPointSummary[]
  comparisons: ScalpComparison[]
  aiShotAnalyses: ScalpAiShotAnalysis[]
  aiPointAnalyses: ScalpAiPointAnalysis[]
  trackingImages?: ScalpAnalysisImage[]
  trackingAreaSummaries?: ScalpAreaSummary[]
}

const DB_PATH = path.join(process.cwd(), '.data', 'mock-db.json')
const BACKUP_PATH = `${DB_PATH}.bak`
const LOCK_PATH = `${DB_PATH}.lock`
let updateQueue: Promise<void> = Promise.resolve()

async function acquireFileLock() {
  await mkdir(path.dirname(DB_PATH), { recursive: true })
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30_000) {
    try {
      const handle = await open(LOCK_PATH, 'wx')
      return async () => {
        await handle.close()
        await rm(LOCK_PATH, { force: true })
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }
  throw new Error('mock_db_locked: The local mock database is busy. Try again.')
}

function emptyDb(): MockDb {
  return {
    customers: [],
    sessions: [],
    images: [],
    metrics: [],
    pointSummaries: [],
    comparisons: [],
    aiShotAnalyses: [],
    aiPointAnalyses: [],
    trackingImages: [],
    trackingAreaSummaries: [],
  }
}

export async function readDb(): Promise<MockDb> {
  let raw: string
  try {
    raw = await readFile(DB_PATH, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      try {
        raw = await readFile(BACKUP_PATH, 'utf-8')
      } catch (backupError) {
        if ((backupError as NodeJS.ErrnoException).code === 'ENOENT') return emptyDb()
        throw backupError
      }
    } else {
      throw error
    }
  }
  let parsed: Partial<MockDb>
  try {
    parsed = JSON.parse(raw) as Partial<MockDb>
  } catch (error) {
    throw new Error(
      `mock_db_corrupt: ${error instanceof Error ? error.message : 'The local mock database is not valid JSON.'}`,
    )
  }

  return {
    customers: parsed.customers ?? [],
    sessions: parsed.sessions ?? [],
    images: parsed.images ?? [],
    metrics: parsed.metrics ?? [],
    pointSummaries: parsed.pointSummaries ?? [],
    comparisons: parsed.comparisons ?? [],
    aiShotAnalyses: parsed.aiShotAnalyses ?? [],
    aiPointAnalyses: parsed.aiPointAnalyses ?? [],
    trackingImages: parsed.trackingImages ?? [],
    trackingAreaSummaries: parsed.trackingAreaSummaries ?? [],
  }
}

export async function writeDb(db: MockDb): Promise<void> {
  await mkdir(path.dirname(DB_PATH), { recursive: true })
  const tempPath = `${DB_PATH}.${process.pid}.tmp`
  await writeFile(tempPath, JSON.stringify(db, null, 2), 'utf-8')
  let movedPrevious = false
  try {
    await rm(BACKUP_PATH, { force: true })
    try {
      await rename(DB_PATH, BACKUP_PATH)
      movedPrevious = true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await rename(tempPath, DB_PATH)
    if (movedPrevious) await rm(BACKUP_PATH, { force: true })
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => undefined)
    if (movedPrevious) {
      await rename(BACKUP_PATH, DB_PATH).catch(() => undefined)
    }
    throw error
  }
}

export async function updateDb<T>(fn: (db: MockDb) => Promise<{ db: MockDb; result: T }> | { db: MockDb; result: T }) {
  const task = updateQueue.then(async () => {
    const release = await acquireFileLock()
    try {
      const db = await readDb()
      const before = JSON.stringify(db)
      const { db: nextDb, result } = await fn(db)
      if (JSON.stringify(nextDb) !== before) {
        await writeDb(nextDb)
      }
      return result
    } finally {
      await release()
    }
  })
  updateQueue = task.then(
    () => undefined,
    () => undefined,
  )
  return task
}
