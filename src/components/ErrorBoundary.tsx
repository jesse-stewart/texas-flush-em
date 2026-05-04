import { Component, type ReactNode } from 'react'

// Keys the app writes to localStorage. Listed here so the error recovery flow
// can wipe them — broken saved state from a prior deploy is the most common
// cause of a blank-page-on-load.
const APP_LOCALSTORAGE_KEYS = ['flushem_session', 'flushem_settings', 'flushem_name']

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error:', error, info)
  }

  handleReset = () => {
    for (const key of APP_LOCALSTORAGE_KEYS) {
      try { localStorage.removeItem(key) } catch { /* private mode — ignore */ }
    }
    window.location.href = window.location.origin + window.location.pathname
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={styles.title}>Something broke</h1>
          <p style={styles.subtitle}>
            The app hit an unexpected error. This usually happens after an update if your saved
            game data is no longer compatible.
          </p>
          <pre style={styles.errorText}>{this.state.error.message}</pre>
          <button style={styles.btn} onClick={this.handleReset}>
            Reset and reload
          </button>
          <p style={styles.note}>
            (Clears your saved session, name, and game settings.)
          </p>
        </div>
      </div>
    )
  }
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f4c2a',
    fontFamily: 'system-ui, sans-serif',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: '32px 40px',
    maxWidth: 460,
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 22,
    fontWeight: 800,
    color: '#1a1a1a',
  },
  subtitle: {
    margin: '0 0 16px',
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 1.5,
  },
  errorText: {
    backgroundColor: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    padding: '8px 12px',
    fontSize: 12,
    color: '#991b1b',
    fontFamily: 'monospace',
    overflow: 'auto',
    margin: '0 0 16px',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  btn: {
    padding: '10px 20px',
    fontSize: 15,
    fontWeight: 600,
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    backgroundColor: '#16a34a',
    color: '#fff',
  },
  note: {
    margin: '12px 0 0',
    fontSize: 12,
    color: '#9ca3af',
  },
}
