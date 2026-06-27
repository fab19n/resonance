// apps/web/src/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

// Supabase Shared Pooler URL (port 6543) — not the direct connection (5432).
// prepare: false is required for the pooler's Transaction mode.
const client = postgres(process.env.DATABASE_URL, { prepare: false })

export const db = drizzle({ client, schema })

/** The transaction handle passed to db.transaction(async (tx) => …). */
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0]
