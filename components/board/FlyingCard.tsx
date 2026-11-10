'use client'
import { motion } from 'motion/react'
import type { Flight } from '@/lib/fx/runner'
import Card from './Card'

// A card travelling between two anchors: drawn at its destination size, offset back
// to where it came from, then released along an arc with a small spin.
export default function FlyingCard({ f }: { f: Flight }) {
  const dx = f.from.left - f.to.left, dy = f.from.top - f.to.top
  const s = f.to.width > 0 ? f.from.width / f.to.width : 1
  const lift = Math.min(80, Math.abs(dy) * 0.25 + 30)
  return (
    <motion.div className="flying-card" data-testid="flying-card" aria-hidden="true"
      style={{ left: f.to.left, top: f.to.top, width: f.to.width, height: f.to.height, transformOrigin: '0 0' }}
      initial={{ x: dx, y: dy, scale: s, rotate: -8 }}
      animate={{ x: [dx, dx * 0.5, 0], y: [dy, Math.min(dy, 0) * 0.5 - lift, 0], scale: [s, ((s + 1) / 2) * 1.08, 1], rotate: [-8, 4, 0] }}
      transition={{ duration: f.ms / 1000, ease: 'easeOut', times: [0, 0.55, 1] }}>
      <div className="field-card-inner" style={{ width: '100%', height: '100%' }}>
        <Card card={f.card} genre={f.genre} size="field" />
      </div>
    </motion.div>
  )
}
