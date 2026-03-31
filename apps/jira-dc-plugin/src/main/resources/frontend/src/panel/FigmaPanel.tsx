import { useEffect, useState, useCallback } from 'react'
import type { LinkDto, DesignStatus } from '@figma-jira/shared-types'

/**
 * The base path for the Jira REST proxy.
 * All API calls go to /rest/figma-jira/1.0/... (same origin as Jira).
 * The proxy forwards them to AWS with the API key attached.
 */
const API_BASE = '/rest/figma-jira/1.0'

type PanelState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; links: LinkDto[] }

interface Props {
  issueKey: string
}

export function FigmaPanel({ issueKey }: Props) {
  const [state, setState] = useState<PanelState>({ status: 'loading' })
  const [addUrl, setAddUrl] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    if (!issueKey) {
      setState({ status: 'error', message: 'No issue key provided.' })
      return
    }

    setState({ status: 'loading' })
    try {
      const res = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}/links`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: { message?: string } }
        throw new Error(body.error?.message ?? `HTTP ${res.status}`)
      }
      const data = await res.json() as { links: LinkDto[] }
      setState({ status: 'ready', links: data.links })
      notifyResize()
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load designs.',
      })
    }
  }, [issueKey])

  useEffect(() => { void loadLinks() }, [loadLinks])

  async function handleAddLink() {
    if (!addUrl.trim()) return
    setIsAdding(true)
    setAddError(null)

    try {
      const res = await fetch(`${API_BASE}/issues/${encodeURIComponent(issueKey)}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ figma_url: addUrl.trim() }),
      })

      const body = await res.json() as LinkDto | { error?: { message?: string } }

      if (!res.ok) {
        const errBody = body as { error?: { message?: string } }
        throw new Error(errBody.error?.message ?? `HTTP ${res.status}`)
      }

      setAddUrl('')
      await loadLinks()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add design link.')
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDelete(linkId: string) {
    try {
      await fetch(
        `${API_BASE}/issues/${encodeURIComponent(issueKey)}/links/${encodeURIComponent(linkId)}`,
        { method: 'DELETE' },
      )
      await loadLinks()
    } catch {
      // TODO: Show inline error on the card
    }
  }

  async function handleStatusChange(linkId: string, status: DesignStatus) {
    try {
      await fetch(
        `${API_BASE}/issues/${encodeURIComponent(issueKey)}/links/${encodeURIComponent(linkId)}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        },
      )
      await loadLinks()
    } catch {
      // TODO: Show inline error
    }
  }

  async function handleRefresh(linkId: string) {
    try {
      await fetch(
        `${API_BASE}/issues/${encodeURIComponent(issueKey)}/links/${encodeURIComponent(linkId)}/sync`,
        { method: 'POST' },
      )
      await loadLinks()
    } catch {
      // TODO: Show inline error
    }
  }

  if (state.status === 'loading') {
    return <div style={styles.loading}>Loading Figma designs…</div>
  }

  if (state.status === 'error') {
    return (
      <div style={styles.error}>
        <strong>Error:</strong> {state.message}
        <button style={styles.retryBtn} onClick={() => void loadLinks()}>Retry</button>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Link list */}
      {state.links.length === 0 ? (
        <div style={styles.empty}>No Figma designs linked yet.</div>
      ) : (
        <div style={styles.linkList}>
          {state.links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {/* Add link form */}
      <div style={styles.addForm}>
        <input
          type="url"
          placeholder="Paste a Figma URL…"
          value={addUrl}
          onChange={(e) => setAddUrl(e.target.value)}
          style={styles.urlInput}
          disabled={isAdding}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAddLink() }}
        />
        <button
          style={styles.addBtn}
          onClick={() => void handleAddLink()}
          disabled={isAdding || !addUrl.trim()}
        >
          {isAdding ? 'Adding…' : 'Add'}
        </button>
        {addError && <div style={styles.addError}>{addError}</div>}
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// LinkCard
// -----------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  NONE: 'None',
  IN_PROGRESS: 'In progress',
  READY_FOR_DEV: 'Ready for dev',
  CHANGES_AFTER_DEV: 'Changes after dev',
}

const STATUS_COLORS: Record<string, string> = {
  NONE: '#6B778C',
  IN_PROGRESS: '#0052CC',
  READY_FOR_DEV: '#00875A',
  CHANGES_AFTER_DEV: '#FF8B00',
}

interface LinkCardProps {
  link: LinkDto
  onDelete: (linkId: string) => void
  onStatusChange: (linkId: string, status: DesignStatus) => void
  onRefresh: (linkId: string) => void
}

function LinkCard({ link, onDelete, onStatusChange, onRefresh }: LinkCardProps) {
  const [imgError, setImgError] = useState(false)
  const [thumbSrc, setThumbSrc] = useState(link.thumbnail_signed_url)

  async function handleImgError() {
    // Signed URL may have expired — re-fetch link data for a fresh URL
    // TODO: Implement re-fetch on img error (Phase 1 hardening)
    setImgError(true)
  }

  return (
    <div style={styles.card}>
      {/* Thumbnail */}
      <div style={styles.thumbContainer}>
        {thumbSrc && !imgError ? (
          <img
            src={thumbSrc}
            alt={link.node_name ?? link.file_name}
            style={styles.thumb}
            onError={() => void handleImgError()}
          />
        ) : (
          <div style={styles.thumbPlaceholder}>
            <FigmaIcon />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div style={styles.cardBody}>
        <div style={styles.cardTitle}>
          <a href={link.figma_url} target="_blank" rel="noopener noreferrer" style={styles.titleLink}>
            {link.node_name ?? link.file_name}
          </a>
          <span style={styles.resourceType}>{link.resource_type}</span>
        </div>

        <div style={styles.cardMeta}>
          {link.file_name !== (link.node_name ?? link.file_name) && (
            <span style={styles.fileName}>{link.file_name}</span>
          )}
          {link.last_synced_at && (
            <span style={styles.syncedAt}>
              Synced {formatRelativeTime(link.last_synced_at)}
            </span>
          )}
        </div>

        {/* Status badge + selector */}
        <div style={styles.statusRow}>
          <span
            style={{
              ...styles.statusBadge,
              backgroundColor: STATUS_COLORS[link.design_status] ?? '#6B778C',
            }}
          >
            {STATUS_LABELS[link.design_status] ?? link.design_status}
          </span>
          <select
            value={link.design_status}
            onChange={(e) => onStatusChange(link.id, e.target.value as DesignStatus)}
            style={styles.statusSelect}
            aria-label="Change design status"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            style={styles.actionBtn}
            onClick={() => window.open(link.figma_url, '_blank', 'noopener,noreferrer')}
          >
            Open in Figma
          </button>
          <button style={styles.actionBtn} onClick={() => onRefresh(link.id)}>
            Refresh
          </button>
          <button
            style={{ ...styles.actionBtn, color: '#DE350B' }}
            onClick={() => {
              if (window.confirm('Remove this Figma design link?')) onDelete(link.id)
            }}
          >
            Unlink
          </button>
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

function notifyResize() {
  const height = document.body.scrollHeight
  window.parent.postMessage({ type: 'figma-jira-resize', height }, '*')
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function FigmaIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 24C10.2 24 12 22.2 12 20V16H8C5.8 16 4 17.8 4 20C4 22.2 5.8 24 8 24Z" fill="#0ACF83"/>
      <path d="M4 12C4 9.8 5.8 8 8 8H12V16H8C5.8 16 4 14.2 4 12Z" fill="#A259FF"/>
      <path d="M4 4C4 1.8 5.8 0 8 0H12V8H8C5.8 8 4 6.2 4 4Z" fill="#F24E1E"/>
      <path d="M12 0H16C18.2 0 20 1.8 20 4C20 6.2 18.2 8 16 8H12V0Z" fill="#FF7262"/>
      <path d="M20 12C20 14.2 18.2 16 16 16C13.8 16 12 14.2 12 12C12 9.8 13.8 8 16 8C18.2 8 20 9.8 20 12Z" fill="#1ABCFE"/>
    </svg>
  )
}

// -----------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: { padding: '12px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: '14px' },
  loading: { padding: '16px', color: '#6B778C', textAlign: 'center' },
  error: { padding: '12px', color: '#DE350B', backgroundColor: '#FFEBE6', borderRadius: '4px', marginBottom: '12px' },
  retryBtn: { marginLeft: '8px', cursor: 'pointer', padding: '2px 8px', fontSize: '12px' },
  empty: { padding: '12px', color: '#6B778C', textAlign: 'center', fontStyle: 'italic' },
  linkList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' },
  card: { display: 'flex', gap: '12px', padding: '12px', border: '1px solid #DFE1E6', borderRadius: '4px', backgroundColor: '#FAFBFC' },
  thumbContainer: { flexShrink: 0, width: '80px', height: '60px', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#F4F5F7', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' },
  thumbPlaceholder: { display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  titleLink: { fontWeight: 600, color: '#0052CC', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  resourceType: { fontSize: '11px', color: '#6B778C', backgroundColor: '#F4F5F7', padding: '1px 6px', borderRadius: '10px', flexShrink: 0 },
  cardMeta: { fontSize: '12px', color: '#6B778C', marginBottom: '6px' },
  fileName: { marginRight: '8px' },
  syncedAt: {},
  statusRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  statusBadge: { fontSize: '11px', color: '#fff', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 },
  statusSelect: { fontSize: '12px', padding: '2px', border: '1px solid #DFE1E6', borderRadius: '3px', cursor: 'pointer' },
  actions: { display: 'flex', gap: '8px' },
  actionBtn: { fontSize: '12px', padding: '3px 8px', border: '1px solid #DFE1E6', borderRadius: '3px', cursor: 'pointer', backgroundColor: '#fff', color: '#42526E' },
  addForm: { display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '8px', borderTop: '1px solid #DFE1E6' },
  urlInput: { flex: 1, minWidth: '200px', padding: '6px 8px', border: '1px solid #DFE1E6', borderRadius: '3px', fontSize: '14px' },
  addBtn: { padding: '6px 16px', backgroundColor: '#0052CC', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 },
  addError: { width: '100%', color: '#DE350B', fontSize: '12px' },
}
