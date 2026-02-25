import { describe, it, expect } from 'vitest';
import { sortFileList, generateOutputFilename, type FileItem } from './useStore';

function fileItem(overrides: Partial<FileItem> & { filename: string; id: string }): FileItem {
  return {
    filename: overrides.filename,
    id: overrides.id,
    file: overrides.file,
    size: overrides.size,
    lastModified: overrides.lastModified,
  };
}

describe('sortFileList', () => {
  const files: FileItem[] = [
    fileItem({ filename: 'c.xlsx', id: '1', size: 100, lastModified: 1000 }),
    fileItem({ filename: 'a.xlsx', id: '2', size: 300, lastModified: 2000 }),
    fileItem({ filename: 'b.xlsx', id: '3', size: 200, lastModified: 1500 }),
  ];

  it('uploadOrder gibt Reihenfolge unverändert zurück (neue Referenz)', () => {
    const result = sortFileList(files, 'uploadOrder');
    expect(result).not.toBe(files);
    expect(result.map((f) => f.filename)).toEqual(['c.xlsx', 'a.xlsx', 'b.xlsx']);
  });

  it('filename sortiert natürlich (numeric)', () => {
    const result = sortFileList(files, 'filename');
    expect(result.map((f) => f.filename)).toEqual(['a.xlsx', 'b.xlsx', 'c.xlsx']);
  });

  it('alphabetical sortiert nach localeCompare', () => {
    const result = sortFileList(files, 'alphabetical');
    expect(result.map((f) => f.filename)).toEqual(['a.xlsx', 'b.xlsx', 'c.xlsx']);
  });

  it('sizeAsc / sizeDesc', () => {
    expect(sortFileList(files, 'sizeAsc').map((f) => f.size)).toEqual([100, 200, 300]);
    expect(sortFileList(files, 'sizeDesc').map((f) => f.size)).toEqual([300, 200, 100]);
  });

  it('dateNewest / dateOldest', () => {
    expect(sortFileList(files, 'dateNewest').map((f) => f.lastModified)).toEqual([2000, 1500, 1000]);
    expect(sortFileList(files, 'dateOldest').map((f) => f.lastModified)).toEqual([1000, 1500, 2000]);
  });

  it('ein oder kein Element: Kopie, keine Änderung', () => {
    const one = [fileItem({ filename: 'x.xlsx', id: '1' })];
    expect(sortFileList(one, 'filename')).toHaveLength(1);
    expect(sortFileList([], 'filename')).toEqual([]);
  });
});

describe('generateOutputFilename', () => {
  it('leere Liste → merged.xlsx / merged.ods', () => {
    expect(generateOutputFilename([], 'xlsx')).toBe('merged.xlsx');
    expect(generateOutputFilename([], 'ods')).toBe('merged.ods');
  });

  it('eine Datei: Basisname + _merged', () => {
    expect(generateOutputFilename([fileItem({ filename: 'Report.xlsx', id: '1' })], 'xlsx')).toBe('Report_merged.xlsx');
    expect(generateOutputFilename([fileItem({ filename: 'Data.ods', id: '1' })], 'ods')).toBe('Data_merged.ods');
  });

  it('Datum im Namen: Monat Jahr oder Datumsbereich', () => {
    const withDate = [fileItem({ filename: 'Bericht_01.02.2024.xlsx', id: '1' })];
    expect(generateOutputFilename(withDate, 'xlsx')).toContain('merged');
    expect(generateOutputFilename(withDate, 'xlsx')).toMatch(/\.xlsx$/);
  });

  it('mehrere Dateien ohne gemeinsames Datum: gemeinsamer Präfix wenn vorhanden', () => {
    const two = [
      fileItem({ filename: 'Export_Jan.xlsx', id: '1' }),
      fileItem({ filename: 'Export_Feb.xlsx', id: '2' }),
    ];
    const name = generateOutputFilename(two, 'xlsx');
    expect(name).toContain('merged');
    expect(name).toBe('Export_merged.xlsx');
  });
});
