'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getPublication, mediaUrl, type Publication } from '../../../../lib/dracarys-api'

export default function PublishedStoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const [publication, setPublication] = useState<Publication | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void params.then(async ({ slug }) => {
      try {
        const loaded = await getPublication(slug)
        if (!cancelled) setPublication(loaded)
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'This published story is unavailable.')
      }
    })
    return () => { cancelled = true }
  }, [params])

  if (error) return <main className="published-story-shell"><p className="marketplace-error">{error} <Link href="/story">Return to marketplace</Link></p></main>
  if (!publication?.manifest?.final_output) return <main className="published-story-shell"><p className="marketplace-status">Opening published story…</p></main>

  const output = publication.manifest.final_output
  return (
    <main className="published-story-shell">
      <nav className="library-nav"><Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link><Link className="back-home" href="/story"><span>←</span> Story marketplace</Link></nav>
      <article className="published-story">
        <p className="eyebrow"><span /> PUBLISHED ALTERNATE UNIVERSE</p>
        <h1>{publication.title}</h1>
        <section className="published-playback" aria-label="Published story playback">
          {output.playback.segments.map((segment) => segment.image_uri && segment.audio_uri ? <article key={segment.scene_id} className="published-scene">
            <p>SCENE {String(segment.scene_number).padStart(2, '0')}</p>
            {/* Published artifacts can be external object-storage URLs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mediaUrl(segment.image_uri)} alt={`Scene ${segment.scene_number}`} />
            <audio controls src={mediaUrl(segment.audio_uri)}>Scene {segment.scene_number} narration.</audio>
            <span>{segment.narration}</span>
          </article> : null)}
        </section>
        <section className="published-screenplay"><h2>Combined screenplay</h2><pre>{output.combined_screenplay}</pre></section>
      </article>
    </main>
  )
}
