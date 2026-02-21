/**
 * Tests für shared-Validation (validateExtension, getValidationErrorMessage).
 * Import über Workspace-Alias "shared".
 */
import { describe, it, expect } from 'vitest';
import {
  validateExtension,
  validateFileSize,
  validateTotalSize,
  getValidationErrorMessage,
} from 'shared';

describe('validateExtension', () => {
  it('akzeptiert .xlsx, .xls, .ods', () => {
    expect(validateExtension('a.xlsx')).toBe(true);
    expect(validateExtension('b.XLSX')).toBe(true);
    expect(validateExtension('c.xls')).toBe(true);
    expect(validateExtension('d.ods')).toBe(true);
  });

  it('lehnt andere Formate ab', () => {
    expect(validateExtension('e.csv')).toBe(false);
    expect(validateExtension('f.pdf')).toBe(false);
    expect(validateExtension('g')).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('akzeptiert Größe innerhalb des Limits', () => {
    expect(validateFileSize(100, 1000)).toBe(true);
    expect(validateFileSize(1000, 1000)).toBe(true);
  });

  it('lehnt zu große oder ungültige Größe ab', () => {
    expect(validateFileSize(1001, 1000)).toBe(false);
    expect(validateFileSize(0, 1000)).toBe(false);
  });
});

describe('validateTotalSize', () => {
  it('akzeptiert Gesamtgröße innerhalb des Limits', () => {
    expect(validateTotalSize(0, 5000)).toBe(true);
    expect(validateTotalSize(5000, 5000)).toBe(true);
  });

  it('lehnt überschrittene Gesamtgröße ab', () => {
    expect(validateTotalSize(5001, 5000)).toBe(false);
  });
});

describe('getValidationErrorMessage', () => {
  it('liefert Meldungen für extension, size, count, totalSize', () => {
    expect(getValidationErrorMessage('extension')).toContain('Dateiformat');
    expect(getValidationErrorMessage('size')).toContain('groß');
    expect(getValidationErrorMessage('count')).toContain('Dateien');
    expect(getValidationErrorMessage('totalSize')).toContain('Gesamtgröße');
  });

  it('kann optionale Limits in der Meldung anzeigen', () => {
    const msg = getValidationErrorMessage('size', {
      maxFileSizeBytes: 10 * 1024 * 1024,
      maxTotalSizeBytes: 50 * 1024 * 1024,
      maxFilesPerRequest: 20,
    });
    expect(msg).toContain('10 MB');
  });
});
