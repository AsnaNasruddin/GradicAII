import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error:', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 max-w-sm w-full p-8 text-center">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" strokeWidth={2} />
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 mb-6">
            An unexpected error occurred. Reloading the page usually fixes this.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-primary hover:bg-primary-dark text-white font-semibold py-2.5 rounded-xl text-sm inline-flex items-center justify-center gap-2 transition"
          >
            <RotateCcw className="w-4 h-4" strokeWidth={2} /> Reload Page
          </button>
        </div>
      </div>
    )
  }
}
