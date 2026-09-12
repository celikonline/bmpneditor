import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message?: string }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, message: error.message } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workflow Studio error boundary', error, info) }
  render() {
    if (!this.state.hasError) return this.props.children
    return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f9fb', color: '#344b60', fontFamily: 'Inter, sans-serif' }}><section style={{ width: 420, background: '#fff', border: '1px solid #e2e8ee', borderRadius: 10, padding: 28, boxShadow: '0 8px 30px rgba(30,55,77,.1)' }}><h1 style={{ margin: 0, fontSize: 20 }}>Workflow Studio recovered from an error</h1><p style={{ color: '#81909e', fontSize: 13, lineHeight: 1.6 }}>Your local draft remains protected. Reload the page to restart the editor.</p><small style={{ color: '#b05a62' }}>{this.state.message}</small><button style={{ display: 'block', marginTop: 18, background: '#1976d2', color: '#fff', padding: '9px 13px', borderRadius: 5, border: 0, cursor: 'pointer' }} onClick={() => window.location.reload()}>Reload editor</button></section></main>
  }
}
