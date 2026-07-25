'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { getBook, rebuildBook, type BookInit } from '../../../lib/dracarys-api'
import Dashboard from './Dashboard'
import WorldBootSequence from './WorldBootSequence'

function themeFor(title: string) {
  const normalized = title.toLowerCase()
  if (normalized.includes('throne') || normalized.includes('ice and fire')) return 'thrones'
  if (normalized.includes('potter') || normalized.includes('wizard')) return 'magic'
  if (normalized.includes('fight')) return 'fight'
  if (normalized.includes('shawshank')) return 'shawshank'
  return 'market'
}

function markFor(title: string) {
  return title.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'SP'
}

export default function StoryWorkshop({ bookInitId }: { bookInitId: string }) {
  const [book, setBook] = useState<BookInit | null>(null)
  const [error, setError] = useState('')
  const [characterId, setCharacterId] = useState('')
  const [personalityCharacterId, setPersonalityCharacterId] = useState('')
  const [personalityPrompt, setPersonalityPrompt] = useState('')
  const [outcome, setOutcome] = useState('')
  const [newCharacter, setNewCharacter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [view, setView] = useState<'form' | 'boot' | 'dashboard'>('form')
  const [rebuilding, setRebuilding] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getBook(bookInitId).then((value) => {
      if (cancelled) return
      setBook(value)
      const first = value.content.characters[0]?.id || ''
      setCharacterId(first)
      setPersonalityCharacterId(first)
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load this world.')
    })
    return () => { cancelled = true }
  }, [bookInitId])

  const characters = useMemo(() => book?.content.characters || [], [book])
  const selectedCharacter = characters.find((character) => character.id === characterId) || characters[0]
  const personalityCharacter = characters.find((character) => character.id === personalityCharacterId) || selectedCharacter
  if (error) return <main className="workshop-shell"><p className="marketplace-status">{error} <Link href="/story">Return to marketplace</Link></p></main>
  if (!book || !selectedCharacter) return <main className="workshop-shell"><p className="marketplace-status">Opening this world…</p></main>

  const theme = themeFor(book.canonical_title)
  async function rebuildSeed() {
    if (rebuilding || !book) return
    setRebuilding(true)
    try {
      const rebuilt = await rebuildBook(book.id)
      window.location.assign(`/story/${encodeURIComponent(rebuilt.id)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not rebuild this world seed.')
      setRebuilding(false)
    }
  }
  if (view === 'boot') return <WorldBootSequence worldName={book.canonical_title} theme={theme} onComplete={() => setView('dashboard')} />
  if (view === 'dashboard') return <Dashboard worldName={book.canonical_title} bookInitRevisionId={book.id} theme={theme} leadCharacter={selectedCharacter.name} leadCharacterId={selectedCharacter.id} characters={characters.map((character) => character.name)} outcome={outcome} personalityPrompt={personalityPrompt} newCharacter={newCharacter} />

  return (
    <main className="workshop-shell">
      <nav className="library-nav workshop-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/story"><span>&larr;</span> Story marketplace</Link>
      </nav>
      <div className="workshop">
        <aside className="selected-story">
          <p className="eyebrow"><span /> SELECTED WORLD</p>
          <div className={`selected-cover ${theme}`}>
            <p className="library-number">CACHED BOOKINIT</p>
            <span className="book-mark">{markFor(book.canonical_title)}</span>
            <div className="library-title"><h1>{book.canonical_title}</h1><i>{characters.length} active characters</i></div>
            <div className="cover-line" />
            <p className="book-author">{book.quality} WORLD SEED</p>
          </div>
          <p className="selected-copy">Every control below is tied to this world’s actual Pydantic character roster and becomes session-local state.</p>
          <button className="rebuild-seed" type="button" onClick={rebuildSeed} disabled={rebuilding}>{rebuilding ? 'Rebuilding seed…' : 'Rebuild demo seed'}</button>
          <Link href="/story" className="choose-another">&larr; Choose another world</Link>
        </aside>
        <section className="workshop-panel">
          <div className="panel-heading">
            <span className="section-label">CREATE YOUR VERSION</span>
            <h2>Make the story<br /><em>your own.</em></h2>
            <p>Choose a real character from the cached world, then define the divergence.</p>
          </div>
          <div className="form-section">
            <label htmlFor="character">01 - PICK YOUR CHARACTER</label>
            <div className="select-wrap"><select id="character" value={selectedCharacter.id} onChange={(event) => setCharacterId(event.target.value)}>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
            <span className="field-hint">The story will follow {selectedCharacter.name}.</span>
          </div>
          <div className="form-section">
            <label htmlFor="outcome">02 - CHANGE THE OUTCOME</label>
            <textarea id="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="e.g. What changes at the turning point?" rows={3} />
            <span className="field-hint">This becomes a visible divergence event on tick one.</span>
          </div>
          <div className="form-section add-section">
            <div className="form-label-row"><label>03 - ADD A CHARACTER</label><button type="button" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add someone new'}</button></div>
            {showAdd && <input aria-label="New character name" value={newCharacter} onChange={(event) => setNewCharacter(event.target.value)} placeholder="Their name and role in the story" />}
          </div>
          <div className="form-section personality-section">
            <label htmlFor="personality-character">04 - MODIFY A CHARACTER&apos;S PERSONALITY</label>
            <div className="select-wrap"><select id="personality-character" value={personalityCharacter?.id || ''} onChange={(event) => setPersonalityCharacterId(event.target.value)}>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></div>
            <textarea id="personality-prompt" value={personalityPrompt} onChange={(event) => setPersonalityPrompt(event.target.value)} placeholder={`e.g. Make ${personalityCharacter?.name || selectedCharacter.name} more bold and willing to take risks.`} rows={3} />
            <span className="field-hint">This adjustment is applied to the selected character for this run only.</span>
          </div>
          <button className="begin-button" onClick={() => setView('boot')} disabled={!outcome.trim()}><span>*</span> Start my new story <b>→</b></button>
        </section>
      </div>
    </main>
  )
}
