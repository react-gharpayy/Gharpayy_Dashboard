import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children:   ReactNode;
  fallback?:  ReactNode;
  context?:   string;          // e.g. "Pipeline", "Conversations"
}

interface State {
  hasError:   boolean;
  error:      Error | null;
  errorInfo:  ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // ── Sentry integration placeholder ─────────────────────
    // When you add Sentry, replace this block:
    //
    // import * as Sentry from '@sentry/react';
    // Sentry.captureException(error, {
    //   extra: {
    //     componentStack: errorInfo.componentStack,
    //     context: this.props.context,
    //   },
    // });
    //
    console.error(
      `[ErrorBoundary${this.props.context ? ` — ${this.props.context}` : ''}]`,
      error,
      errorInfo.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-8 rounded-xl border border-destructive/20 bg-destructive/5 gap-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle size={18} />
          <span className="font-display font-semibold text-sm">
            {this.props.context
              ? `${this.props.context} failed to load`
              : 'Something went wrong'}
          </span>
        </div>

        {import.meta.env.DEV && this.state.error && (
          <pre className="text-[10px] text-destructive/70 bg-destructive/5 rounded-lg p-3 max-w-full overflow-auto max-h-32 w-full">
            {this.state.error.message}
          </pre>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={this.handleReset}
          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <RefreshCw size={12} /> Try Again
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;

// ── Usage ──────────────────────────────────────────────────
//
// Wrap entire app in main.tsx:
// <ErrorBoundary context="App">
//   <App />
// </ErrorBoundary>
//
// Wrap individual sections:
// <ErrorBoundary context="Pipeline">
//   <PipelineKanban />
// </ErrorBoundary>
