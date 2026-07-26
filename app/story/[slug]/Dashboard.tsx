'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createSimulation,
  getFinalOutput,
  getFinalVideoJob,
  getScenePlayback,
  getScenes,
  getSimulation,
  mediaUrl,
  publishSimulation,
  renderFinalVideo,
  sceneStreamUrl,
  startSimulation,
  stopSimulation,
  type SceneMedia,
  type ScenePlaybackManifest,
  type SceneProjection,
  type SimulationStatus,
  type StreamPayload,
  type FinalOutputBundle,
  type Publication,
  type VideoRenderJob,
} from '../../../lib/dracarys-api'

type EventKind = 'world' | 'thought' | 'decision' | 'relationship' | 'effect'

type SimulationEvent = {
  id: string
  kind: EventKind
  actor?: string
  target?: string
  title: string
  text: string
  line?: string
  affected: string[]
}

const worldEffects = [
  'Political stability decreases',
  'A secret alliance begins to strain',
  'Trust shifts between old friends',
  'A new conflict takes root',
]

const thoughts = [
  'If the world remembers the old path, I need to move before it does.',
  'Someone else noticed the change. That means this is bigger than me.',
  'The safest choice is probably the one history expects from me.',
  'One strange detail can become a completely different future.',
]

function uniqueNames(names: readonly string[]) {
  return Array.from(new Set(names.filter(Boolean)))
}

function eventLabel(kind: EventKind) {
  if (kind === 'thought') return 'CHARACTER THINKING'
  if (kind === 'decision') return 'DECISION MADE'
  if (kind === 'relationship') return 'RELATIONSHIP UPDATED'
  if (kind === 'effect') return 'WORLD CONSEQUENCE'
  return 'TIMELINE EVENT'
}

function eventMarker(kind: EventKind) {
  if (kind === 'thought') return 'o'
  if (kind === 'decision') return '>'
  if (kind === 'relationship') return '+'
  if (kind === 'effect') return '!'
  return '*'
}

function firstDialogue(payload: StreamPayload) {
  const dialogue = payload.screenplay?.dialogue?.[0]
  if (!dialogue) return null
  return {
    actor: dialogue.speaker_name || dialogue.speaker_character_id || 'Narrator',
    line: dialogue.text || '',
  }
}

function mergeMedia(current: SceneMedia[], incoming: SceneMedia[]) {
  const byId = new Map(current.map((media) => [media.id, media]))
  for (const media of incoming) byId.set(media.id, media)
  return [...byId.values()]
}

function mergeScenes(current: SceneProjection[], incoming: SceneProjection[]) {
  const merged = new Map(current.map((scene) => [scene.scene.scene_id, scene]))
  for (const scene of incoming) merged.set(scene.scene.scene_id, scene)
  return [...merged.values()].sort((left, right) => left.scene.scene_number - right.scene.scene_number)
}

function sceneStatusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function isScenePending(status: string) {
  return !['ready_for_frontend', 'published', 'failed', 'cancelled'].includes(status)
}

function streamPayloadToEvent(payload: StreamPayload, fallbackCharacters: readonly string[]): SimulationEvent {
  const affected = uniqueNames(fallbackCharacters.slice(0, 4))

  if (payload.event_type === 'scene.ready') {
    return {
      id: payload.event_id,
      kind: 'world',
      actor: 'Showrunner',
      title: `Scene ${payload.scene_number || ''} committed`.trim(),
      text: payload.summary || 'The Showrunner committed a scene after resolving actions and state changes.',
      affected,
    }
  }

  if (payload.event_type === 'scene.screenplay_ready') {
    const dialogue = firstDialogue(payload)
    return {
      id: payload.event_id,
      kind: 'decision',
      actor: dialogue?.actor || 'Editor',
      title: payload.screenplay?.title || 'Screenplay ready',
      text: payload.screenplay?.logline || payload.screenplay?.narration || 'The editor translated world events into a playable scene.',
      line: dialogue?.line,
      affected,
    }
  }

  if (payload.event_type === 'scene.status_changed') {
    return {
      id: payload.event_id,
      kind: payload.status === 'failed' ? 'effect' : 'thought',
      actor: 'Scene Worker',
      title: `Scene ${payload.status?.replaceAll('_', ' ') || 'updated'}`,
      text: payload.error || payload.reason || `Scene moved from ${payload.previous_status || 'unknown'} to ${payload.status || 'unknown'}.`,
      affected,
    }
  }

  if (payload.event_type === 'media.task_requested') {
    return {
      id: payload.event_id,
      kind: 'thought',
      actor: 'Media Worker',
      title: `${payload.kind || 'Media'} task queued`,
      text: 'A scene output slot has been sent to the media pipeline.',
      affected,
    }
  }

  if (payload.event_type === 'media.task_status') {
    return {
      id: payload.event_id,
      kind: payload.status === 'failed' ? 'effect' : 'relationship',
      actor: 'Media Worker',
      title: `${payload.kind || payload.media?.kind || 'Media'} ${payload.status || 'updated'}`,
      text: payload.error || (payload.media?.uri ? 'Generated media is ready for the scene.' : 'A media task changed status.'),
      affected,
    }
  }

  return {
    id: payload.event_id,
    kind: 'world',
    actor: 'World Engine',
    title: payload.event_type.replaceAll('.', ' '),
    text: payload.reason || 'A backend simulation event arrived.',
    affected,
  }
}

export default function Dashboard({
  worldName,
  bookInitRevisionId,
  theme,
  leadCharacter,
  leadCharacterId,
  characters,
  outcome,
  personalityPrompt,
  newCharacter,
  branchPlanId,
  initialSession,
  maxScenes,
}: {
  worldName: string
  bookInitRevisionId: string
  theme: string
  leadCharacter: string
  leadCharacterId: string
  characters: readonly string[]
  outcome: string
  personalityPrompt: string
  newCharacter: string
  /** A user-confirmed Pydantic branch plan to apply to this run. */
  branchPlanId?: string
  /** A verified branch plan already created this session. */
  initialSession?: SimulationStatus
  maxScenes?: number
}) {
  const [active, setActive] = useState(true)
  const [voiceOn, setVoiceOn] = useState(false)
  const [events, setEvents] = useState<SimulationEvent[]>([])
  const [tick, setTick] = useState(1)
  const [thinking, setThinking] = useState<string | null>(leadCharacter)
  const [selectedEvent, setSelectedEvent] = useState<SimulationEvent | null>(null)
  const [seeded, setSeeded] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [session, setSession] = useState<SimulationStatus | null>(null)
  const [connectionNote, setConnectionNote] = useState('Preparing backend session...')
  const [stats, setStats] = useState({ events: 0, updated: 0, relationships: 0, memories: 0 })
  const [scenes, setScenes] = useState<SceneProjection[]>([])
  const [playback, setPlayback] = useState<ScenePlaybackManifest | null>(null)
  const [finalOutput, setFinalOutput] = useState<FinalOutputBundle | null>(null)
  const [videoJob, setVideoJob] = useState<VideoRenderJob | null>(null)
  const [assemblingVideo, setAssemblingVideo] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState(0)
  const [storyPlaybackActive, setStoryPlaybackActive] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publication, setPublication] = useState<Publication | null>(null)
  const generatedTick = useRef(1)
  const seenStreamEvents = useRef(new Set<string>())
  const directive = outcome || `Explore what changes when ${leadCharacter} chooses a different path.`
  const currentDialogue = [...events].reverse().find((event) => event.line)

  useEffect(() => {
    let cancelled = false
    let stream: EventSource | null = null

    async function bootBackendSession() {
      try {
        // A confirmed branch plan owns the session and its state patch. The
        // legacy direct-create route remains as a backwards-compatible path
        // for older BookInit records.
        const prepared = initialSession || await (async () => {
          const promptParts = [directive, `Lead character: ${leadCharacter}.`]
          if (personalityPrompt.trim()) promptParts.push(`Personality change: ${personalityPrompt.trim()}`)
          if (newCharacter.trim()) promptParts.push(`Introduce this new character: ${newCharacter.trim()}`)
          return createSimulation({
            bookTitle: worldName,
            bookInitRevisionId,
            branchPlanId,
            prompt: promptParts.join(' '),
            leadCharacterId,
            personalityChange: personalityPrompt,
            newCharacterName: newCharacter,
            maxTicks: 500,
            maxScenes,
          })
        })()

        if (cancelled) return
        setSession(prepared)
        setTick(prepared.current_tick)
        setStats({ events: prepared.total_events, updated: prepared.total_intents, relationships: 0, memories: 0 })
        setEvents([
          {
            id: `${prepared.id}-ready`,
            kind: 'world',
            actor: 'Orchestrator',
            title: 'Simulation prepared',
            text: `Session ${prepared.id} is ready. Seed ${prepared.random_seed} will reproduce this run.`,
            affected: uniqueNames(characters.slice(0, 3)),
          },
        ])
        setConnectionNote('Connected to Dracarys backend. Listening for scene events.')
        setSeeded(true)

        stream = new EventSource(sceneStreamUrl(prepared.id))
        const handleStreamMessage = (message: MessageEvent<string>) => {
          const payload = JSON.parse(message.data) as StreamPayload
          if (seenStreamEvents.current.has(payload.event_id)) return
          seenStreamEvents.current.add(payload.event_id)
          const nextEvent = streamPayloadToEvent(payload, characters)
          setEvents((currentEvents) => [...currentEvents.filter((event) => event.id !== nextEvent.id), nextEvent].slice(-12))
          setStats((current) => ({
            events: current.events + 1,
            updated: current.updated + (payload.event_type.includes('screenplay') || payload.event_type.includes('status') ? 1 : 0),
            relationships: current.relationships,
            memories: current.memories + (payload.event_type.includes('media') ? 1 : 0),
          }))
          if (nextEvent.actor && nextEvent.kind === 'thought') setThinking(nextEvent.actor)
          if (payload.scene_id) {
            setScenes((current) => {
              const known = current.find((scene) => scene.scene.scene_id === payload.scene_id)
              const sceneNumber = payload.scene_number || known?.scene.scene_number || current.length + 1
              const next: SceneProjection = {
                status: payload.status || (payload.event_type === 'scene.screenplay_ready' ? 'screenplay_ready' : known?.status || 'detected'),
                scene: known?.scene || { scene_id: payload.scene_id!, scene_number: sceneNumber, summary: payload.summary || 'A new scene is being produced.' },
                screenplay: payload.screenplay || known?.screenplay || null,
                media: payload.media ? mergeMedia(known?.media || [], [payload.media as SceneMedia]) : known?.media || [],
                updated_at: payload.created_at || known?.updated_at,
              }
              return mergeScenes(current.filter((scene) => scene.scene.scene_id !== payload.scene_id), [next])
            })
          }
        }

        const streamEvents = ['scene.ready', 'scene.status_changed', 'scene.screenplay_ready', 'media.task_requested', 'media.task_status']
        streamEvents.forEach((eventName) => stream?.addEventListener(eventName, handleStreamMessage as EventListener))
        stream.onerror = () => setConnectionNote('Stream disconnected. Browser will retry; REST status keeps reconciling.')

        const running = await startSimulation(prepared.id)
        if (!cancelled) {
          setSession(running)
          setActive(!['completed', 'stopped', 'failed'].includes(running.status))
        }
      } catch (error) {
        if (cancelled) return
        setOfflineMode(true)
        setSeeded(true)
        setConnectionNote(`Backend unavailable, showing local demo stream. ${error instanceof Error ? error.message : ''}`.trim())
        setEvents([
          {
            id: 'offline-ready',
            kind: 'world',
            actor: 'Local Demo',
            title: 'Backend connection not available',
            text: 'Start the Dracarys API on localhost:8000 to receive live sessions and SSE scene events.',
            affected: uniqueNames(characters.slice(0, 3)),
          },
        ])
      }
    }

    bootBackendSession()

    return () => {
      cancelled = true
      stream?.close()
    }
  }, [bookInitRevisionId, branchPlanId, characters, directive, initialSession, leadCharacter, leadCharacterId, maxScenes, newCharacter, personalityPrompt, worldName])

  useEffect(() => {
    if (!session?.id || offlineMode) return
    const sessionId = session.id

    async function reconcileScenes() {
      try {
        const snapshot = await getScenes(sessionId)
        setScenes(snapshot.scenes)
      } catch {
        // SSE is the primary live path; a missed REST reconciliation should
        // not mark the full simulation as disconnected.
      }
    }

    async function reconcilePlayback() {
      try {
        setPlayback(await getScenePlayback(sessionId))
      } catch {
        // Playback is an optional final-output projection. Scene cards remain
        // available even while a backend is still generating it.
      }
    }

    async function reconcileFinalOutput() {
      try {
        const output = await getFinalOutput(sessionId)
        setFinalOutput(output)
        if (videoJob && ['queued', 'running'].includes(videoJob.status)) {
          setVideoJob(await getFinalVideoJob(videoJob.id))
        }
      } catch {
        // Final outputs are only complete after the run is terminal; scene
        // cards still provide useful incremental progress in the meantime.
      }
    }

    void reconcileScenes()
    void reconcilePlayback()
    void reconcileFinalOutput()
    const interval = window.setInterval(async () => {
      try {
        const [status] = await Promise.all([getSimulation(sessionId), reconcileScenes(), reconcilePlayback(), reconcileFinalOutput()])
        setSession(status)
        setTick(status.current_tick)
        setStats((current) => ({
          events: Math.max(current.events, status.total_events),
          updated: Math.max(current.updated, status.total_intents),
          relationships: current.relationships,
          memories: current.memories,
        }))
        setActive(!['completed', 'stopped', 'failed'].includes(status.status))
      } catch {
        setConnectionNote('Unable to refresh session status. Stream may still reconnect.')
      }
    }, 3000)

    return () => window.clearInterval(interval)
  }, [offlineMode, session?.id, videoJob])

  useEffect(() => {
    if (!active || !seeded || !offlineMode) return
    const interval = window.setInterval(() => setTick((currentTick) => currentTick + 1), 2000)

    return () => window.clearInterval(interval)
  }, [active, offlineMode, seeded])

  useEffect(() => {
    if (!offlineMode || !seeded || tick <= 1 || generatedTick.current === tick) return

    generatedTick.current = tick
    const actor = characters[(tick - 1) % characters.length] || leadCharacter
    const target = characters[tick % characters.length] || leadCharacter
    const phase = tick % 4
    const event: SimulationEvent =
      phase === 1
        ? {
            id: `offline-${tick}`,
            kind: 'thought',
            actor,
            title: `${actor} starts thinking`,
            text: `New information changes what ${actor} believes is possible.`,
            line: thoughts[tick % thoughts.length],
            affected: [actor],
          }
        : phase === 2
          ? {
              id: `offline-${tick}`,
              kind: 'decision',
              actor,
              title: `${actor} commits to a new course`,
              text: actor === leadCharacter && personalityPrompt ? personalityPrompt : `${actor} acts before the original timeline can reassert itself.`,
              line: actor === leadCharacter && personalityPrompt ? personalityPrompt : 'I cannot wait for the old ending to happen again.',
              affected: uniqueNames([actor, leadCharacter]),
            }
          : phase === 3
            ? {
                id: `offline-${tick}`,
                kind: 'relationship',
                actor,
                target,
                title: `${actor} confronts ${target}`,
                text: `${target} updates their trust in ${actor}. A private belief becomes a visible relationship change.`,
                line: `${target}, you need to know what changed.`,
                affected: uniqueNames([actor, target]),
              }
            : {
                id: `offline-${tick}`,
                kind: 'effect',
                actor: 'World Engine',
                title: worldEffects[(tick / 4) % worldEffects.length],
                text: 'The consequence spreads to nearby characters and creates the next cause.',
                affected: uniqueNames(characters.slice(0, 4)),
              }

    setThinking(phase === 1 ? actor : null)
    setEvents((currentEvents) => [...currentEvents.filter((item) => item.id !== event.id), event].slice(-12))
    setStats((current) => ({
      events: current.events + 1,
      updated: current.updated + (phase === 2 || phase === 3 ? 1 : 0),
      relationships: current.relationships + (phase === 3 ? 1 : 0),
      memories: current.memories + 2,
    }))
  }, [characters, leadCharacter, offlineMode, personalityPrompt, seeded, tick])

  useEffect(() => {
    if (!voiceOn || !active || !currentDialogue?.line || typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${currentDialogue.actor || 'World'} says. ${currentDialogue.line}`)
    utterance.rate = 0.92
    utterance.pitch = currentDialogue.kind === 'thought' ? 0.85 : 1
    window.speechSynthesis.speak(utterance)

    return () => window.speechSynthesis.cancel()
  }, [active, currentDialogue?.actor, currentDialogue?.id, currentDialogue?.kind, currentDialogue?.line, voiceOn])

  async function handleStopSimulation() {
    if (session?.id && !offlineMode) {
      try {
        const stopped = await stopSimulation(session.id)
        setSession(stopped)
        setActive(false)
        setConnectionNote('Simulation stopped. Waiting for any already-queued scenes to finish.')
      } catch {
        // Navigating away is still the intended user action.
      }
    }
  }

  async function handlePublishSimulation() {
    if (!canPublish || publishing) return
    setPublishing(true)
    try {
      const publication = await publishSimulation(session.id, `${worldName}: ${directive.slice(0, 72)}`)
      setPublication(publication)
      setConnectionNote(`Published to the marketplace as “${publication.title}”.`)
    } catch (error) {
      setConnectionNote(`Could not publish this run. ${error instanceof Error ? error.message : ''}`.trim())
    } finally {
      setPublishing(false)
    }
  }

  function downloadCombinedScreenplay() {
    if (!finalOutput || typeof window === 'undefined') return
    const blob = new Blob([finalOutput.combined_screenplay], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${worldName.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase() || 'story'}-screenplay.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleRenderVideo() {
    if (!session?.id || assemblingVideo || !isSimulationTerminal || pendingSceneCount > 0) return
    setAssemblingVideo(true)
    try {
      const job = await renderFinalVideo(session.id)
      setVideoJob(job)
      setConnectionNote('Video assembly started. Your scene playback remains available while it renders.')
    } catch (error) {
      setConnectionNote(`Could not assemble the video. ${error instanceof Error ? error.message : ''}`.trim())
    } finally {
      setAssemblingVideo(false)
    }
  }

  const playbackSegments = playback?.segments || []
  const activePlaybackSegment = playbackSegments[playbackIndex] || null

  function advanceStoryPlayback() {
    if (!playbackSegments.length) return
    if (playbackIndex >= playbackSegments.length - 1) {
      setStoryPlaybackActive(false)
      return
    }
    setPlaybackIndex((current) => current + 1)
  }

  const agents = useMemo(
    () =>
      characters.slice(0, 4).map((name, index) => ({
        name,
        state: thinking === name ? 'Thinking...' : index === tick % Math.max(characters.length, 1) ? 'Making a move' : 'Observing',
        tone: ['violet', 'amber', 'blue', 'rose'][index],
      })),
    [characters, thinking, tick],
  )
  const pendingSceneCount = scenes.filter((scene) => isScenePending(scene.status)).length
  const readySceneCount = scenes.filter((scene) => ['ready_for_frontend', 'published'].includes(scene.status)).length
  const failedSceneCount = scenes.filter((scene) => scene.status === 'failed').length
  const isSimulationTerminal = !!session && ['completed', 'stopped'].includes(session.status)
  const incompleteFinalSceneCount = finalOutput?.incomplete_scene_ids.length || 0
  const canPublish = !!session && !offlineMode && isSimulationTerminal && pendingSceneCount === 0 && failedSceneCount === 0 && incompleteFinalSceneCount === 0
  const publishDisabledReason = !session ? 'Waiting for the simulation session.' : offlineMode ? 'Publishing requires the backend connection.' : !isSimulationTerminal ? 'Finish or stop the simulation before publishing.' : failedSceneCount > 0 ? `${failedSceneCount} scene asset ${failedSceneCount === 1 ? 'failed' : 'failed'}; resolve that failure before retrying publication.` : pendingSceneCount > 0 ? `Waiting for ${pendingSceneCount} scene ${pendingSceneCount === 1 ? 'job' : 'jobs'} to finish.` : incompleteFinalSceneCount > 0 ? `Waiting for image and narration from ${incompleteFinalSceneCount} completed scene ${incompleteFinalSceneCount === 1 ? 'job' : 'jobs'}.` : ''

  return (
    <main className={`world-shell world-theme-${theme}`}>
      <div className="world-noise" />
      <header className="world-header">
        <div className="world-brand">
          <span>*</span>
          <div>
            <p>PERSONA / WORLD SIMULATION</p>
            <h1>{worldName}</h1>
          </div>
        </div>
        <div className="world-actions">
          <span className={`world-status ${active ? '' : 'paused'}`}><i /> {active ? 'SIMULATION RUNNING' : 'SIMULATION PAUSED'} - TICK {tick}</span>
          <button onClick={() => setVoiceOn(!voiceOn)}>{voiceOn ? 'Voice On' : 'Voice Off'}</button>
          <button onClick={handlePublishSimulation} disabled={!canPublish || publishing} title={publishDisabledReason}>{publishing ? 'Publishing…' : 'Publish version'}</button>
          <button onClick={handleStopSimulation} className="stop-simulation">Stop simulation</button>
        </div>
      </header>

      <section className="simulation-stats">
        <div><small>EVENTS SIMULATED</small><strong>{stats.events}</strong></div>
        <div><small>INTENTS UPDATED</small><strong>{stats.updated}</strong></div>
        <div><small>SCENES READY</small><strong>{readySceneCount} / {scenes.length}</strong></div>
        <div><small>SCENES IN FLIGHT</small><strong>{pendingSceneCount}</strong></div>
      </section>

      <div className="world-layout">
        <aside className="agent-rail">
          <p className="sim-eyebrow">ACTIVE AGENTS</p>
          {agents.map((agent) => (
            <motion.article layout key={agent.name} className={`world-agent ${agent.tone} ${thinking === agent.name ? 'thinking' : ''}`}>
              <span>{agent.name.charAt(0)}</span>
              <div>
                <h3>{agent.name}</h3>
                <p>{agent.state}</p>
              </div>
              <i />
            </motion.article>
          ))}
          <section className="directive-card">
            <small>THE TIMELINE FORK</small>
            <p>{directive}</p>
          </section>
          <section className="voice-card">
            <small>BACKEND SESSION</small>
            <h3>{session?.id || (offlineMode ? 'Local fallback' : 'Connecting...')}</h3>
            <p>{connectionNote}</p>
          </section>
          <section className="voice-card">
            <small>CHARACTER AUDIO</small>
            <h3>{currentDialogue?.actor || 'No speaker yet'}</h3>
            <p>{currentDialogue?.line || 'Dialogue appears here when screenplay or character events arrive.'}</p>
          </section>
          <section className="voice-card output-status">
            <small>FINAL OUTPUTS</small>
            <h3>{readySceneCount === scenes.length && scenes.length > 0 ? 'Scene set complete' : 'Assembling scene outputs'}</h3>
            <p>{playback?.segments.length || 0} playable scene {playback?.segments.length === 1 ? 'segment' : 'segments'} · {pendingSceneCount ? `${pendingSceneCount} still rendering` : 'all queued scene work resolved'}</p>
            {!canPublish && <em>{publishDisabledReason}</em>}
            {publication && <Link className="published-story-link" href={`/story/published/${encodeURIComponent(publication.slug)}`}>View published story →</Link>}
            {isSimulationTerminal && finalOutput && <div className="final-output-actions">
              <button type="button" onClick={downloadCombinedScreenplay} disabled={!finalOutput.combined_screenplay}>Download screenplay</button>
              <button type="button" onClick={() => { setPlaybackIndex(0); setStoryPlaybackActive(true) }} disabled={!playbackSegments.length}>Play combined story</button>
              <button type="button" onClick={handleRenderVideo} disabled={assemblingVideo || pendingSceneCount > 0 || incompleteFinalSceneCount > 0 || videoJob?.status === 'running' || videoJob?.status === 'queued'}>{assemblingVideo || videoJob?.status === 'running' || videoJob?.status === 'queued' ? 'Assembling video…' : 'Assemble video'}</button>
              {videoJob?.status === 'completed' && videoJob.output_uri && <a href={mediaUrl(videoJob.output_uri)} download>Download video</a>}
              {videoJob?.status === 'unavailable' && <em>{videoJob.error || 'Video is unavailable in this environment; use scene playback.'}</em>}
              {videoJob?.status === 'failed' && <em>{videoJob.error || 'Video assembly failed.'}</em>}
            </div>}
            {isSimulationTerminal && activePlaybackSegment && <section className="combined-story-player" aria-label="Combined scene playback">
              <div className="combined-story-head"><b>COMBINED STORY PLAYBACK</b><span>Scene {activePlaybackSegment.scene_number} / {playbackSegments.length}</span></div>
              {/* Artifact hosts vary by deployment; do not force a static Next image host allowlist. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {activePlaybackSegment.image_uri ? <img src={mediaUrl(activePlaybackSegment.image_uri)} alt={`Combined playback scene ${activePlaybackSegment.scene_number}`} /> : <div className="combined-story-empty">This scene is waiting for its comic panel.</div>}
              <p>{activePlaybackSegment.narration || 'Scene narration is preparing.'}</p>
              {activePlaybackSegment.audio_uri ? <audio key={activePlaybackSegment.scene_id} controls autoPlay={storyPlaybackActive} src={mediaUrl(activePlaybackSegment.audio_uri)} onEnded={advanceStoryPlayback}>Combined scene narration.</audio> : <button type="button" onClick={advanceStoryPlayback}>Next scene</button>}
              <div className="combined-story-controls"><button type="button" onClick={() => setPlaybackIndex((current) => Math.max(0, current - 1))} disabled={playbackIndex === 0}>Previous</button><button type="button" onClick={advanceStoryPlayback}>{playbackIndex === playbackSegments.length - 1 ? 'Finish' : 'Next scene'}</button></div>
            </section>}
            {isSimulationTerminal && finalOutput && <div className="final-image-bundle"><b>IMAGE BUNDLE · {finalOutput.images.length} PANELS</b>{finalOutput.images.length ? <div>{finalOutput.images.map((image, index) => <a key={`${image.scene_id}-${image.shot_id || index}`} href={mediaUrl(image.uri)} download>Scene {String(image.scene_number).padStart(2, '0')} panel {index + 1}</a>)}</div> : <span>No generated panels are available yet.</span>}</div>}
          </section>
        </aside>

        <section className="timeline-stage">
          <div className="timeline-heading">
            <div>
              <p className="sim-eyebrow">LIVING TIMELINE</p>
              <h2>Alternate history in motion</h2>
            </div>
            <span>{events.length} causal events</span>
          </div>

          <div className="timeline">
            <AnimatePresence initial={false}>
              {events.map((event, eventIndex) => (
                <motion.article
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  key={`${event.id}-${eventIndex}`}
                  className={`timeline-event ${event.kind}`}
                  onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)}
                >
                  <div className="event-marker">{eventMarker(event.kind)}</div>
                  <div className="event-card">
                    <small>{eventLabel(event.kind)}</small>
                    <h3>{event.title}</h3>
                    <p>{event.text}</p>
                    {event.line && <blockquote>{event.actor}: {event.line}</blockquote>}
                    <div className="affected">
                      {uniqueNames(event.affected).map((name) => <span key={`${event.id}-${name}`}>{name.charAt(0)}</span>)}
                      <em>{event.affected.length} affected</em>
                    </div>
                    {selectedEvent?.id === event.id && (
                      <motion.div className="butterfly-effect" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                        <b>CAUSE - EFFECT</b>
                        <div><span>{event.actor || 'World'}</span><i /> <span>{event.target || 'Scene pipeline'}</span><i /> <span>Frontend update</span></div>
                      </motion.div>
                    )}
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
            {thinking && (
              <motion.div className="thinking-signal" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <i /><span>{thinking} is weighing their options</span><b><u /> <u /> <u /></b>
              </motion.div>
            )}
          </div>
          <section className="scene-gallery" aria-label="Scene-by-scene generated outputs">
            <div className="scene-gallery-heading"><div><p className="sim-eyebrow">SCENE OUTPUTS</p><h2>Panels arriving live</h2></div><span>{readySceneCount} complete · {pendingSceneCount} processing</span></div>
            {scenes.length === 0 ? <p className="timeline-empty">The Showrunner will add each scene here after it commits the resolved state update. Each scene is rendered independently.</p> : <div className="scene-grid">{scenes.map((scene) => {
              const image = scene.media?.find((media) => media.kind === 'image')
              const audio = scene.media?.find((media) => media.kind === 'audio')
              const playbackSegment = playback?.segments.find((segment) => segment.scene_id === scene.scene.scene_id)
              return <article className={`scene-output ${isScenePending(scene.status) ? 'is-pending' : 'is-ready'}`} key={scene.scene.scene_id}>
                <div className="scene-output-head"><span>SCENE {String(scene.scene.scene_number).padStart(2, '0')}</span><b>{sceneStatusLabel(scene.status)}</b></div>
                <h3>{scene.screenplay?.title || scene.scene.summary}</h3>
                <p>{scene.screenplay?.logline || scene.screenplay?.narration || scene.scene.summary}</p>
                {image ? <div className="scene-image-wrap">
                  {/* Artifact hosts vary by deployment; do not force a static Next image host allowlist. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mediaUrl(image.uri)} alt={`Generated comic panel for scene ${scene.scene.scene_number}`} />
                </div> : <div className="scene-placeholder"><i /> Comic panel rendering</div>}
                {audio ? <audio controls preload="metadata" src={mediaUrl(audio.uri)}>Generated scene narration.</audio> : <div className="scene-audio-pending">Narration {scene.status === 'failed' ? 'unavailable' : 'will be added when ready'}</div>}
                <div className="scene-downloads">{image && <a href={mediaUrl(image.uri)} download>Download panel</a>}{audio && <a href={mediaUrl(audio.uri)} download>Download audio</a>}{playbackSegment && <span>Included in playback</span>}</div>
              </article>
            })}</div>}
          </section>
        </section>
      </div>
    </main>
  )
}
