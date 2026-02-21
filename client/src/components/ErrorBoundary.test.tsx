import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

function Thrower({ message }: { message: string }) {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rendert Kinder wenn kein Fehler', () => {
    render(
      <ErrorBoundary>
        <span data-testid="child">OK</span>
      </ErrorBoundary>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('OK');
  });

  it('zeigt Fehler-UI und Retry-Button wenn Kind wirft', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Thrower message="Testfehler" />
      </ErrorBoundary>
    );
    expect(screen.getByText('Testfehler')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
