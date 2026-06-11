import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'IT SOUNDS // TERMINAL MASTER v2.0',
  description: 'Music festival card game playtest build',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
