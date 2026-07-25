'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { initializeBook, listBooks, type BookMarketplaceItem } from '../../lib/dracarys-api'

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

export default function StoryLibrary() {
  const [books, setBooks] = useState<BookMarketplaceItem[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const response = await listBooks()
      setBooks(response.books)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the story marketplace.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const normalizedTitle = useMemo(() => title.trim(), [title])
  async function createWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!normalizedTitle || creating) return
    setCreating(true)
    setError('')
    try {
      const result = await initializeBook(normalizedTitle)
      window.location.assign(`/story/${encodeURIComponent(result.book_init.id)}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this world.')
      setCreating(false)
    }
  }

  return (
    <main className="library-shell">
      <nav className="library-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/"><span>&larr;</span> Back to home</Link>
      </nav>
      <section className="library-hero">
        <p className="eyebrow"><span /> STORY MARKETPLACE</p>
        <h1>Every book holds<br />a different <em>door.</em></h1>
        <p>Choose a cached world, or name a book to create a private demo seed from its high-level setting.</p>
        <form className="marketplace-create" onSubmit={createWorld}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Name a book or world…" aria-label="Book title" />
          <button disabled={!normalizedTitle || creating} type="submit">{creating ? 'Preparing world…' : 'Create world →'}</button>
        </form>
        {error && <p className="marketplace-error" role="alert">{error}</p>}
      </section>
      <section className="bookcase" aria-label="Story marketplace">
        {loading && <p className="marketplace-status">Loading your available worlds…</p>}
        {!loading && books.map((book, index) => (
          <Link href={`/story/${encodeURIComponent(book.id)}`} className={`library-book ${themeFor(book.canonical_title)}`} key={book.id}>
            <div className="library-pages" />
            <article className="library-cover">
              <p className="library-number">{String(index + 1).padStart(2, '0')} / {String(books.length).padStart(2, '0')}</p>
              <span className="book-mark">{markFor(book.canonical_title)}</span>
              <div className="library-title"><h2>{book.canonical_title}</h2><i>{book.character_names.slice(0, 2).join(' · ') || 'World seed'}</i></div>
              <div className="cover-line" />
              <p className="book-author">{book.quality} world</p>
              <span className="open-book">Open story <b>→</b></span>
            </article>
            <span className="book-description">{book.description || 'A cached world ready for a new divergence.'}</span>
          </Link>
        ))}
      </section>
      {!loading && books.length === 0 && <p className="library-footnote">No worlds are cached yet. Create the first one above.</p>}
    </main>
  )
}
