'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  confirmBranchPlan,
  createBranchPlan,
  getBook,
  type BranchCharacterInput,
  type BranchPlan,
  type BookInit,
  type TimelineAnchor,
} from '../../../lib/dracarys-api'
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
  const [timelineSelection, setTimelineSelection] = useState('')
  const [changeDescription, setChangeDescription] = useState('')
  const [modifyCharacter, setModifyCharacter] = useState('')
  const [modifyCharacterReference, setModifyCharacterReference] = useState('')
  const [addCharacter, setAddCharacter] = useState<BranchCharacterInput>({ name: '', persona: '', location: '', interaction_notes: '' })
  const [showAdd, setShowAdd] = useState(false)
  const [plan, setPlan] = useState<BranchPlan | null>(null)
  const [planning, setPlanning] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [runLimitValue, setRunLimitValue] = useState(6)
  const [view, setView] = useState<'form' | 'boot' | 'dashboard'>('form')

  useEffect(() => {
    let cancelled = false
    async function loadWorld() {
      try {
        const loadedBook = await getBook(bookInitId)
        if (cancelled) return
        setBook(loadedBook)
        const firstChapter = loadedBook.chapters?.[0]
        if (firstChapter) setTimelineSelection(firstChapter.id)
        const firstCharacter = loadedBook.content.characters[0]
        if (firstCharacter) setModifyCharacterReference(firstCharacter.name)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load this world.')
      }
    }
    void loadWorld()
    return () => { cancelled = true }
  }, [bookInitId])

  const characters = useMemo(() => book?.content.characters || [], [book])
  const anchors = useMemo<TimelineAnchor[]>(() => (book?.chapters || []).map((chapter) => ({
    id: chapter.id,
    chapter_number: chapter.chapter_number,
    chapter_title: chapter.title,
    summary: chapter.summary,
    character_ids: chapter.character_ids,
  })), [book])
  const selectedAnchor = anchors.find((anchor) => anchor.id === timelineSelection)
  const theme = themeFor(book?.canonical_title || '')

  async function analyseChange() {
    if (!book || !changeDescription.trim() || planning) return
    setPlanning(true)
    setError('')
    try {
      const hasCharacter = Object.values(addCharacter).some((value) => value.trim())
      const completeCharacter = Object.values(addCharacter).every((value) => value.trim())
      if (showAdd && hasCharacter && !completeCharacter) {
        setError('Complete every field for the new character, or remove the incomplete character request.')
        return
      }
      const result = await createBranchPlan({
        book_init_revision_id: book.id,
        timeline_change: {
          canon_scenario: selectedAnchor?.summary || timelineSelection || 'User-described canon moment',
          requested_change: changeDescription.trim(),
          timeline_id: selectedAnchor?.id,
        },
        character_additions: showAdd && hasCharacter ? [{
          name: addCharacter.name,
          persona: addCharacter.persona,
          location_description: addCharacter.location,
          interaction_guidance: addCharacter.interaction_notes,
        }] : [],
        character_modifications: modifyCharacter.trim() && modifyCharacterReference ? [{
          character_reference: modifyCharacterReference,
          requested_change: modifyCharacter.trim(),
          timeline_id: selectedAnchor?.id,
        }] : [],
      })
      setPlan(result)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Chronos could not verify this change.')
    } finally {
      setPlanning(false)
    }
  }

  async function confirmChange() {
    if (!plan || confirming) return
    setConfirming(true)
    setError('')
    try {
      const confirmedPlan = await confirmBranchPlan(plan.id, plan.confirmation_token, plan.selected_timeline_id)
      setPlan(confirmedPlan)
      setView('boot')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not start this alternate universe.')
      setConfirming(false)
    }
  }

  function changeNewCharacter(field: keyof BranchCharacterInput, value: string) {
    setAddCharacter((current) => ({ ...current, [field]: value }))
    setPlan(null)
  }

  if (error && !book) return <main className="workshop-shell"><p className="marketplace-status">{error} <Link href="/story">Return to marketplace</Link></p></main>
  if (!book) return <main className="workshop-shell"><p className="marketplace-status">Opening this world…</p></main>
  if (view === 'boot' && plan) return <WorldBootSequence worldName={book.canonical_title} theme={theme} onComplete={() => setView('dashboard')} />
  if (view === 'dashboard' && plan) {
    return <Dashboard
      worldName={book.canonical_title}
      bookInitRevisionId={book.id}
      theme={theme}
      leadCharacter={characters[0]?.name || 'The world'}
      leadCharacterId={characters[0]?.id || ''}
      characters={characters.map((character) => character.name)}
      outcome={plan?.verification_summary || changeDescription}
      personalityPrompt={modifyCharacter}
      newCharacter={addCharacter.name}
      branchPlanId={plan.id}
      maxScenes={runLimitValue}
    />
  }

  return (
    <main className="workshop-shell">
      <nav className="library-nav workshop-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/story"><span>&larr;</span> Story marketplace</Link>
      </nav>
      <div className="workshop">
        <aside className="selected-story">
          <p className="eyebrow"><span /> IMMUTABLE CANON</p>
          <div className={`selected-cover ${theme}`}>
            <p className="library-number">PDF-INDEXED BOOKINIT</p>
            <span className="book-mark">{markFor(book.canonical_title)}</span>
            <div className="library-title"><h1>{book.canonical_title}</h1><i>{characters.length} indexed characters</i></div>
            <div className="cover-line" />
            <p className="book-author">{book.quality} CANON</p>
          </div>
          <p className="selected-copy">This book is never changed. Chronos retrieves from its chapter-level canon, then creates a private branch plan for your session.</p>
          <div className="canon-facts"><span><b>{book.chapters?.length ?? '—'}</b> chapter cuts</span><span><b>{anchors.length || '—'}</b> timeline anchors</span></div>
          <Link href="/story" className="choose-another">&larr; Choose another book</Link>
        </aside>
        <section className="workshop-panel">
          <div className="panel-heading">
            <span className="section-label">ALTERNATE UNIVERSE</span>
            <h2>Choose the moment.<br /><em>Then change it.</em></h2>
            <p>Chronos first validates the canon moment and shows exactly what it understood. Nothing runs until you confirm.</p>
          </div>
          <div className="form-section">
            <label htmlFor="timeline">01 — CHOOSE THE CANON MOMENT</label>
            {anchors.length > 0 ? <div className="select-wrap"><select id="timeline" value={timelineSelection} onChange={(event) => { setTimelineSelection(event.target.value); setPlan(null) }}>
              {anchors.map((anchor) => <option key={anchor.id} value={anchor.id}>Chapter {anchor.chapter_number || '—'}{anchor.chapter_title ? ` · ${anchor.chapter_title}` : ''} — {anchor.summary}</option>)}
            </select></div> : <textarea id="timeline" value={timelineSelection} onChange={(event) => { setTimelineSelection(event.target.value); setPlan(null) }} rows={2} placeholder="Describe where in the story this change begins…" />}
            {selectedAnchor?.source_excerpt && <span className="canon-excerpt">Canon evidence: “{selectedAnchor.source_excerpt}”</span>}
            <span className="field-hint">The selected chapter supplies the characters and world state at this point in the uploaded book.</span>
          </div>
          <div className="form-section">
            <label htmlFor="change">02 — CHANGE THE TIMELINE</label>
            <textarea id="change" value={changeDescription} onChange={(event) => { setChangeDescription(event.target.value); setPlan(null) }} placeholder="Explain what happened in canon, what should change, and why." rows={4} />
            <span className="field-hint">Use free text. Chronos compares it with the uploaded book before it becomes a branch.</span>
          </div>
          <div className="form-section add-section">
            <div className="form-label-row"><label>03 — ADD A CHARACTER (OPTIONAL)</label><button type="button" onClick={() => { setShowAdd((value) => !value); setPlan(null) }}>{showAdd ? 'Close' : '+ Add character'}</button></div>
            {showAdd && <div className="character-fields">
              <input aria-label="New character name" value={addCharacter.name} onChange={(event) => changeNewCharacter('name', event.target.value)} placeholder="Name" />
              <textarea value={addCharacter.persona} onChange={(event) => changeNewCharacter('persona', event.target.value)} placeholder="Persona, goals, strengths, and flaws" rows={2} />
              <input value={addCharacter.location} onChange={(event) => changeNewCharacter('location', event.target.value)} placeholder="Where they are present in this moment" />
              <textarea value={addCharacter.interaction_notes} onChange={(event) => changeNewCharacter('interaction_notes', event.target.value)} placeholder="How they should interact with people and the world" rows={2} />
            </div>}
          </div>
          <div className="form-section personality-section">
            <label htmlFor="modify">04 — MODIFY AN EXISTING CHARACTER (OPTIONAL)</label>
            {characters.length > 0 && <div className="select-wrap"><select value={modifyCharacterReference} onChange={(event) => { setModifyCharacterReference(event.target.value); setPlan(null) }}>{characters.map((character) => <option key={character.id} value={character.name}>{character.name}</option>)}</select></div>}
            <textarea id="modify" value={modifyCharacter} onChange={(event) => { setModifyCharacter(event.target.value); setPlan(null) }} placeholder="Describe who changes, how they change, and when it takes effect. Chronos will flag it if that character is not at the selected moment." rows={3} />
          </div>
          <div className="form-section run-settings">
            <label>05 — RUN SETTINGS</label>
            <div className="limit-value"><input type="number" min={1} max={100} value={runLimitValue} onChange={(event) => setRunLimitValue(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} /><span>scenes</span></div>
            <span className="field-hint">The run stops after {runLimitValue} scenes; the tick limit remains a safety guard.</span>
          </div>

          {error && <p className="workshop-error" role="alert">{error}</p>}
          {!plan ? <button className="begin-button" type="button" onClick={analyseChange} disabled={!changeDescription.trim() || planning}><span>*</span>{planning ? 'Chronos is validating…' : 'Verify this change'}<b>→</b></button> : <section className="verification-card" aria-live="polite">
            <p className="section-label">CHRONOS VERIFICATION</p>
            <h3>{plan.timeline_candidates.find((candidate) => candidate.id === plan.selected_timeline_id)?.title || 'Select a canon timeline'}</h3>
            <p>{plan.verification_summary || 'Chronos has prepared this alternate-universe change for review.'}</p>
            {plan.status === 'awaiting_timeline_selection' && <div className="plan-timeline-select"><label htmlFor="verified-timeline">Choose the canon chapter before confirming</label><div className="select-wrap"><select id="verified-timeline" value={plan.selected_timeline_id || ''} onChange={(event) => setPlan((current) => current ? { ...current, selected_timeline_id: event.target.value } : current)}><option value="">Select a chapter…</option>{plan.timeline_candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>Chapter {candidate.chapter_number} · {candidate.title || candidate.summary}</option>)}</select></div></div>}
            {plan.timeline_candidates.find((candidate) => candidate.id === plan.selected_timeline_id)?.summary && <blockquote>{plan.timeline_candidates.find((candidate) => candidate.id === plan.selected_timeline_id)?.summary}</blockquote>}
            {!!plan.character_dispositions?.length && <div className="plan-characters"><b>Character change validation</b><span>{plan.character_dispositions.map((item) => item.message).join(' ')}</span></div>}
            {(plan.warnings || []).map((warning) => <p className="plan-warning" key={warning}>Note: {warning}</p>)}
            <div className="verification-actions"><button type="button" className="verify-again" onClick={() => setPlan(null)}>Edit request</button><button type="button" className="begin-button" onClick={confirmChange} disabled={confirming || (plan.status === 'awaiting_timeline_selection' && !plan.selected_timeline_id)}><span>*</span>{confirming ? 'Opening timeline…' : 'Confirm & start simulation'}<b>→</b></button></div>
          </section>}
        </section>
      </div>
    </main>
  )
}
