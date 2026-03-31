-- =============================================================
-- Migration 001: Initial schema
-- Figma for Jira DC — sync-service database
--
-- Run via: pnpm --filter sync-service migrate
-- This migration is idempotent (uses IF NOT EXISTS / CREATE TYPE IF NOT EXISTS).
-- =============================================================

-- ---------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('FILE', 'FRAME', 'PROTOTYPE', 'FIGJAM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE design_status AS ENUM ('NONE', 'IN_PROGRESS', 'READY_FOR_DEV', 'CHANGES_AFTER_DEV');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM (
    'LINK_CREATED',
    'LINK_DELETED',
    'STATUS_CHANGED',
    'SYNC_COMPLETED',
    'DESIGN_CHANGED',
    'WEBHOOK_RECEIVED',
    'WEBHOOK_REGISTERED',
    'WEBHOOK_DEREGISTERED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------
-- design_links
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS design_links (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key           VARCHAR(64)  NOT NULL,
  figma_url           TEXT         NOT NULL,
  figma_file_key      VARCHAR(128) NOT NULL,
  figma_node_id       VARCHAR(128),                         -- NULL = file-level link
  resource_type       resource_type NOT NULL,
  design_status       design_status NOT NULL DEFAULT 'NONE',
  file_name           TEXT         NOT NULL DEFAULT '',
  node_name           TEXT,
  thumbnail_s3_key    TEXT,                                 -- NULL = no thumbnail yet
  last_modified_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  linked_by_jira_user VARCHAR(256) NOT NULL DEFAULT '',
  linked_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ                           -- NULL = active (soft delete)
);

-- Primary lookup: all links for an issue
CREATE INDEX IF NOT EXISTS idx_design_links_issue_key
  ON design_links (issue_key);

-- Webhook fanout: all links for a Figma file
CREATE INDEX IF NOT EXISTS idx_design_links_figma_file_key
  ON design_links (figma_file_key);

-- Logical deduplication: prevent linking the same Figma resource to the same
-- issue twice, regardless of URL variation (different slugs, node-id formats).
-- Only applies to active (non-deleted) rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_design_links_unique_active
  ON design_links (issue_key, figma_file_key, COALESCE(figma_node_id, ''), resource_type)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------
-- sync_state
-- ---------------------------------------------------------------
-- 1:1 with design_links. Created in the same transaction.
-- The UNIQUE constraint on design_link_id enforces the 1:1 relationship
-- at the database level.

CREATE TABLE IF NOT EXISTS sync_state (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_link_id    UUID         NOT NULL REFERENCES design_links(id),
  last_synced_at    TIMESTAMPTZ,
  next_sync_at      TIMESTAMPTZ,                            -- polling sweep target
  sync_status       sync_status  NOT NULL DEFAULT 'PENDING',
  sync_error        TEXT,
  sync_error_code   VARCHAR(32),                            -- FIGMA_429 | FIGMA_403 | etc.
  change_detected_at TIMESTAMPTZ,
  sync_attempts     INTEGER      NOT NULL DEFAULT 0,

  CONSTRAINT sync_state_design_link_id_unique UNIQUE (design_link_id)
);

-- Polling sweep index — no WHERE predicate so PENDING rows (newly created,
-- next_sync_at = NOW()) are also picked up on the first sweep.
CREATE INDEX IF NOT EXISTS idx_sync_state_next_sync_at
  ON sync_state (next_sync_at);

-- ---------------------------------------------------------------
-- webhook_registrations
-- ---------------------------------------------------------------
-- One row per figma_file_key. Tracks active Figma webhook registrations.

CREATE TABLE IF NOT EXISTS webhook_registrations (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  figma_file_key           VARCHAR(128) NOT NULL,
  figma_webhook_id         VARCHAR(256),                   -- NULL if registration failed
  is_active                BOOLEAN      NOT NULL DEFAULT FALSE,
  registered_at            TIMESTAMPTZ,
  last_event_received_at   TIMESTAMPTZ,
  last_registration_error  TEXT,

  CONSTRAINT webhook_registrations_file_key_unique UNIQUE (figma_file_key)
);

-- ---------------------------------------------------------------
-- audit_events
-- ---------------------------------------------------------------
-- Append-only. Never updated or soft-deleted.

CREATE TABLE IF NOT EXISTS audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      audit_event_type NOT NULL,
  design_link_id  UUID REFERENCES design_links(id),
  issue_key       VARCHAR(64),
  jira_user       VARCHAR(256),
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link-level audit history
CREATE INDEX IF NOT EXISTS idx_audit_events_link
  ON audit_events (design_link_id, created_at);

-- Issue-level audit history (spans multiple links for same issue)
CREATE INDEX IF NOT EXISTS idx_audit_events_issue
  ON audit_events (issue_key, created_at);
