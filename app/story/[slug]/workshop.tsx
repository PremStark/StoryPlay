'use client'

import Link from 'next/link'
import { useState } from 'react'

type Story = { title: string; subtitle: string; theme: string; mark: string; characters: readonly string[]; personalities: readonly string[] }

export default function StoryWorkshop({ story }: { story: Story }) {
  const [character, setCharacter] = useState(story.characters[0])
  const [personality, setPersonality] = useState(story.personalities[0])
  const [outcome, setOutcome] = useState('')
  const [newCharacter, setNewCharacter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [message, setMessage] = useState('')

  function beginStory() {
    setMessage(`Your new ${story.title} story is ready to begin with ${character}.`)
  }

  return (
    <main className="workshop-shell">
      <nav className="library-nav workshop-nav"><Link className="brand" href="/"><span className="brand-mark">✦</span> Storytime</Link><Link className="back-home" href="/story"><span>←</span> Story library</Link></nav>
      <div className="workshop">
        <aside className="selected-story">
          <p className="eyebrow"><span /> SELECTED STORY</p>
          <div className={`selected-cover ${story.theme}`}><p className="library-number">YOUR EDITION</p><span className="book-mark">{story.mark}</span><div className="library-title"><h1>{story.title}</h1><i>{story.subtitle}</i></div><div className="cover-line" /><p className="book-author">A STORYTIME ADVENTURE</p></div>
          <p className="selected-copy">You are about to enter this world. Change one choice, and discover how the story unfolds from there.</p>
          <Link href="/story" className="choose-another">← Choose another book</Link>
        </aside>
        <section className="workshop-panel">
          <div className="panel-heading"><span className="section-label">CREATE YOUR VERSION</span><h2>Make the story<br /><em>your own.</em></h2><p>Choose who leads the scene and the change you want to make.</p></div>
          <div className="form-section"><label htmlFor="character">01 — PICK YOUR CHARACTER</label><div className="select-wrap"><select id="character" value={character} onChange={(e) => setCharacter(e.target.value)}>{story.characters.map((item) => <option key={item}>{item}</option>)}</select></div><span className="field-hint">The story will follow {character}.</span></div>
          <div className="form-section"><label htmlFor="outcome">02 — CHANGE THE OUTCOME</label><textarea id="outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="e.g. What if they made a different choice at the turning point?" rows={3} /><span className="field-hint">Describe the moment you want to rewrite.</span></div>
          <div className="form-section add-section"><div className="form-label-row"><label>03 — ADD A CHARACTER</label><button type="button" onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Close' : '+ Add someone new'}</button></div>{showAdd && <input aria-label="New character name" value={newCharacter} onChange={(e) => setNewCharacter(e.target.value)} placeholder="Their name and role in the story" />}</div>
          <div className="form-section"><label htmlFor="personality">04 — MODIFY THEIR PERSONALITY</label><div className="select-wrap"><select id="personality" value={personality} onChange={(e) => setPersonality(e.target.value)}>{story.personalities.map((item) => <option key={item}>{item}</option>)}</select></div><span className="field-hint">How should {character} show up in your version?</span></div>
          <button className="begin-button" onClick={beginStory}><span>✦</span> Start my new story <b>→</b></button>
          {message && <p className="workshop-message" role="status">{message}</p>}
        </section>
      </div>
    </main>
  )
}
