import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useStore } from '../store/useStore';
import { FileList } from './FileList';

describe('FileList', () => {
  beforeEach(() => {
    useStore.getState().reset();
    useStore.setState({
      files: [{ id: 'test-1', filename: 'test.xlsx' }],
      sheetInfo: {},
    });
  });

  it('rendert bei mindestens einer Datei Sortier-Label (Merge-Reihenfolge)', () => {
    render(<FileList />);
    expect(screen.getByText(/Merge-Reihenfolge|Merge order/i)).toBeInTheDocument();
  });

  it('zeigt die Sortier-Dropdown (combobox)', () => {
    render(<FileList />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
  });
});
