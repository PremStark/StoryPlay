export const DRACARYS_API_BASE = (process.env.NEXT_PUBLIC_DRACARYS_API_BASE || 'http://localhost:8000/api/v1').replace(/\/$/, '')

export type SimulationStatus = {
  id: string
  status: 'ready' | 'running' | 'paused' | 'completed' | 'stopped' | 'failed' | string
  current_tick: number
  total_events: number
  total_intents: number
  random_seed: number
  end_reason: string | null
  last_error: string | null
  book_init_revision_id: string
}

export type CreateSimulationInput = {
  bookTitle: string
  prompt: string
  bookInitRevisionId?: string
  branchPlanId?: string
  leadCharacterId?: string
  personalityChange?: string
  newCharacterName?: string
  timelineAnchor?: string
  maxTicks?: number
  maxScenes?: number
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
  chapters?: Array<{
    id: string
    chapter_number: number
    title: string
    summary: string
    character_ids: string[]
    timeline_events?: string[]
  }>
}

export type BookInitializationResponse = { cache_hit: boolean; book_init: BookInit }
export type PublicationManifest = { final_output: FinalOutputBundle }
export type Publication = {
  id: string
  source_session_id: string
  title: string
  slug: string
  status: string
  published_at: string | null
  manifest?: PublicationManifest | null
}

/**
 * PDF ingestion is deliberately separate from a simulation.  A BookInit is
 * immutable and shared; a branch plan and its resulting session are private
 * to the person making the alternate-universe change.
 */
export type BookPdfUploadResponse = {
  id: string
  title: string
  book_init_id?: string | null
  status: 'queued' | 'extracting' | 'indexing' | 'analyzing' | 'persisting' | 'completed' | 'failed' | string
  stage: string
  error?: string | null
}

export type BookIngestionStatus = {
  id: string
  title: string
  book_init_id?: string | null
  status: 'queued' | 'extracting' | 'indexing' | 'analyzing' | 'persisting' | 'completed' | 'failed' | string
  stage: string
  error?: string | null
}

export type TimelineAnchor = {
  id: string
  chapter_number?: number | null
  chapter_title?: string | null
  summary: string
  character_ids?: string[]
  character_names?: string[]
  source_excerpt?: string | null
}

export type TimelineChapterPreview = {
  chapter_number: number
  title?: string | null
  summary: string
  characters?: Array<{ id: string; name: string }> | string[]
  anchors: TimelineAnchor[]
}

export type BranchCharacterInput = {
  name: string
  persona: string
  location: string
  interaction_notes: string
}

export type BranchPlanInput = {
  book_init_revision_id: string
  timeline_change?: {
    canon_scenario: string
    requested_change: string
    timeline_hint?: string
    timeline_id?: string
  }
  character_additions?: Array<{
    name: string
    persona: string
    location_description: string
    interaction_guidance: string
  }>
  character_modifications?: Array<{
    character_reference: string
    requested_change: string
    timeline_id?: string
  }>
}

export type BranchPlan = {
  id: string
  book_init_revision_id: string
  status: 'awaiting_timeline_selection' | 'awaiting_confirmation' | 'confirmed' | 'rejected' | 'applied' | string
  timeline_candidates: Array<{
    id: string
    chapter_number: number
    title: string
    summary: string
    character_ids: string[]
    match_reason?: string
  }>
  selected_timeline_id?: string | null
  selected_chapter_number?: number | null
  verification_summary: string
  warnings?: string[]
  character_dispositions?: Array<{
    character_reference: string
    outcome: 'ready' | 'ignored_not_present' | 'needs_timeline_selection' | 'unknown_character' | string
    message: string
  }>
  confirmation_token: string
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

export type ScenePlaybackManifest = {
  session_id: string
  segments: Array<{ scene_id: string; scene_number: number; image_uri: string | null; audio_uri: string | null; narration: string }>
}

export type FinalOutputBundle = {
  session_id: string
  combined_screenplay: string
  images: Array<{ scene_id: string; scene_number: number; shot_id?: string | null; uri: string; mime_type: string }>
  playback: ScenePlaybackManifest
  incomplete_scene_ids: string[]
  generated_at: string
}

export type VideoRenderJob = {
  id: string
  session_id: string
  status: 'queued' | 'running' | 'completed' | 'unavailable' | 'failed' | string
  output_uri?: string | null
  mime_type?: string | null
  error?: string | null
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
      if (error.detail && typeof error.detail === 'object' && 'message' in error.detail) {
        const detail = error.detail as { message?: unknown }
        if (typeof detail.message === 'string') message = detail.message
      }
    } catch {
      // Keep the HTTP status fallback when the API does not return JSON.
    }
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

async function apiForm<T>(path: string, form: FormData): Promise<T> {
  const response = await fetch(`${DRACARYS_API_BASE}${path}`, { method: 'POST', body: form })
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`
    try {
      const error = await response.json() as { detail?: unknown }
      if (typeof error.detail === 'string') message = error.detail
      if (error.detail && typeof error.detail === 'object' && 'message' in error.detail) {
        const detail = error.detail as { message?: unknown }
        if (typeof detail.message === 'string') message = detail.message
      }
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
      branch_plan_id: input.branchPlanId,
      prompt: input.prompt,
      lead_character_id: input.leadCharacterId || '',
      personality_change: input.personalityChange || '',
      new_character_name: input.newCharacterName || '',
      timeline_anchor: input.timelineAnchor || '',
      max_ticks: input.maxTicks ?? 50,
      max_scenes: input.maxScenes,
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

export function uploadBookPdf(file: File, title?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('title', title?.trim() || file.name.replace(/\.pdf$/i, '') || 'Untitled book')
  return apiForm<BookPdfUploadResponse>('/books/upload', form)
}

export function getBookIngestion(jobId: string) {
  return apiJson<BookIngestionStatus>(`/books/ingestions/${encodeURIComponent(jobId)}`)
}

export function createBranchPlan(input: BranchPlanInput) {
  return apiJson<BranchPlan>('/simulations/branch-plans', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function confirmBranchPlan(planId: string, confirmationToken: string, selectedTimelineId?: string | null) {
  return apiJson<BranchPlan>(`/simulations/branch-plans/${encodeURIComponent(planId)}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ confirmation_token: confirmationToken, selected_timeline_id: selectedTimelineId || undefined, confirm: true }),
  })
}

export function publishSimulation(sessionId: string, title: string) {
  return apiJson<Publication>('/publications', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, title }),
  })
}

export function listPublications() {
  return apiJson<Publication[]>('/publications')
}

export function getPublication(publicationIdOrSlug: string) {
  return apiJson<Publication>(`/publications/${encodeURIComponent(publicationIdOrSlug)}`)
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

export function getScenePlayback(sessionId: string) {
  return apiJson<ScenePlaybackManifest>(`/timeline/${sessionId}/playback`)
}

export function getFinalOutput(sessionId: string) {
  return apiJson<FinalOutputBundle>(`/final-outputs/sessions/${sessionId}`)
}

export function renderFinalVideo(sessionId: string) {
  return apiJson<VideoRenderJob>(`/final-outputs/sessions/${sessionId}/video`, { method: 'POST' })
}

export function getFinalVideoJob(jobId: string) {
  return apiJson<VideoRenderJob>(`/final-outputs/video-jobs/${jobId}`)
}

export function sceneStreamUrl(sessionId: string) {
  return `${DRACARYS_API_BASE}/simulations/${sessionId}/stream`
}

export function mediaUrl(uri: string) {
  if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
  return `${DRACARYS_API_BASE.replace(/\/api\/v1$/, '')}${uri}`
}
