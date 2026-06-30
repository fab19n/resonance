// apps/web/app/api/conversations/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAuthedUser } from '@/lib/requireUser'
import { getConversationDetail } from '@/services/conversationService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await getConversationDetail(id, user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.detail)
}
