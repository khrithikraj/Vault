import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { BrandIcon } from '../lib/icons'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

// Class component required: React error boundaries have no hook equivalent.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in Raj\u2019s Vault:', error, info.componentStack)
  }

  handleReload = () => {
    this.setState({ error: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <main className="relative flex min-h-screen items-center justify-center bg-cloud p-6">
          <div className="term-panel term-brackets w-full max-w-md rounded p-7 text-center">
            <p className="flex justify-center">
              <BrandIcon icon={AlertTriangle} size={32} tone="warn" />
            </p>
            <h1 className="mt-3 text-xl font-bold uppercase tracking-tight">
              Something went sideways.
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Raj&apos;s Vault hit an unexpected error. Your saved items are safe — reloading
              usually fixes this.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="term-btn-primary mt-5 w-full rounded-full px-4 py-2.5 text-sm font-medium uppercase tracking-widest"
            >
              Reload
            </button>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
