import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FigmaPanel } from './FigmaPanel'

/**
 * Panel entry point.
 * Reads the Jira issue key from the URL query string (?issueKey=PROJ-123).
 * The Velocity template injects this when constructing the iframe src URL.
 */
const params = new URLSearchParams(window.location.search)
const issueKey = params.get('issueKey') ?? ''

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FigmaPanel issueKey={issueKey} />
    </StrictMode>,
  )
}
