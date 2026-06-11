import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { ctx, playerBoard, aiBoard } = await req.json() as {
      ctx: string
      playerBoard: string
      aiBoard: string
    }

    const prompt = `You are the AI opponent in a music festival card game "IT SOUNDS TERMINAL MASTER".
Give one punchy in-character commentary line (max 18 words) about your ${ctx} phase move.
Player stages: ${playerBoard}. Your stages: ${aiBoard}.
Be competitive and music-themed. No quotes.`

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 60,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('')
      .trim()

    return NextResponse.json({ text })
  } catch (err) {
    console.error('Commentary API error:', err)
    return NextResponse.json({ text: 'My algorithms are running hot. Your crowd is already mine.' })
  }
}
