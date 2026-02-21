import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadArea } from './UploadArea';

describe('UploadArea', () => {
  it('rendert Hinweistext (Dateien hierher ziehen oder Drag files here)', () => {
    render(<UploadArea />);
    expect(screen.getByText(/Dateien hierher ziehen|Drag files here/i)).toBeInTheDocument();
  });

  it('zeigt den Durchsuchen-Link/Button (Dateiauswahl)', () => {
    render(<UploadArea />);
    expect(screen.getByLabelText(/Durchsuchen|Browse/i)).toBeInTheDocument();
  });
});
