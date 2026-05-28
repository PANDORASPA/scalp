import 'server-only'

import { getOpenAiVisionEnv, getOpenAiVisionEnvFromSettings } from '@/lib/config/openai'
import { getAppSettings, hasOpenAiApiKey } from '@/lib/settings/repository'

import { normalizeAnnotations } from './logic'
import type { ScalpAnalysisAnnotations } from './types'

const markerPointSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'x', 'y', 'confidence'],
  properties: {
    id: { type: 'string' },
    x: { type: 'number' },
    y: { type: 'number' },
    confidence: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
}

const markerCircleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'x', 'y', 'radius', 'confidence', 'severity'],
  properties: {
    id: { type: 'string' },
    x: { type: 'number' },
    y: { type: 'number' },
    radius: { type: 'number' },
    confidence: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    severity: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
}

const scalpAnalysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'coarse_hairs',
    'baby_hairs',
    'empty_follicles',
    'blockages',
    'redness_regions',
    'scores',
    'notes',
    'image_width',
    'image_height',
  ],
  properties: {
    coarse_hairs: { type: 'array', items: markerPointSchema },
    baby_hairs: { type: 'array', items: markerPointSchema },
    empty_follicles: { type: 'array', items: markerPointSchema },
    blockages: { type: 'array', items: markerCircleSchema },
    redness_regions: { type: 'array', items: markerCircleSchema },
    scores: {
      type: 'object',
      additionalProperties: false,
      required: ['scalp_empty_ratio', 'redness_score', 'oiliness_score', 'blockage_score', 'density_score'],
      properties: {
        scalp_empty_ratio: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        redness_score: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        oiliness_score: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        blockage_score: { anyOf: [{ type: 'number' }, { type: 'null' }] },
        density_score: { anyOf: [{ type: 'number' }, { type: 'null' }] },
      },
    },
    notes: { type: 'string' },
    image_width: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    image_height: { anyOf: [{ type: 'number' }, { type: 'null' }] },
  },
}

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: string
    output?: Array<{
      content?: Array<{
        type?: string
        text?: string
      }>
    }>
  }

  if (typeof response.output_text === 'string') return response.output_text

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text
    }
  }

  throw new Error('OpenAI Vision analysis failed: missing structured output text.')
}

export async function analyzeScalpImageWithOpenAi(imageUrl: string): Promise<ScalpAnalysisAnnotations> {
  const settings = await getAppSettings()
  const env = hasOpenAiApiKey(settings.openAi)
    ? getOpenAiVisionEnvFromSettings(settings.openAi)
    : getOpenAiVisionEnv()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.timeoutMs)

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.model,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text:
                  'You are a scalp magnification image analysis assistant. Return only structured JSON matching the schema. Mark visible coarse hairs, baby/new hairs, empty follicles, blockages, redness regions, oiliness, empty scalp ratio, and density. Coordinates should use the image coordinate space.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text:
                  'Analyze this scalp magnification image for longitudinal hair and scalp tracking. Use conservative confidence values and do not invent markers when visibility is poor.',
              },
              {
                type: 'input_image',
                image_url: imageUrl,
                detail: 'high',
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'scalp_analysis_result',
            strict: true,
            schema: scalpAnalysisSchema,
          },
        },
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI Vision analysis failed: ${res.status} ${text}`)
    }

    const payload = await res.json()
    return normalizeAnnotations(JSON.parse(extractOutputText(payload)))
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`OpenAI Vision analysis failed: timeout after ${env.timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
