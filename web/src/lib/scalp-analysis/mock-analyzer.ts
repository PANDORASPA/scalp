import { normalizeAnnotations } from './logic'
import type { ScalpAnalysisAnnotations } from './types'

function hashSeed(input: string) {
  let seed = 0
  for (let i = 0; i < input.length; i += 1) {
    seed = (seed * 31 + input.charCodeAt(i)) >>> 0
  }
  return seed
}

function seeded(seed: number) {
  let current = seed || 1
  return () => {
    current = (current * 1664525 + 1013904223) % 4294967296
    return current / 4294967296
  }
}

function point(id: string, rand: () => number) {
  return {
    id,
    x: Math.round(80 + rand() * 240),
    y: Math.round(60 + rand() * 180),
    confidence: Math.round((0.62 + rand() * 0.3) * 100) / 100,
  }
}

function circle(id: string, rand: () => number, severity = false) {
  return {
    id,
    x: Math.round(80 + rand() * 240),
    y: Math.round(60 + rand() * 180),
    radius: Math.round(10 + rand() * 20),
    confidence: Math.round((0.58 + rand() * 0.3) * 100) / 100,
    severity: severity ? Math.max(1, Math.min(5, Math.round(1 + rand() * 4))) : undefined,
  }
}

export async function analyzeScalpImage(imageUrl: string): Promise<ScalpAnalysisAnnotations> {
  const rand = seeded(hashSeed(imageUrl))
  const coarseCount = 12 + Math.round(rand() * 10)
  const babyCount = 2 + Math.round(rand() * 7)
  const emptyCount = 1 + Math.round(rand() * 5)
  const blockageCount = Math.round(rand() * 4)
  const rednessCount = Math.round(rand() * 3)

  const result: ScalpAnalysisAnnotations = {
    coarse_hairs: Array.from({ length: coarseCount }, (_, index) => point(`coarse-${index + 1}`, rand)),
    baby_hairs: Array.from({ length: babyCount }, (_, index) => point(`baby-${index + 1}`, rand)),
    empty_follicles: Array.from({ length: emptyCount }, (_, index) => point(`empty-${index + 1}`, rand)),
    blockages: Array.from({ length: blockageCount }, (_, index) => circle(`blockage-${index + 1}`, rand)),
    redness_regions: Array.from({ length: rednessCount }, (_, index) => circle(`redness-${index + 1}`, rand, true)),
    scores: {
      scalp_empty_ratio: Math.round(28 + rand() * 18),
      redness_score: Math.round(1 + rand() * 4),
      oiliness_score: Math.round(2 + rand() * 4),
      blockage_score: Math.round(1 + rand() * 3),
      density_score: Math.round(52 + rand() * 28),
    },
    notes: 'Mock AI result: 此區域可見幼毛與粗髮混合，建議人工確認標記後再作統計。',
    image_width: 360,
    image_height: 240,
  }

  return normalizeAnnotations(result)
}
