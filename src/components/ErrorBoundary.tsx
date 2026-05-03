import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackHint?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error)
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.fallbackTitle ?? '这一小块出了点小状况'
    const hint =
      this.props.fallbackHint ??
      '其它地方都还正常呀。点下面按钮再试一次，或者刷新页面就好啦。'

    return (
      <div className="error-boundary">
        <div className="error-boundary-card">
          <div className="error-boundary-title">🌸 {title}</div>
          <div className="error-boundary-hint">{hint}</div>
          {this.state.message && (
            <code className="error-boundary-detail">{this.state.message}</code>
          )}
          <button className="error-boundary-retry" onClick={this.handleReset}>
            再试一次
          </button>
        </div>
      </div>
    )
  }
}
