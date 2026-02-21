/**
 * Tests für shared types/files: getExtension, isSpreadsheetFile, isAllowedFile.
 */
import { describe, it, expect } from 'vitest';
import { getExtension, isSpreadsheetFile, isAllowedFile, ALLOWED_EXTENSIONS } from 'shared';

describe('getExtension', () => {
  it('gibt Kleinbuchstaben-Extension zurück', () => {
    expect(getExtension('file.xlsx')).toBe('.xlsx');
    expect(getExtension('file.XLSX')).toBe('.xlsx');
    expect(getExtension('path/to/file.ods')).toBe('.ods');
  });

  it('gibt leeren String wenn keine Extension', () => {
    expect(getExtension('noext')).toBe('');
  });
});

describe('isSpreadsheetFile / isAllowedFile', () => {
  it('akzeptiert .xlsx, .xls, .ods', () => {
    expect(isSpreadsheetFile('a.xlsx')).toBe(true);
    expect(isSpreadsheetFile('b.xls')).toBe(true);
    expect(isSpreadsheetFile('c.ods')).toBe(true);
    expect(isAllowedFile('a.xlsx')).toBe(true);
  });

  it('lehnt andere Formate ab', () => {
    expect(isSpreadsheetFile('d.csv')).toBe(false);
    expect(isAllowedFile('e.pdf')).toBe(false);
  });
});

describe('ALLOWED_EXTENSIONS', () => {
  it('enthält die erwarteten Formate', () => {
    expect(ALLOWED_EXTENSIONS).toContain('.xlsx');
    expect(ALLOWED_EXTENSIONS).toContain('.xls');
    expect(ALLOWED_EXTENSIONS).toContain('.ods');
    expect(ALLOWED_EXTENSIONS).toHaveLength(3);
  });
});
