'use client'

import { useState } from 'react'
import Link from 'next/link'

const characters = [
  { name: 'Elena', role: 'The Explorer', initials: 'E', color: 'coral' },
  { name: 'Milo', role: 'The Inventor', initials: 'M', color: 'violet' },
  { name: 'Ari', role: 'The Dreamer', initials: 'A', color: 'gold' },
]

const moments = [
  { title: 'The invitation', chapter: 'CHAPTER 01', text: 'A curious letter changes everything.', time: '08:12' },
  { title: 'Into the forest', chapter: 'CHAPTER 02', text: 'The path has more than one secret.', time: '10:45' },
  { title: 'The turning point', chapter: 'CHAPTER 03', text: 'One decision, a thousand possible worlds.', time: '14:20' },
]

function Sparkle() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Zm7.2 14.4.7 2.4 2.5.7-2.5.7-.7 2.4-.7-2.4-2.5-.7 2.5-.7.7-2.4Z" fill="currentColor" /></svg>
}

export default function Home() {
  const [character, setCharacter] = useState(0)
  const [moment, setMoment] = useState(2)
  const [isTraveling, setIsTraveling] = useState(false)

  function startJourney() {
    setIsTraveling(true)
    window.setTimeout(() => setIsTraveling(false), 1800)
  }

  return (
    <main className="story-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <nav className="topbar">
        <a className="brand" href="#top" aria-label="Story Time Machine home"><span className="brand-mark"><Sparkle /></span> Storytime</a>
        <div className="nav-links"><a href="#machine">The machine</a><a href="#how-it-works">How it works</a></div>
        <button className="profile-button" aria-label="Open profile">P</button>
      </nav>

      <section id="top" className="hero">
        <div className="hero-copy-area">
          <p className="eyebrow"><span /> YOUR STORY, REIMAGINED</p>
          <h1>What if the story<br /><em>changed with you?</em></h1>
          <p className="hero-copy">Step into the moment. Switch a character. See where the story takes you.</p>
          <a className="scroll-cue" href="#machine">Explore your story <span>↓</span></a>
        </div>
        <Link href="/story" className="book-link" aria-label="Open The Clockwork Garden story">
          <div className="story-book">
            <div className="book-pages" />
            <div className="book-cover">
              <div className="cover-glow" />
              <p className="cover-kicker">A STORYTIME ORIGINAL</p>
              <div className="cover-moon">✦</div>
              <p className="cover-title">The<br /><i>Clockwork</i><br />Garden</p>
              <div className="cover-garden"><span className="vine vine-one" /><span className="vine vine-two" /><span className="flower flower-one">✦</span><span className="flower flower-two">✦</span></div>
              <p className="cover-author">BEGIN THE ADVENTURE</p>
            </div>
          </div>
          <span className="book-caption">Open the story <b>→</b></span>
        </Link>
      </section>

      <section id="machine" className="machine" aria-label="Story time machine">
        <div className="machine-intro">
          <p className="section-label">THE TIME MACHINE</p>
          <h2>Choose a moment<br />to <em>rewrite.</em></h2>
          <p>Every character sees a different path. Pick who you want to be, then travel to the moment you want to change.</p>
          <div className="story-meta"><span className="meta-orb">✦</span><div><strong>The Clockwork Garden</strong><small>An original story · 12 min read</small></div></div>
        </div>

        <div className="machine-panel">
          <div className="panel-top"><span>01 — PICK YOUR CHARACTER</span><span className="step-number">01 / 02</span></div>
          <div className="character-list">
            {characters.map((item, index) => <button key={item.name} onClick={() => setCharacter(index)} className={`character-card ${character === index ? 'selected' : ''}`}>
              <span className={`avatar ${item.color}`}>{item.initials}</span><span><strong>{item.name}</strong><small>{item.role}</small></span><i aria-hidden="true" />
            </button>)}
          </div>

          <div className="timeline-heading"><span>02 — CHOOSE A MOMENT</span><span className="step-number">02 / 02</span></div>
          <div className="timeline">
            <div className="timeline-line" />
            {moments.map((item, index) => <button key={item.title} onClick={() => setMoment(index)} className={`moment ${moment === index ? 'active' : ''}`}>
              <span className="moment-dot" /><span className="moment-time">{item.time}</span><span className="moment-details"><small>{item.chapter}</small><strong>{item.title}</strong><em>{item.text}</em></span>
            </button>)}
          </div>

          <button className={`journey-button ${isTraveling ? 'traveling' : ''}`} onClick={startJourney}>
            <span className="journey-icon"><Sparkle /></span>{isTraveling ? 'Finding your new path…' : `Travel as ${characters[character].name}`}<span className="journey-arrow">→</span>
          </button>
          <p className="panel-note">Your story starts at “{moments[moment].title}”</p>
        </div>
      </section>

      <section id="how-it-works" className="how-it-works">
        <p className="section-label">A NEW KIND OF STORY</p>
        <div className="how-grid"><h2>Infinite paths.<br /><em>One adventure.</em></h2><p>Storytime uses AI to create a fresh chapter based on your character and the moment you choose. No two journeys unfold the same way.</p></div>
      </section>
    </main>
  )
}
