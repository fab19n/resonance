// apps/web/app/api/conversations/[id]/messages/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { sendMessage } from '@/services/conversationService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const b = json as Record<string, unknown>
  if (typeof b.body !== 'string' || b.body.trim().length === 0) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }
  if (b.body.length > 2000) {
    return NextResponse.json({ error: 'Message is too long (max 2000 characters)' }, { status: 400 })
  }

  const result = await sendMessage(id, user.id, b.body.trim())
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.message, { status: 201 })
}
