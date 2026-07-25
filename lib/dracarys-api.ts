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
  bookInitRevisionId?: string
  leadCharacterId?: string
  personalityChange?: string
  newCharacterName?: string
  timelineAnchor?: string
  maxTicks?: number
  maxChapters?: number
  chapterIntervalTicks?: number
}

export type BookMarketplaceItem = {
  id: string
  book_id: string | null
  canonical_title: string
  aliases: string[]
  character_names: string[]
  description: string
  quality: 'draft' | 'reviewed' | 'canonical' | string
  created_at: string | null
}

export type BookMarketplaceResponse = { books: BookMarketplaceItem[] }

export type BookInit = {
  id: string
  book_id: string | null
  canonical_title: string
  aliases: string[]
  quality: string
  source_notes: string
  content: {
    id: string
    name: string
    timeline_anchors: Record<string, unknown>
    characters: Array<{ id: string; name: string; profile?: { personality_traits?: string[] } }>
  }
}

export type BookInitializationResponse = { cache_hit: boolean; book_init: BookInit }
export type Publication = { id: string; source_session_id: string; title: string; slug: string; status: string; published_at: string | null }

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
  scene: {
    scene_id: string
    scene_number: number
    summary: string
    span?: { start_tick: number; end_tick: number; source_event_ids: string[] }
  }
  screenplay?: {
    title?: string
    logline?: string
    narration?: string
    dialogue?: Array<{
      speaker_character_id?: string
      speaker_name?: string
      text?: string
      delivery?: string
    }>
    shots?: Array<{ id?: string; description?: string }>
  } | null
  media?: SceneMedia[]
  updated_at?: string
}

export type TimelineScenesResponse = {
  session_id: string
  scenes: SceneProjection[]
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
      book_init_revision_id: input.bookInitRevisionId,
      prompt: input.prompt,
      lead_character_id: input.leadCharacterId || '',
      personality_change: input.personalityChange || '',
      new_character_name: input.newCharacterName || '',
      timeline_anchor: input.timelineAnchor || '',
      max_ticks: input.maxTicks || 50,
      max_chapters: input.maxChapters || 5,
      chapter_interval_ticks: input.chapterIntervalTicks || 10,
      ending_condition: 'auto',
    }),
  })
}

export function listBooks() {
  return apiJson<BookMarketplaceResponse>('/books')
}

export function getBook(bookInitId: string) {
  return apiJson<BookInit>(`/books/${encodeURIComponent(bookInitId)}`)
}

export function initializeBook(title: string) {
  return apiJson<BookInitializationResponse>('/books/initialize', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export function rebuildBook(bookInitId: string) {
  return apiJson<BookInit>(`/books/${encodeURIComponent(bookInitId)}/rebuild`, { method: 'POST' })
}

export function publishSimulation(sessionId: string, title: string) {
  return apiJson<Publication>('/publications', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, title }),
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
  return apiJson<TimelineScenesResponse>(`/timeline/${sessionId}/scenes`)
}

export function sceneStreamUrl(sessionId: string) {
  return `${DRACARYS_API_BASE}/simulations/${sessionId}/stream`
}

export function mediaUrl(uri: string) {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  return `${DRACARYS_API_BASE.replace(/\/api\/v1$/, '')}${uri}`
}
