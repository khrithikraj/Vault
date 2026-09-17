import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppBootstrap } from './AppBootstrap'
import { ErrorBoundary } from './components/ErrorBoundary'
import './styles/global.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache: 'none' + an explicit update() forces the browser to re-fetch
    // sw.js on every load instead of waiting for its throttled update check. Without
    // it a previously-installed worker can keep running an older script (e.g. one
    // missing the `push` handler), so reminder notifications never appear for any
    // reminder type until the browser happens to check for an update.
    void navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update())
      .catch(() => {
        // Non-fatal: the app is fully usable without the service worker.
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppBootstrap />
    </ErrorBoundary>
  </React.StrictMode>,
)
