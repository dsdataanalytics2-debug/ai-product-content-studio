import { Component } from 'react'
import { AlertTriangle, RotateCw, Clipboard } from 'lucide-react'

/**
 * Wraps each route. Shows the error, a Reload button, and Copy error details —
 * because the thing you actually want when a screen white-screens is the stack
 * on your clipboard, not a shrug.
 */
export default class ErrorBoundary extends Component {
  state = { error: null, info: null, copied: false }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Intentionally unconditional: a render crash is not DEBUG-gated noise.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  copyDetails = async () => {
    const details = [
      `Error: ${this.state.error?.message ?? 'unknown'}`,
      `Route: ${window.location.hash || window.location.pathname}`,
      `When: ${new Date().toISOString()}`,
      `UA: ${navigator.userAgent}`,
      '',
      this.state.error?.stack ?? '',
      '',
      'Component stack:',
      this.state.info?.componentStack ?? '(unavailable)',
    ].join('\n')

    try {
      await navigator.clipboard.writeText(details)
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } catch {
      // Clipboard can be blocked by permissions policy. Fall back to a prompt
      // so the details are still recoverable by hand.
      window.prompt('Copy the error details:', details)
    }
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="h-full grid place-items-center p-6">
        <div className="card elev-md max-w-lg w-full p-6">
          <div className="flex items-start gap-3">
            <div
              className="grid place-items-center w-9 h-9 rounded-[var(--radius-lg)] shrink-0"
              style={{
                background: 'color-mix(in srgb, var(--color-danger) 15%, transparent)',
                color: 'var(--color-danger-text)',
              }}
            >
              <AlertTriangle className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold">This screen hit an error</h1>
              <p className="text-[12.5px] text-dim leading-relaxed mt-1.5">
                Your saved scripts are untouched — they live in this browser&apos;s storage, not in
                this screen. Reload to recover.
              </p>
            </div>
          </div>

          <pre
            className="mt-4 p-3 rounded-[var(--radius-md)] text-[11.5px] font-mono overflow-x-auto whitespace-pre-wrap"
            style={{
              background: 'var(--color-neutral-900)',
              border: '1px solid var(--color-divider)',
              color: 'var(--text-dim)',
            }}
          >
            {this.state.error.message || String(this.state.error)}
          </pre>

          <div className="flex items-center gap-2 mt-4">
            <button
              type="button"
              className="btn btn-primary px-4 py-2 text-sm"
              onClick={() => window.location.reload()}
            >
              <RotateCw className="w-4 h-4" /> Reload
            </button>
            <button
              type="button"
              className="btn btn-secondary px-4 py-2 text-sm"
              onClick={this.copyDetails}
            >
              <Clipboard className="w-4 h-4" />
              {this.state.copied ? 'Copied' : 'Copy error details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
