import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Vite config for the Jira panel React frontend.
 *
 * Two entry points:
 *   - panel/index.html  → the Figma Designs issue panel (served in iframe)
 *   - admin/index.html  → the admin configuration page
 *
 * Output lands in ../static/ which is picked up by the Maven build as a
 * web resource and bundled into the plugin JAR.
 *
 * For local development (without Jira):
 *   pnpm dev   → starts Vite dev server with mock API (see src/panel/api.mock.ts)
 *   The panel reads ?issueKey=PROJ-123 from the URL.
 */
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../static',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'src/panel/index.html'),
        admin: resolve(__dirname, 'src/admin/index.html'),
      },
    },
  },
  // Base path when served as a Jira web resource
  // The actual path is injected by the Velocity template
  base: './',
})
