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
  it('rendert Hinweistext (Dateien hier ablegen. oder Drop files… und Unterstützt/Supports)', () => {
    render(<UploadArea {...defaultProps} />);
    expect(screen.getByText(/Dateien hier ablegen\.|Drop your files here/)).toBeInTheDocument();
    expect(screen.getByText(/Unterstützt:.*xlsx|Supports:.*xlsx/i)).toBeInTheDocument();
  });

  it('zeigt den Durchsuchen-Link/Button (Dateiauswahl)', () => {
    render(<UploadArea {...defaultProps} />);
    expect(screen.getByLabelText(/Durchsuchen|Browse/i)).toBeInTheDocument();
  });
});
