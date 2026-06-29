// apps/web/src/lib/mappers.ts
import type { ResonancePostDTO } from '@resonance/shared'
import { resonancePosts } from '@/db/schema'

export function postToDTO(row: typeof resonancePosts.$inferSelect): ResonancePostDTO {
  return {
    id: row.id,
    userId: row.userId,
    isrc: row.isrc,
    momentStartMs: row.momentStartMs,
    momentEndMs: row.momentEndMs ?? null,
    focusType: row.focusType,
    subLayer: row.subLayer ?? null,
    sensoryTags: row.sensoryTags ?? null,
    lyricText: row.lyricText ?? null,
    reflection: row.reflection,
    createdAt: row.createdAt.toISOString(),
  }
}
