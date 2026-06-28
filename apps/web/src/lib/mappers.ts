// apps/web/src/lib/mappers.ts
import type { ResonancePostDTO } from '@resonance/shared'
import { resonancePosts } from '@/db/schema'

export function postToDTO(row: typeof resonancePosts.$inferSelect): ResonancePostDTO {
  return {
    id: row.id,
    userId: row.userId,
    isrc: row.isrc,
    progressMs: row.progressMs,
    focusType: row.focusType,
    sensoryTags: row.sensoryTags ?? null,
    reflection: row.reflection,
    createdAt: row.createdAt.toISOString(),
  }
}
