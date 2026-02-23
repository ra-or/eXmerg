/**
 * Tests for shared generateWorksheetName utility.
 */
import { describe, it, expect } from 'vitest';
import {
  generateWorksheetName,
  sanitizeWorksheetName,
  truncateWorksheetName,
  ensureUniqueWorksheetName,
  WORKSHEET_NAME_MAX_LENGTH,
} from 'shared';

describe('sanitizeWorksheetName', () => {
  it('removes forbidden characters [] : * ? / \\', () => {
    expect(sanitizeWorksheetName('Sheet[1]')).toBe('Sheet_1_');
    expect(sanitizeWorksheetName('A:B')).toBe('A_B');
    expect(sanitizeWorksheetName('a*b?c/d\\e')).toBe('a_b_c_d_e');
  });

  it('trims leading and trailing spaces', () => {
    expect(sanitizeWorksheetName('  Name  ')).toBe('Name');
  });

  it('returns fallback "Sheet" when empty after sanitize', () => {
    expect(sanitizeWorksheetName('')).toBe('Sheet');
    expect(sanitizeWorksheetName('   ')).toBe('Sheet');
    expect(sanitizeWorksheetName('???')).toBe('Sheet');
  });
});

describe('truncateWorksheetName', () => {
  it('returns name unchanged when length <= 31', () => {
    const short = 'ShortName';
    expect(truncateWorksheetName(short)).toBe(short);
    expect(truncateWorksheetName('A'.repeat(31))).toBe('A'.repeat(31));
  });

  it('truncates long "file – sheet" preserving file part and adds ellipsis', () => {
    const result = truncateWorksheetName('VeryLongFileName – PivotTable_2024');
    expect(result.length).toBeLessThanOrEqual(WORKSHEET_NAME_MAX_LENGTH);
    expect(result).toContain('VeryLongFileName');
    expect(result).toContain('…');
    expect(result).toBe('VeryLongFileName – PivotTabl…');
  });

  it('truncates simple long name with ellipsis', () => {
    const long = 'A'.repeat(40);
    const result = truncateWorksheetName(long);
    expect(result.length).toBe(31);
    expect(result.endsWith('…')).toBe(true);
  });

  it('never returns empty', () => {
    expect(truncateWorksheetName('')).toBe('Sheet');
  });
});

describe('ensureUniqueWorksheetName', () => {
  it('returns name as-is when not in set', () => {
    const used = new Set<string>();
    expect(ensureUniqueWorksheetName('Data', used)).toBe('Data');
  });

  it('appends (2), (3) for duplicates', () => {
    const used = new Set<string>(['Report', 'Report (2)']);
    expect(ensureUniqueWorksheetName('Report', used)).toBe('Report (3)');
  });

  it('truncates when base + suffix would exceed 31 chars', () => {
    const long = 'A'.repeat(28); // 28 + " (2)" = 32
    const used = new Set<string>([long]);
    const result = ensureUniqueWorksheetName(long, used);
    expect(result.length).toBeLessThanOrEqual(WORKSHEET_NAME_MAX_LENGTH);
    expect(result).toMatch(/ \(2\)$/);
  });
});

describe('generateWorksheetName', () => {
  it('single sheet → file base name only', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: 'Report',
      sheetName: 'Sheet1',
      sheetCountInFile: 1,
      existingNames: used,
    });
    expect(name).toBe('Report');
  });

  it('multi sheet → "fileBaseName – sheetName"', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: 'Data',
      sheetName: 'January',
      sheetCountInFile: 3,
      existingNames: used,
    });
    expect(name).toBe('Data – January');
  });

  it('duplicate names get (2), (3)', () => {
    const used = new Set<string>();
    const a = generateWorksheetName({
      fileBaseName: 'X',
      sheetName: 'S',
      sheetCountInFile: 1,
      existingNames: used,
    });
    used.add(a);
    const b = generateWorksheetName({
      fileBaseName: 'X',
      sheetName: 'S',
      sheetCountInFile: 1,
      existingNames: used,
    });
    used.add(b);
    const c = generateWorksheetName({
      fileBaseName: 'X',
      sheetName: 'S',
      sheetCountInFile: 1,
      existingNames: used,
    });
    expect(a).toBe('X');
    expect(b).toBe('X (2)');
    expect(c).toBe('X (3)');
  });

  it('very long names get proper truncation', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: 'VeryLongFileName',
      sheetName: 'PivotTable_2024',
      sheetCountInFile: 2,
      existingNames: used,
    });
    expect(name.length).toBeLessThanOrEqual(WORKSHEET_NAME_MAX_LENGTH);
    expect(name).toContain('VeryLongFileName');
    expect(name).toContain('…');
  });

  it('forbidden characters are removed', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: 'Report[2024]',
      sheetName: 'Q1:Summary',
      sheetCountInFile: 2,
      existingNames: used,
    });
    expect(name).not.toMatch(/[\[\]:*?/\\]/);
  });

  it('empty sheet name fallback → fileBaseName', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: 'OnlyFile',
      sheetName: '',
      sheetCountInFile: 2,
      existingNames: used,
    });
    expect(name).toBe('OnlyFile');
  });

  it('never returns empty name', () => {
    const used = new Set<string>();
    const name = generateWorksheetName({
      fileBaseName: '',
      sheetName: '',
      sheetCountInFile: 1,
      existingNames: used,
    });
    expect(name).toBe('Sheet');
  });
});
