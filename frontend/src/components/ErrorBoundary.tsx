import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
  info: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
    this.setState({ info })
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          maxWidth: 900,
          margin: '40px auto',
          padding: 24,
          background: '#1a1215',
          border: '1px solid #7f1d1d',
          borderRadius: 12,
          color: '#fecaca',
          fontFamily: 'ui-monospace, monospace',
          fontSize: 13,
        }}>
          <h2 style={{ color: '#f87171', marginTop: 0 }}>⚠️ Erro de runtime</h2>
          <p style={{ color: '#fca5a5' }}>
            <strong>{this.state.error.name}:</strong> {this.state.error.message}
          </p>
          {this.state.error.stack && (
            <pre style={{
              whiteSpace: 'pre-wrap',
              fontSize: 12,
              lineHeight: 1.5,
              maxHeight: 400,
              overflow: 'auto',
              background: '#0f1218',
              padding: 12,
              borderRadius: 6,
            }}>
              {this.state.error.stack.split('\n').slice(0, 8).join('\n')}
            </pre>
          )}
          <button
            onClick={() => { this.setState({ error: null, info: null }) }}
            style={{
              background: '#7f1d1d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              marginTop: 12,
            }}
          >
            Tentar de novo
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
