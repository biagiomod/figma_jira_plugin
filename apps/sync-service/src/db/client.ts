import { Kysely, PostgresDialect } from 'kysely'
import { Pool } from 'pg'
import { getSecrets } from '../lib/secrets.js'
import type {
  DesignLinksTable,
  SyncStateTable,
  WebhookRegistrationsTable,
  AuditEventsTable,
} from './schema.js'

/**
 * Kysely database interface — one entry per table.
 * Used to type all queries throughout the codebase.
 */
export interface Database {
  design_links: DesignLinksTable
  sync_state: SyncStateTable
  webhook_registrations: WebhookRegistrationsTable
  audit_events: AuditEventsTable
}

let db: Kysely<Database> | null = null

/**
 * Returns the singleton Kysely instance.
 * Lazily initialised on first call — reused across Lambda warm invocations.
 *
 * Uses a small pg connection pool (max 5). Lambda functions run one request
 * at a time per instance; the pool handles connection reuse without exhausting
 * RDS connection limits.
 */
export async function getDb(): Promise<Kysely<Database>> {
  if (db) return db

  const secrets = await getSecrets()

  const pool = new Pool({
    connectionString: secrets.dbConnectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })

  db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  })

  return db
}

/** Clears the DB singleton. Used in tests. */
export function clearDbInstance(): void {
  db = null
}
