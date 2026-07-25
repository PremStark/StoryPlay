'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createSimulation,
  getScenes,
  getSimulation,
  mediaUrl,
  publishSimulation,
  sceneStreamUrl,
  startSimulation,
  stopSimulation,
  type SceneMedia,
  type SimulationStatus,
  type StreamPayload,
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

function streamPayloadToEvent(payload: StreamPayload, fallbackCharacters: readonly string[]): SimulationEvent {
  const affected = uniqueNames(fallbackCharacters.slice(0, 4))

  if (payload.event_type === 'scene.detected') {
    return {
      id: payload.event_id,
      kind: 'world',
      actor: 'Showrunner',
      title: `Scene ${payload.scene_number || ''} detected`.trim(),
      text: payload.summary || 'A causal cluster became important enough to become a scene.',
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

  if (payload.event_type === 'chapter.completed') {
    return {
      id: payload.event_id,
      kind: 'effect',
      actor: 'Editor',
      title: `Chapter ${payload.chapter_number || ''} completed`.trim(),
      text: `Chapter sealed at tick ${payload.ending_tick || 'unknown'} with ${payload.scene_ids?.length || 0} scenes.`,
      affected,
    }
  }

  if (payload.event_type === 'chapter.boundary_detected') {
    return {
      id: payload.event_id,
      kind: 'world',
      actor: 'Showrunner',
      title: `Chapter ${payload.chapter_number || ''} boundary`.trim(),
      text: 'The simulation found a chapter boundary. More scene work may still arrive.',
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
}) {
  const router = useRouter()
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
  const [sceneMedia, setSceneMedia] = useState<SceneMedia[]>([])
  const [publishing, setPublishing] = useState(false)
  const generatedTick = useRef(1)
  const seenStreamEvents = useRef(new Set<string>())
  const directive = outcome || `Explore what changes when ${leadCharacter} chooses a different path.`
  const currentDialogue = [...events].reverse().find((event) => event.line)

  useEffect(() => {
    let cancelled = false
    let stream: EventSource | null = null

    async function bootBackendSession() {
      try {
        const promptParts = [directive, `Lead character: ${leadCharacter}.`]
        if (personalityPrompt.trim()) promptParts.push(`Personality change: ${personalityPrompt.trim()}`)
        if (newCharacter.trim()) promptParts.push(`Introduce this new character: ${newCharacter.trim()}`)
        const prepared = await createSimulation({
          bookTitle: worldName,
          bookInitRevisionId,
          prompt: promptParts.join(' '),
          leadCharacterId,
          personalityChange: personalityPrompt,
          newCharacterName: newCharacter,
          maxTicks: 50,
          maxChapters: 5,
          chapterIntervalTicks: 10,
        })

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
            relationships: current.relationships + (payload.event_type.includes('chapter') ? 1 : 0),
            memories: current.memories + (payload.event_type.includes('media') ? 1 : 0),
          }))
          if (nextEvent.actor && nextEvent.kind === 'thought') setThinking(nextEvent.actor)
          if (payload.media) setSceneMedia((current) => mergeMedia(current, [payload.media as SceneMedia]))
        }

        const streamEvents = ['scene.detected', 'scene.status_changed', 'scene.screenplay_ready', 'media.task_requested', 'media.task_status', 'chapter.boundary_detected', 'chapter.completed']
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
  }, [bookInitRevisionId, characters, directive, leadCharacter, leadCharacterId, newCharacter, personalityPrompt, worldName])

  useEffect(() => {
    if (!session?.id || offlineMode) return
    const sessionId = session.id

    async function reconcileScenes() {
      try {
        const snapshot = await getScenes(sessionId)
        setSceneMedia((current) => mergeMedia(
          current,
          snapshot.scenes.flatMap((scene) => scene.media || []),
        ))
      } catch {
        // SSE is the primary live path; a missed REST reconciliation should
        // not mark the full simulation as disconnected.
      }
    }

    void reconcileScenes()
    const interval = window.setInterval(async () => {
      try {
        const [status] = await Promise.all([getSimulation(sessionId), reconcileScenes()])
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
  }, [offlineMode, session?.id])

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
        await stopSimulation(session.id)
      } catch {
        // Navigating away is still the intended user action.
      }
    }
    router.push('/story')
  }

  async function handlePublishSimulation() {
    if (!session?.id || offlineMode || publishing) return
    setPublishing(true)
    try {
      const publication = await publishSimulation(session.id, `${worldName}: ${directive.slice(0, 72)}`)
      setConnectionNote(`Published to the marketplace as “${publication.title}”.`)
    } catch (error) {
      setConnectionNote(`Could not publish this run. ${error instanceof Error ? error.message : ''}`.trim())
    } finally {
      setPublishing(false)
    }
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
          <button onClick={handlePublishSimulation} disabled={!session || offlineMode || publishing}>{publishing ? 'Publishing…' : 'Publish version'}</button>
          <button onClick={handleStopSimulation} className="stop-simulation">Stop simulation</button>
        </div>
      </header>

      <section className="simulation-stats">
        <div><small>EVENTS SIMULATED</small><strong>{stats.events}</strong></div>
        <div><small>INTENTS UPDATED</small><strong>{stats.updated}</strong></div>
        <div><small>CHAPTER SIGNALS</small><strong>{stats.relationships}</strong></div>
        <div><small>MEDIA UPDATES</small><strong>{stats.memories}</strong></div>
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
          <section className="voice-card scene-assets">
            <small>SCENE MEDIA</small>
            {sceneMedia.length === 0 ? (
              <p>Generated panels and narration will appear here as scene jobs complete.</p>
            ) : sceneMedia.map((media) => media.kind === 'image' ? (
              // These binary artifacts can be served from the local FastAPI
              // service or future user-configured object storage, so a native
              // image element avoids locking the frontend to a static host allowlist.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={media.id} src={mediaUrl(media.uri)} alt="Generated comic scene" />
            ) : (
              <audio key={media.id} controls preload="metadata" src={mediaUrl(media.uri)}>
                Generated scene narration.
              </audio>
            ))}
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
        </section>
      </div>
    </main>
  )
}
