import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@react95/core/GlobalStyle'
import '@react95/core/themes/win95.css'
import './win95-overrides.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
