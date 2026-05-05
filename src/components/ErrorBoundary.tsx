import { Component, type ReactNode } from 'react'
import { Modal, TitleBar, Frame } from '@react95/core'

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
      try { localStorage.removeItem(key) } catch { /* private mode */ }
    }
    window.location.href = window.location.origin + window.location.pathname
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div style={pageStyle}>
        <Modal
          width="460px"
          title="Error - Texas Flush'em"
          icon={<span style={{ fontSize: 14, marginRight: 4 }}>!</span>}
          titleBarOptions={[<TitleBar.Close key="close" onClick={this.handleReset} />]}
          buttons={[{ value: 'Reset and reload', onClick: this.handleReset }]}
          buttonsAlignment="flex-end"
          dragOptions={{ defaultPosition: { x: 0, y: 0 } }}
        >
          <Modal.Content boxShadow="none" bgColor="$material" p="$8">
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px' }}>
              Something broke
            </h2>
            <p style={{ fontSize: 12, margin: '0 0 12px', lineHeight: 1.5 }}>
              The app hit an unexpected error. This usually happens after an update if your
              saved game data is no longer compatible.
            </p>
            <Frame
              bgColor="$inputBackground"
              boxShadow="$in"
              p="$6"
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                color: '#a00',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                marginBottom: 12,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {this.state.error.message}
              {this.state.error.stack && '\n\n' + this.state.error.stack}
            </Frame>
            <p style={{ fontSize: 11, color: '#444', margin: 0 }}>
              (Clears your saved session, name, and game settings.)
            </p>
          </Modal.Content>
        </Modal>
      </div>
    )
  }
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
}
