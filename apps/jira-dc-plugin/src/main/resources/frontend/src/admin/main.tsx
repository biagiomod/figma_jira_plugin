import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminPage } from './AdminPage'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AdminPage />
    </StrictMode>,
  )
}
