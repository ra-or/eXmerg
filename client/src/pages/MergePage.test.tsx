import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MergePage } from './MergePage';

const queryClient = new QueryClient();

function renderMergePage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MergePage />
    </QueryClientProvider>
  );
}

describe('MergePage', () => {
  it('rendert ohne Fehler und zeigt App-Titel eXmerg', () => {
    renderMergePage();
    expect(screen.getByRole('heading', { name: /eXmerg/i })).toBeInTheDocument();
  });

  it('zeigt den Zusammenführen-Button (ActionBar)', () => {
    renderMergePage();
    const mergeButtons = screen.getAllByRole('button').filter(
      (btn) => /^(Zusammenführen|Merge)$/i.test(btn.textContent?.trim() ?? '')
    );
    expect(mergeButtons.length).toBeGreaterThanOrEqual(1);
  });
});
