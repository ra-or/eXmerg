import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UploadArea } from './UploadArea';

const defaultProps = {
  validateAndAdd: () => {},
  full: false,
  isDragOver: false,
  fileCount: 0,
};

describe('UploadArea', () => {
  it('rendert Titel (Dateien hinzufügen / Add files) und Unterstützt/Supports', () => {
    render(<UploadArea {...defaultProps} />);
    expect(screen.getByText(/Dateien hinzufügen|Add files/)).toBeInTheDocument();
    expect(screen.getByText(/Unterstützt:.*xlsx|Supports:.*xlsx/i)).toBeInTheDocument();
  });

  it('zeigt den Durchsuchen-Link/Button (Dateiauswahl)', () => {
    render(<UploadArea {...defaultProps} />);
    expect(screen.getByLabelText(/Durchsuchen|Browse/i)).toBeInTheDocument();
  });
});
