'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'

const systems = ['Canon mapped', 'Timeline fork created', 'Character memories restored', 'Relationships connected', 'Simulation clock started']

export default function WorldBootSequence({ worldName, theme, onComplete }: { worldName: string; theme: string; onComplete: () => void }) {
  const [connected, setConnected] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setConnected((value) => value < systems.length ? value + 1 : value), 330)
    const finish = window.setTimeout(onComplete, 2250)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(finish)
    }
  }, [onComplete])

  return (
    <main className={`simulation-boot world-theme-${theme}`}>
      <div className="boot-grid" />
      <Link href="/story" className="simulation-exit">Exit to books</Link>
      <motion.section className="world-launch" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="launch-orbit">
          <motion.i animate={{ rotate: 360 }} transition={{ duration: 4, ease: 'linear', repeat: Infinity }} />
          <span>*</span>
        </div>
        <p className="sim-eyebrow">ALTERNATE TIMELINE ESTABLISHED</p>
        <h1>{worldName}</h1>
        <p className="launch-copy">Autonomous characters are receiving their world state.</p>
        <div className="system-list">
          {systems.map((system, index) => (
            <motion.div key={system} animate={{ opacity: index < connected ? 1 : 0.25, x: 0 }} initial={{ x: -8 }}>
              <span>{index < connected ? 'OK' : '--'}</span>{system}
            </motion.div>
          ))}
        </div>
        <p className="launch-status"><i /> Simulation clock begins at Tick 1</p>
      </motion.section>
    </main>
  )
}
