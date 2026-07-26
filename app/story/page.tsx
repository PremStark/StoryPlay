'use client'

import Link from 'next/link'
import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { getBookIngestion, listBooks, listPublications, mediaUrl, uploadBookPdf, type BookIngestionStatus, type BookMarketplaceItem, type Publication } from '../../lib/dracarys-api'

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
  const [publications, setPublications] = useState<Publication[]>([])
  const [title, setTitle] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [ingestion, setIngestion] = useState<BookIngestionStatus | null>(null)
  const [error, setError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const [response, published] = await Promise.all([listBooks(), listPublications()])
      setBooks(response.books)
      setPublications(published)
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

  async function createWorld(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pdf || creating) return
    setCreating(true)
    setError('')
    try {
      const result = await uploadBookPdf(pdf, title)
      if (result.status === 'completed' && result.book_init_id) {
        window.location.assign(`/story/${encodeURIComponent(result.book_init_id)}`)
        return
      }
      setIngestion({ id: result.id, title: result.title, book_init_id: result.book_init_id, status: result.status, stage: result.stage, error: result.error })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create this world.')
      setCreating(false)
    }
  }

  function choosePdf(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] || null
    if (next && next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.')
      event.target.value = ''
      return
    }
    setError('')
    setPdf(next)
  }

  useEffect(() => {
    if (!ingestion || ['completed', 'failed'].includes(ingestion.status)) return
    let cancelled = false
    const poll = async () => {
      try {
        const status = await getBookIngestion(ingestion.id)
        if (cancelled) return
        setIngestion(status)
        if (status.status === 'completed' && status.book_init_id) window.location.assign(`/story/${encodeURIComponent(status.book_init_id)}`)
        if (status.status === 'failed') setCreating(false)
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'Could not check book processing.')
          setCreating(false)
        }
      }
    }
    void poll()
    const timer = window.setInterval(() => { void poll() }, 1800)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [ingestion])

  return (
    <main className="library-shell">
      <nav className="library-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/"><span>&larr;</span> Back to home</Link>
      </nav>
      <section className="library-hero">
        <p className="eyebrow"><span /> STORY MARKETPLACE</p>
        <h1>Every book holds<br />a different <em>door.</em></h1>
        <p>Choose a prepared world, or upload a PDF to create a private, immutable canon library from the actual text.</p>
        <form className="marketplace-create" onSubmit={createWorld}>
          <label className="pdf-picker"><input type="file" accept="application/pdf,.pdf" onChange={choosePdf} /><span>{pdf ? pdf.name : 'Choose book PDF'}</span></label>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Book title (optional)" aria-label="Book title" />
          <button disabled={!pdf || creating} type="submit">{creating ? 'Mapping canon…' : 'Create world →'}</button>
        </form>
        {ingestion && <div className={`ingestion-status is-${ingestion.status}`} role="status"><b>{ingestion.status === 'completed' ? 'Canon ready' : 'Chronos is mapping your book'}</b><span>{ingestion.error || ingestion.stage || `Status: ${ingestion.status}`}</span></div>}
        {error && <p className="marketplace-error" role="alert">{error}</p>}
      </section>
      {!loading && publications.length > 0 && <section className="published-bookcase" aria-label="Published alternate-universe stories">
        <div className="published-bookcase-heading"><p className="eyebrow"><span /> PUBLISHED STORIES</p><p>Finished alternate-universe outputs, ready to read and play.</p></div>
        <div className="bookcase">
          {publications.map((publication, index) => {
            const output = publication.manifest?.final_output
            const cover = output?.images[0]
            return <Link href={`/story/published/${encodeURIComponent(publication.slug)}`} className={`library-book published-book ${themeFor(publication.title)}`} key={publication.id}>
              <div className="library-pages" />
              <article className="library-cover">
                {/* Published artifacts can be external object-storage URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {cover ? <img className="published-cover-image" src={mediaUrl(cover.uri)} alt="" /> : null}
                <p className="library-number">PUBLISHED / {String(index + 1).padStart(2, '0')}</p>
                <span className="book-mark">{markFor(publication.title)}</span>
                <div className="library-title"><h2>{publication.title}</h2><i>{output?.playback.segments.length || 0} completed scenes</i></div>
                <div className="cover-line" />
                <p className="book-author">final output</p>
                <span className="open-book">Read story <b>→</b></span>
              </article>
            </Link>
          })}
        </div>
      </section>}
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
