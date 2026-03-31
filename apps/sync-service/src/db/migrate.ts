/**
 * Migration runner — execute with:
 *   pnpm --filter sync-service migrate
 *
 * Reads DB_CONNECTION_STRING from env (or .env.local in local dev).
 * Applies all SQL files in migrations/ in lexicographic order.
 * Safe to run repeatedly — all migrations use IF NOT EXISTS / DO $$ BEGIN ... END $$.
 *
 * This script runs outside Lambda. Never import it from handler code.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const { Client } = pg

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dirname, 'migrations')

async function run(): Promise<void> {
  const connectionString = process.env['DB_CONNECTION_STRING']
  if (!connectionString) {
    throw new Error('DB_CONNECTION_STRING environment variable is required')
  }

  const client = new Client({ connectionString })
  await client.connect()

  console.log('Connected to database')

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const filePath = join(migrationsDir, file)
    const sql = readFileSync(filePath, 'utf-8')

    console.log(`Applying migration: ${file}`)
    await client.query(sql)
    console.log(`  Done: ${file}`)
  }

  await client.end()
  console.log('All migrations applied successfully')
}

run().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
