'use client'

import Link from 'next/link'
import { useState } from 'react'
import Dashboard from './Dashboard'
import WorldBootSequence from './WorldBootSequence'

type Story = { title: string; subtitle: string; theme: string; mark: string; characters: readonly string[]; personalities: readonly string[] }

export default function StoryWorkshop({ story }: { story: Story }) {
  const [character, setCharacter] = useState(story.characters[0])
  const [personalityCharacter, setPersonalityCharacter] = useState(story.characters[0])
  const [personalityPrompt, setPersonalityPrompt] = useState('')
  const [outcome, setOutcome] = useState('')
  const [newCharacter, setNewCharacter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [view, setView] = useState<'form' | 'boot' | 'dashboard'>('form')

  function beginStory() {
    setView('boot')
  }

  if (view === 'boot') return <WorldBootSequence worldName={story.title} onComplete={() => setView('dashboard')} />
  if (view === 'dashboard') return <Dashboard worldName={story.title} leadCharacter={character} characters={story.characters} outcome={outcome} personalityPrompt={personalityPrompt} />

  return (
    <main className="workshop-shell">
      <nav className="library-nav workshop-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/story"><span>&larr;</span> Story library</Link>
      </nav>
      <div className="workshop">
        <aside className="selected-story">
          <p className="eyebrow"><span /> SELECTED STORY</p>
          <div className={`selected-cover ${story.theme}`}>
            <p className="library-number">YOUR EDITION</p>
            <span className="book-mark">{story.mark}</span>
            <div className="library-title"><h1>{story.title}</h1><i>{story.subtitle}</i></div>
            <div className="cover-line" />
            <p className="book-author">A PERSONA ADVENTURE</p>
          </div>
          <p className="selected-copy">You are about to enter this world. Change one choice, and discover how the story unfolds from there.</p>
          <Link href="/story" className="choose-another">&larr; Choose another book</Link>
        </aside>

        <section className="workshop-panel">
          <div className="panel-heading">
            <span className="section-label">CREATE YOUR VERSION</span>
            <h2>Make the story<br /><em>your own.</em></h2>
            <p>Choose who leads the scene and the change you want to make.</p>
          </div>

          <div className="form-section">
            <label htmlFor="character">01 - PICK YOUR CHARACTER</label>
            <div className="select-wrap">
              <select id="character" value={character} onChange={(event) => setCharacter(event.target.value)}>
                {story.characters.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <span className="field-hint">The story will follow {character}.</span>
          </div>

          <div className="form-section">
            <label htmlFor="outcome">02 - CHANGE THE OUTCOME</label>
            <textarea id="outcome" value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="e.g. What if they made a different choice at the turning point?" rows={3} />
            <span className="field-hint">Describe the moment you want to rewrite.</span>
          </div>

          <div className="form-section add-section">
            <div className="form-label-row">
              <label>03 - ADD A CHARACTER</label>
              <button type="button" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add someone new'}</button>
            </div>
            {showAdd && <input aria-label="New character name" value={newCharacter} onChange={(event) => setNewCharacter(event.target.value)} placeholder="Their name and role in the story" />}
          </div>

          <div className="form-section personality-section">
            <label htmlFor="personality-character">04 - MODIFY A CHARACTER&apos;S PERSONALITY</label>
            <div className="select-wrap">
              <select id="personality-character" value={personalityCharacter} onChange={(event) => setPersonalityCharacter(event.target.value)}>
                {story.characters.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <textarea id="personality-prompt" value={personalityPrompt} onChange={(event) => setPersonalityPrompt(event.target.value)} placeholder={`e.g. Make ${personalityCharacter} more bold, playful, and willing to take risks.`} rows={3} />
            <span className="field-hint">Describe how you want {personalityCharacter} to act in this version.</span>
          </div>

          <button className="begin-button" onClick={beginStory}><span>*</span> Start my new story <b>&rarr;</b></button>
        </section>
      </div>
    </main>
  )
}
