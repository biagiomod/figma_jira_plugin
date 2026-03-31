import { useState, useEffect } from 'react'

/**
 * Admin configuration page for the Figma integration.
 * Allows admins to set the AWS API Gateway URL and API key.
 *
 * This page is served via a Jira servlet (not as an iframe).
 * It calls the Jira admin REST endpoints to read/write plugin config.
 *
 * TODO: Wire this to the Java admin servlet once it is implemented.
 *       Currently shows a placeholder UI. The Java servlet will expose:
 *         GET  /plugins/servlet/figma-jira/admin/config
 *         POST /plugins/servlet/figma-jira/admin/config
 */

interface Config {
  apiGatewayUrl: string
  apiKey: string
}

export function AdminPage() {
  const [config, setConfig] = useState<Config>({ apiGatewayUrl: '', apiKey: '' })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // TODO: Load existing config from servlet endpoint on mount
  // useEffect(() => { fetch('/plugins/servlet/figma-jira/admin/config').then(...) }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')

    try {
      // TODO: Replace with actual servlet POST call
      // await fetch('/plugins/servlet/figma-jira/admin/config', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(config),
      // })
      await new Promise((r) => setTimeout(r, 500))  // placeholder
      setStatus('saved')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save configuration.')
    }
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.heading}>Figma Integration — Admin Configuration</h2>
      <p style={styles.description}>
        Configure the connection between Jira and the Figma sync service hosted in AWS.
        You will need the API Gateway URL and API key from your AWS deployment.
      </p>

      <form onSubmit={(e) => void handleSave(e)} style={styles.form}>
        <div style={styles.field}>
          <label htmlFor="apiGatewayUrl" style={styles.label}>
            AWS API Gateway URL
          </label>
          <input
            id="apiGatewayUrl"
            type="url"
            value={config.apiGatewayUrl}
            onChange={(e) => setConfig((c) => ({ ...c, apiGatewayUrl: e.target.value }))}
            placeholder="https://xxx.execute-api.us-east-1.amazonaws.com/v1"
            style={styles.input}
            required
          />
          <small style={styles.hint}>
            Found in CDK stack outputs as <code>ApiGatewayUrl</code>.
          </small>
        </div>

        <div style={styles.field}>
          <label htmlFor="apiKey" style={styles.label}>
            API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={config.apiKey}
            onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))}
            placeholder="••••••••••••••••"
            style={styles.input}
            required
            autoComplete="off"
          />
          <small style={styles.hint}>
            Retrieve from AWS Console under API Gateway &gt; API Keys.
            Store securely — this value is stored in Jira plugin configuration.
          </small>
        </div>

        <div style={styles.actions}>
          <button type="submit" style={styles.saveBtn} disabled={status === 'saving'}>
            {status === 'saving' ? 'Saving…' : 'Save configuration'}
          </button>

          {status === 'saved' && (
            <span style={styles.successMsg}>Configuration saved successfully.</span>
          )}
          {status === 'error' && (
            <span style={styles.errorMsg}>{errorMsg}</span>
          )}
        </div>
      </form>

      <div style={styles.infoBox}>
        <strong>Setup checklist:</strong>
        <ol style={{ marginTop: '8px', paddingLeft: '20px' }}>
          <li>Deploy the CDK stack from <code>apps/sync-service/infra/</code></li>
          <li>Populate the Secrets Manager secret with your Figma service token and DB credentials</li>
          <li>Run DB migrations: <code>pnpm --filter sync-service migrate</code></li>
          <li>Copy the <code>ApiGatewayUrl</code> and API key from CDK outputs into this form</li>
          <li>Register the Figma webhook URL (<code>ApiGatewayUrl/webhooks/figma</code>) in your Figma team settings</li>
        </ol>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: { maxWidth: '600px', margin: '32px auto', padding: '0 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', fontSize: '14px', color: '#172B4D' },
  heading: { fontSize: '20px', fontWeight: 600, marginBottom: '8px' },
  description: { color: '#42526E', marginBottom: '24px', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontWeight: 600, fontSize: '14px' },
  input: { padding: '8px 10px', border: '2px solid #DFE1E6', borderRadius: '4px', fontSize: '14px', width: '100%' },
  hint: { color: '#6B778C', fontSize: '12px' },
  actions: { display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' },
  saveBtn: { padding: '8px 20px', backgroundColor: '#0052CC', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  successMsg: { color: '#00875A', fontSize: '13px' },
  errorMsg: { color: '#DE350B', fontSize: '13px' },
  infoBox: { marginTop: '32px', padding: '16px', backgroundColor: '#DEEBFF', borderRadius: '4px', lineHeight: 1.6 },
}
