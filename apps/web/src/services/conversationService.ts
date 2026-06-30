// apps/web/src/services/conversationService.ts
//
// Core chat logic. Conversations are one-per-user-pair, opt-in, no expiry.
//
// Lifecycle:
//   pending → initiator sent an opener, recipient hasn't replied. Sits
//             indefinitely — no expiry. Only the recipient can reply or
//             ignore; the initiator cannot send a second message while
//             pending (must wait for a reply).
//   active  → recipient replied once. Free messaging both ways from here.
//
// New matches between two users with an existing conversation append an
// anchor rather than creating a second thread:
//   pending → anchor appended silently, no notification
//   active  → anchor appended, BOTH users notified ('new_match_anchor')

import { and, desc, eq, gt, ne, or } from 'drizzle-orm'
import { db, type Transaction } from '@/db'
import {
  conversations, conversationAnchors, messages, notifications,
  postMatches, resonancePosts, tracks, users,
} from '@/db/schema'
import { postToDTO } from '@/lib/mappers'
import type {
  ConversationStatus, ConversationSummaryDTO, ConversationDetailDTO,
  ConversationAnchorDTO, MessageDTO, MatchAnchorDTO, MatchDetailResponse, UserRef,
} from '@resonance/shared'

// db and a transaction handle share the same query-building surface in
// Drizzle, so read helpers can accept either.
type Queryable = typeof db | Transaction

type ServiceError = { ok: false; error: string; status: number }
type ServiceOk<T> = { ok: true } & T

// ── Canonical pair ordering ──────────────────────────────────────────────

function orderPair(idA: string, idB: string): [string, string] {
  return idA < idB ? [idA, idB] : [idB, idA]
}

export async function findConversationBetween(
  q: Queryable,
  userIdA: string,
  userIdB: string,
): Promise<typeof conversations.$inferSelect | null> {
  const [a, b] = orderPair(userIdA, userIdB)
  const [row] = await q
    .select()
    .from(conversations)
    .where(and(eq(conversations.userAId, a), eq(conversations.userBId, b)))
    .limit(1)
  return row ?? null
}

// ── Match-time hook ───────────────────────────────────────────────────────
// Called from matchingService.persistMatchesAndNotify for every match found.
// Returns conversation context so the caller can enrich the API response and
// decide whether to send the standard 'new_match' notification.

export interface MatchConversationResult {
  conversationId: string | null
  conversationStatus: ConversationStatus | null
}

export async function attachMatchToConversation(
  tx: Transaction,
  newPosterId: string,
  otherUserId: string,
  matchId: string,
): Promise<MatchConversationResult> {
  const existing = await findConversationBetween(tx, newPosterId, otherUserId)
  if (!existing) {
    return { conversationId: null, conversationStatus: null }
  }

  await tx
    .insert(conversationAnchors)
    .values({ conversationId: existing.id, matchId })
    .onConflictDoNothing()

  if (existing.status === 'active') {
    await tx.insert(notifications).values([
      { userId: newPosterId, type: 'new_match_anchor', matchId, conversationId: existing.id },
      { userId: otherUserId, type: 'new_match_anchor', matchId, conversationId: existing.id },
    ])
  }
  // pending → silent, no notification. Recipient sees it when they next open
  // the (still pending) thread.

  return { conversationId: existing.id, conversationStatus: existing.status as ConversationStatus }
}

// ── Anchor + detail builders ──────────────────────────────────────────────

async function buildMatchAnchor(
  q: Queryable,
  matchId: string,
  viewerId: string,
): Promise<MatchAnchorDTO | null> {
  const [match] = await q.select().from(postMatches).where(eq(postMatches.id, matchId)).limit(1)
  if (!match) return null

  const [postA] = await q.select().from(resonancePosts).where(eq(resonancePosts.id, match.postAId)).limit(1)
  const [postB] = await q.select().from(resonancePosts).where(eq(resonancePosts.id, match.postBId)).limit(1)
  if (!postA || !postB) return null

  const myPost = postA.userId === viewerId ? postA : postB
  const theirPost = postA.userId === viewerId ? postB : postA

  const [track] = await q.select().from(tracks).where(eq(tracks.isrc, myPost.isrc)).limit(1)
  if (!track) return null

  return {
    matchId: match.id,
    track: { isrc: track.isrc, title: track.title, artist: track.artist, albumArt: track.albumArt },
    myPost: postToDTO(myPost),
    theirPost: postToDTO(theirPost),
    matchTier: match.matchTier as 0 | 1,
  }
}

function toUserRef(u: typeof users.$inferSelect): UserRef {
  return { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
}

async function buildConversationDetail(
  q: Queryable,
  conversationId: string,
  viewerId: string,
): Promise<ConversationDetailDTO | null> {
  const [convo] = await q.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)
  if (!convo) return null

  const otherUserId = convo.userAId === viewerId ? convo.userBId : convo.userAId
  const [otherUser] = await q.select().from(users).where(eq(users.id, otherUserId)).limit(1)
  if (!otherUser) return null

  const messageRows = await q
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)

  const appendedAnchors = await q
    .select()
    .from(conversationAnchors)
    .where(eq(conversationAnchors.conversationId, conversationId))
    .orderBy(conversationAnchors.createdAt)

  // The conversation's own anchorMatchId is the first anchor; appended ones follow.
  const allMatchIds = [convo.anchorMatchId, ...appendedAnchors.map((a) => a.matchId)]
  const anchorDTOs: ConversationAnchorDTO[] = []
  for (const matchId of allMatchIds) {
    const anchor = await buildMatchAnchor(q, matchId, viewerId)
    if (!anchor) continue
    const appended = appendedAnchors.find((a) => a.matchId === matchId)
    anchorDTOs.push({
      id: matchId,
      anchor,
      createdAt: (appended?.createdAt ?? convo.createdAt).toISOString(),
    })
  }

  return {
    id: convo.id,
    otherUser: toUserRef(otherUser),
    status: convo.status as ConversationStatus,
    isInitiator: convo.initiatorId === viewerId,
    messages: messageRows.map((m): MessageDTO => ({
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
    anchors: anchorDTOs,
    createdAt: convo.createdAt.toISOString(),
  }
}

// ── Create (the opt-in request) ──────────────────────────────────────────

export async function createConversation(
  initiatorId: string,
  matchId: string,
  body: string,
): Promise<ServiceOk<{ conversation: ConversationDetailDTO }> | (ServiceError & { existingConversationId?: string })> {
  return db.transaction(async (tx) => {
    const [match] = await tx.select().from(postMatches).where(eq(postMatches.id, matchId)).limit(1)
    if (!match) return { ok: false, error: 'Match not found', status: 404 }

    const [postA] = await tx.select().from(resonancePosts).where(eq(resonancePosts.id, match.postAId)).limit(1)
    const [postB] = await tx.select().from(resonancePosts).where(eq(resonancePosts.id, match.postBId)).limit(1)
    if (!postA || !postB) return { ok: false, error: 'Match posts not found', status: 404 }

    let otherUserId: string
    if (postA.userId === initiatorId) otherUserId = postB.userId
    else if (postB.userId === initiatorId) otherUserId = postA.userId
    else return { ok: false, error: 'You are not part of this match', status: 403 }

    const existing = await findConversationBetween(tx, initiatorId, otherUserId)
    if (existing) {
      return {
        ok: false,
        error: 'A conversation already exists with this person',
        status: 409,
        existingConversationId: existing.id,
      }
    }

    const [a, b] = orderPair(initiatorId, otherUserId)
    const [conversation] = await tx
      .insert(conversations)
      .values({ userAId: a, userBId: b, initiatorId, anchorMatchId: matchId, status: 'pending' })
      .returning()
    if (!conversation) throw new Error('Failed to create conversation')

    await tx.insert(messages).values({ conversationId: conversation.id, senderId: initiatorId, body })

    await tx.insert(notifications).values({
      userId: otherUserId,
      type: 'conversation_request',
      conversationId: conversation.id,
    })

    const detail = await buildConversationDetail(tx, conversation.id, initiatorId)
    if (!detail) throw new Error('Failed to build conversation detail after creation')

    return { ok: true, conversation: detail }
  })
}

// ── List ──────────────────────────────────────────────────────────────────

export async function listConversationsForUser(userId: string): Promise<ConversationSummaryDTO[]> {
  const rows = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)))

  const summaries: ConversationSummaryDTO[] = []

  for (const convo of rows) {
    const isRecipient = convo.initiatorId !== userId
    // Soft-hidden requests never appear in the recipient's list. The
    // initiator still sees it as sent — no signal that it was ignored.
    if (isRecipient && convo.ignoredAt) continue

    const otherUserId = convo.userAId === userId ? convo.userBId : convo.userAId
    const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId)).limit(1)
    if (!otherUser) continue

    const [lastMessage] = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convo.id))
      .orderBy(desc(messages.createdAt))
      .limit(1)

    const myLastRead = convo.userAId === userId ? convo.lastReadAtA : convo.lastReadAtB
    const unreadConditions = [eq(messages.conversationId, convo.id), ne(messages.senderId, userId)]
    if (myLastRead) unreadConditions.push(gt(messages.createdAt, myLastRead))
    const unreadRows = await db.select().from(messages).where(and(...unreadConditions))

    summaries.push({
      id: convo.id,
      otherUser: toUserRef(otherUser),
      status: convo.status as ConversationStatus,
      isInitiator: convo.initiatorId === userId,
      lastMessage: lastMessage
        ? { body: lastMessage.body, senderId: lastMessage.senderId, createdAt: lastMessage.createdAt.toISOString() }
        : null,
      unreadCount: unreadRows.length,
      createdAt: convo.createdAt.toISOString(),
    })
  }

  summaries.sort((a, b) => {
    const aTime = new Date(a.lastMessage?.createdAt ?? a.createdAt).getTime()
    const bTime = new Date(b.lastMessage?.createdAt ?? b.createdAt).getTime()
    return bTime - aTime
  })

  return summaries
}

// ── Detail (marks read) ──────────────────────────────────────────────────

export async function getConversationDetail(
  conversationId: string,
  viewerId: string,
): Promise<ServiceOk<{ detail: ConversationDetailDTO }> | ServiceError> {
  return db.transaction(async (tx) => {
    const [convo] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)
    if (!convo) return { ok: false, error: 'Conversation not found', status: 404 }
    if (convo.userAId !== viewerId && convo.userBId !== viewerId) {
      return { ok: false, error: 'You are not part of this conversation', status: 403 }
    }

    if (convo.userAId === viewerId) {
      await tx.update(conversations).set({ lastReadAtA: new Date() }).where(eq(conversations.id, conversationId))
    } else {
      await tx.update(conversations).set({ lastReadAtB: new Date() }).where(eq(conversations.id, conversationId))
    }

    const detail = await buildConversationDetail(tx, conversationId, viewerId)
    if (!detail) return { ok: false, error: 'Conversation not found', status: 404 }

    return { ok: true, detail }
  })
}

// ── Send message ──────────────────────────────────────────────────────────

export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ServiceOk<{ message: MessageDTO }> | ServiceError> {
  return db.transaction(async (tx) => {
    const [convo] = await tx.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)
    if (!convo) return { ok: false, error: 'Conversation not found', status: 404 }
    if (convo.userAId !== senderId && convo.userBId !== senderId) {
      return { ok: false, error: 'You are not part of this conversation', status: 403 }
    }

    if (convo.status === 'pending') {
      if (convo.initiatorId === senderId) {
        return { ok: false, error: 'Wait for a reply before sending another message', status: 400 }
      }
      // The recipient's first reply accepts the conversation.
      await tx.update(conversations).set({ status: 'active' }).where(eq(conversations.id, conversationId))
      await tx.insert(notifications).values({
        userId: convo.initiatorId,
        type: 'conversation_accepted',
        conversationId: convo.id,
      })
    }

    const [message] = await tx.insert(messages).values({ conversationId, senderId, body }).returning()
    if (!message) throw new Error('Failed to insert message')

    return {
      ok: true,
      message: {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      },
    }
  })
}

// ── Ignore (recipient only, soft-hide) ───────────────────────────────────

export async function ignoreConversation(
  conversationId: string,
  userId: string,
): Promise<ServiceOk<object> | ServiceError> {
  const [convo] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1)
  if (!convo) return { ok: false, error: 'Conversation not found', status: 404 }
  if (convo.initiatorId === userId) {
    return { ok: false, error: 'Only the recipient can dismiss a request', status: 403 }
  }
  if (convo.userAId !== userId && convo.userBId !== userId) {
    return { ok: false, error: 'You are not part of this conversation', status: 403 }
  }
  await db.update(conversations).set({ ignoredAt: new Date() }).where(eq(conversations.id, conversationId))
  return { ok: true }
}

// ── Match detail (earlier poster's entry point) ──────────────────────────

export async function getMatchDetail(
  matchId: string,
  viewerId: string,
): Promise<ServiceOk<{ detail: MatchDetailResponse }> | ServiceError> {
  const anchor = await buildMatchAnchor(db, matchId, viewerId)
  if (!anchor) return { ok: false, error: 'Match not found', status: 404 }
  if (anchor.myPost.userId !== viewerId) {
    return { ok: false, error: 'You are not part of this match', status: 403 }
  }

  const otherUserId = anchor.theirPost.userId
  const [otherUser] = await db.select().from(users).where(eq(users.id, otherUserId)).limit(1)
  if (!otherUser) return { ok: false, error: 'Other user not found', status: 404 }

  const existing = await findConversationBetween(db, viewerId, otherUserId)

  return {
    ok: true,
    detail: {
      matchId: anchor.matchId,
      track: anchor.track,
      myPost: anchor.myPost,
      theirPost: anchor.theirPost,
      matchTier: anchor.matchTier,
      otherUser: toUserRef(otherUser),
      conversationId: existing?.id ?? null,
      conversationStatus: (existing?.status as ConversationStatus) ?? null,
    },
  }
}
