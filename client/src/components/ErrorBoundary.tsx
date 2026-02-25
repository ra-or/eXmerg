import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t, getStoredLocale } from '../i18n';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary:', error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="min-h-screen bg-zinc-50 dark:bg-surface-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full card p-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
              {t(getStoredLocale(), 'error.title')}
            </h2>
            <p className="text-sm text-zinc-500 mb-4">{this.state.error.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="btn-secondary mx-auto">
              {t(getStoredLocale(), 'error.retry')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
