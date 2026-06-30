// apps/web/app/api/conversations/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import type { ConversationsListResponse } from '@resonance/shared'
import { getAuthedUser } from '@/lib/requireUser'
import { createConversation, listConversationsForUser } from '@/services/conversationService'

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conversations = await listConversationsForUser(user.id)
  const body: ConversationsListResponse = { conversations }
  return NextResponse.json(body)
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = json as Record<string, unknown>
  if (typeof b.matchId !== 'string' || b.matchId.length === 0) {
    return NextResponse.json({ error: 'matchId is required' }, { status: 400 })
  }
  if (typeof b.body !== 'string' || b.body.trim().length === 0) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }
  if (b.body.length > 2000) {
    return NextResponse.json({ error: 'Message is too long (max 2000 characters)' }, { status: 400 })
  }

  const result = await createConversation(user.id, b.matchId, b.body.trim())

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, existingConversationId: result.existingConversationId },
      { status: result.status },
    )
  }

  return NextResponse.json(result.conversation, { status: 201 })
}
