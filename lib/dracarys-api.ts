export const DRACARYS_API_BASE = (process.env.NEXT_PUBLIC_DRACARYS_API_BASE || 'http://localhost:8000/api/v1').replace(/\/$/, '')

export type SimulationStatus = {
  id: string
  status: 'ready' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed' | string
  current_tick: number
  total_events: number
  total_intents: number
  chapters_generated: number
  random_seed: number
  end_reason: string | null
  last_error: string | null
  book_init_revision_id: string
}

export type CreateSimulationInput = {
  bookTitle: string
  prompt: string
  timelineAnchor?: string
  maxTicks?: number
  maxChapters?: number
  chapterIntervalTicks?: number
}

export type SceneMedia = {
  id: string
  task_id: string
  session_id: string
  scene_id: string
  kind: 'image' | 'audio' | string
  uri: string
  mime_type: string
  shot_id?: string | null
  dialogue_line_indexes?: number[]
  metadata?: Record<string, unknown>
  created_at: string
}

export type SceneProjection = {
  status: string
  scene?: {
    scene_id: string
    scene_number: number
    summary: string
    span?: { start_tick: number; end_tick: number; source_event_ids: string[] }
  }
  screenplay?: {
    title?: string
    logline?: string
    narration?: string
    dialogue?: Array<{ character?: string; speaker?: string; text?: string; line?: string }>
    shots?: Array<{ shot_id?: string; description?: string }>
  } | null
  media?: SceneMedia[]
  updated_at?: string
}

export type StreamPayload = {
  event_type: string
  event_id: string
  session_id: string
  scene_id?: string
  scene_number?: number
  summary?: string
  status?: string
  previous_status?: string
  reason?: string
  error?: string | null
  screenplay?: SceneProjection['screenplay']
  media?: SceneMedia
  kind?: string
  task_id?: string
  chapter_number?: number
  ending_tick?: number
  scene_ids?: string[]
  created_at?: string
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${DRACARYS_API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const error = await response.json() as { detail?: unknown }
      if (typeof error.detail === 'string') message = error.detail
    } catch {
      // Keep the HTTP status fallback when the API does not return JSON.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export function createSimulation(input: CreateSimulationInput) {
  return apiJson<SimulationStatus>('/simulations', {
    method: 'POST',
    body: JSON.stringify({
      book_title: input.bookTitle,
      prompt: input.prompt,
      timeline_anchor: input.timelineAnchor || '',
      max_ticks: input.maxTicks || 50,
      max_chapters: input.maxChapters || 5,
      chapter_interval_ticks: input.chapterIntervalTicks || 10,
      ending_condition: 'auto',
    }),
  })
}

export function startSimulation(sessionId: string) {
  return apiJson<SimulationStatus>(`/simulations/${sessionId}/start`, { method: 'POST' })
}

export function stopSimulation(sessionId: string) {
  return apiJson<SimulationStatus>(`/simulations/${sessionId}/stop`, { method: 'POST' })
}

export function getSimulation(sessionId: string) {
  return apiJson<SimulationStatus>(`/simulations/${sessionId}`)
}

export function getScenes(sessionId: string) {
  return apiJson<SceneProjection[]>(`/timeline/${sessionId}/scenes`)
}

export function sceneStreamUrl(sessionId: string) {
  return `${DRACARYS_API_BASE}/simulations/${sessionId}/stream`
}

export function mediaUrl(uri: string) {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  return `${DRACARYS_API_BASE.replace(/\/api\/v1$/, '')}${uri}`
}
