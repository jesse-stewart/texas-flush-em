import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import original from 'react95/dist/themes/original'
import '@react95/core/GlobalStyle'
import '@react95/core/themes/win95.css'
import './win95-overrides.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { CardBackProvider } from './contexts/CardBackContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={original}>
      <ErrorBoundary>
        <CardBackProvider>
          <App />
        </CardBackProvider>
      </ErrorBoundary>
    </ThemeProvider>
  </StrictMode>
)
