'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'

type EventKind = 'world' | 'thought' | 'decision' | 'relationship' | 'effect'

type SimulationEvent = {
  id: number
  kind: EventKind
  actor?: string
  target?: string
  title: string
  text: string
  line?: string
  affected: string[]
}

type EpisodeEvent = Omit<SimulationEvent, 'id'>
type Episode = { tick: number; directive: string; events: EpisodeEvent[] }

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

export default function Dashboard({
  worldName,
  leadCharacter,
  characters,
  outcome,
  personalityPrompt,
}: {
  worldName: string
  leadCharacter: string
  characters: readonly string[]
  outcome: string
  personalityPrompt: string
}) {
  const [active, setActive] = useState(true)
  const [voiceOn, setVoiceOn] = useState(false)
  const [events, setEvents] = useState<SimulationEvent[]>([])
  const [tick, setTick] = useState(1)
  const [thinking, setThinking] = useState<string | null>(leadCharacter)
  const [selectedEvent, setSelectedEvent] = useState<SimulationEvent | null>(null)
  const [seeded, setSeeded] = useState(false)
  const [stats, setStats] = useState({ events: 0, updated: 0, relationships: 0, memories: 0 })
  const generatedTick = useRef(1)
  const directive = outcome || `Explore what changes when ${leadCharacter} chooses a different path.`
  const currentDialogue = [...events].reverse().find((event) => event.line)

  useEffect(() => {
    fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ worldName, leadCharacter, characters, outcome, personalityPrompt }),
    })
      .then((response) => response.json() as Promise<{ episode: Episode }>)
      .then(({ episode }) => {
        setSeeded(true)
        setEvents(episode.events.map((event, index) => ({ ...event, id: index + 1, affected: uniqueNames(event.affected) })))
        setStats({ events: episode.events.length, updated: 3, relationships: 1, memories: 8 })
      })
      .catch(() => {
        setSeeded(true)
        setEvents([
          {
            id: 1,
            kind: 'world',
            actor: 'World Engine',
            title: 'Timeline fork established',
            text: `${worldName} accepts the changed premise and begins simulating consequences.`,
            affected: uniqueNames(characters.slice(0, 3)),
          },
        ])
      })
  }, [characters, leadCharacter, outcome, personalityPrompt, worldName])

  useEffect(() => {
    if (!active || !seeded) return
    const interval = window.setInterval(() => setTick((currentTick) => currentTick + 1), 2000)

    return () => window.clearInterval(interval)
  }, [active, seeded])

  useEffect(() => {
    if (!seeded || tick <= 1 || generatedTick.current === tick) return

    generatedTick.current = tick
    const actor = characters[(tick - 1) % characters.length] || leadCharacter
    const target = characters[tick % characters.length] || leadCharacter
    const phase = tick % 4
    const event: SimulationEvent =
      phase === 1
        ? {
            id: tick + 10,
            kind: 'thought',
            actor,
            title: `${actor} starts thinking`,
            text: `New information changes what ${actor} believes is possible.`,
            line: thoughts[tick % thoughts.length],
            affected: [actor],
          }
        : phase === 2
          ? {
              id: tick + 10,
              kind: 'decision',
              actor,
              title: `${actor} commits to a new course`,
              text: actor === leadCharacter && personalityPrompt ? personalityPrompt : `${actor} acts before the original timeline can reassert itself.`,
              line: actor === leadCharacter && personalityPrompt ? personalityPrompt : 'I cannot wait for the old ending to happen again.',
              affected: uniqueNames([actor, leadCharacter]),
            }
          : phase === 3
            ? {
                id: tick + 10,
                kind: 'relationship',
                actor,
                target,
                title: `${actor} confronts ${target}`,
                text: `${target} updates their trust in ${actor}. A private belief becomes a visible relationship change.`,
                line: `${target}, you need to know what changed.`,
                affected: uniqueNames([actor, target]),
              }
            : {
                id: tick + 10,
                kind: 'effect',
                actor: 'World Engine',
                title: worldEffects[(tick / 4) % worldEffects.length],
                text: 'The consequence spreads to nearby characters and creates the next cause.',
                affected: uniqueNames(characters.slice(0, 4)),
              }

    setThinking(phase === 1 ? actor : null)
    setEvents((currentEvents) => [...currentEvents.filter((item) => item.id !== event.id), event].slice(-10))
    setStats((current) => ({
      events: current.events + 1,
      updated: current.updated + (phase === 2 || phase === 3 ? 1 : 0),
      relationships: current.relationships + (phase === 3 ? 1 : 0),
      memories: current.memories + 2,
    }))
  }, [characters, leadCharacter, personalityPrompt, seeded, tick])

  useEffect(() => {
    if (!voiceOn || !active || !currentDialogue?.line || typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`${currentDialogue.actor || 'World'} says. ${currentDialogue.line}`)
    utterance.rate = 0.92
    utterance.pitch = currentDialogue.kind === 'thought' ? 0.85 : 1
    window.speechSynthesis.speak(utterance)

    return () => window.speechSynthesis.cancel()
  }, [active, currentDialogue?.actor, currentDialogue?.id, currentDialogue?.kind, currentDialogue?.line, voiceOn])

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
    <main className="world-shell">
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
          <button onClick={() => setActive(!active)}>{active ? 'Pause' : 'Resume'}</button>
        </div>
      </header>

      <section className="simulation-stats">
        <div><small>EVENTS SIMULATED</small><strong>{stats.events}</strong></div>
        <div><small>CHARACTERS UPDATED</small><strong>{stats.updated}</strong></div>
        <div><small>RELATIONSHIPS CHANGED</small><strong>{stats.relationships}</strong></div>
        <div><small>MEMORIES WRITTEN</small><strong>{stats.memories}</strong></div>
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
            <small>CHARACTER AUDIO</small>
            <h3>{currentDialogue?.actor || 'No speaker yet'}</h3>
            <p>{currentDialogue?.line || 'Dialogue appears here when characters think, decide, or confront each other.'}</p>
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
                        <div><span>{event.actor || 'World'}</span><i /> <span>{event.target || 'Relationship shift'}</span><i /> <span>New timeline</span></div>
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
