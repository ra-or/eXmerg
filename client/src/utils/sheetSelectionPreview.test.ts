import { describe, it, expect } from 'vitest';
import { matchesSheetName, type SheetNameFilterOption } from 'shared';
import { evaluateSheetSelection, type FileMeta } from './sheetSelectionPreview';

describe('matchesSheetName', () => {
  it('exact match (case insensitive by default)', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['Tabelle1'] };
    expect(matchesSheetName('Tabelle1', filter)).toBe(true);
    expect(matchesSheetName('tabelle1', filter)).toBe(true);
    expect(matchesSheetName('Tabelle2', filter)).toBe(false);
  });

  it('contains match', () => {
    const filter: SheetNameFilterOption = {
      mode: 'include',
      values: ['Jan'],
      match: 'contains',
    };
    expect(matchesSheetName('Januar', filter)).toBe(true);
    expect(matchesSheetName('Dezember', filter)).toBe(false);
  });

  it('exclude mode wird nur für Filterlogik genutzt, matchesSheetName prüft nur Treffer', () => {
    const filter: SheetNameFilterOption = { mode: 'exclude', values: ['Intern'] };
    expect(matchesSheetName('Intern', filter)).toBe(true);
    expect(matchesSheetName('Öffentlich', filter)).toBe(false);
  });

  it('regex match', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['^Sheet\\d+$'], match: 'regex' };
    expect(matchesSheetName('Sheet1', filter)).toBe(true);
    expect(matchesSheetName('Sheet42', filter)).toBe(true);
    expect(matchesSheetName('Sheet', filter)).toBe(false);
    expect(matchesSheetName('MySheet1', filter)).toBe(false);
  });

  it('caseSensitive: exact', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['Data'], caseSensitive: true };
    expect(matchesSheetName('Data', filter)).toBe(true);
    expect(matchesSheetName('data', filter)).toBe(false);
  });
});

describe('evaluateSheetSelection', () => {
  const files: FileMeta[] = [
    {
      id: 'f1',
      filename: 'a.xlsx',
      sheets: [
        { name: 'Sheet1', index: 0 },
        { name: 'Sheet2', index: 1 },
      ],
    },
    { id: 'f2', filename: 'b.xlsx', sheets: [{ name: 'Data', index: 0 }] },
  ];

  it('mode "all" zählt alle Sheets', () => {
    const result = evaluateSheetSelection(files, { mode: 'all' });
    expect(result.totalSheets).toBe(3);
    expect(result.matchedSheets).toBe(3);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].matchedSheets).toBe(2);
    expect(result.files[1].matchedSheets).toBe(1);
  });

  it('mode "first" nimmt nur das erste Sheet pro Datei', () => {
    const result = evaluateSheetSelection(files, { mode: 'first' });
    expect(result.matchedSheets).toBe(2);
    expect(result.files[0].matchedSheets).toBe(1);
    expect(result.files[1].matchedSheets).toBe(1);
  });

  it('leere Dateiliste liefert 0', () => {
    const result = evaluateSheetSelection([], undefined);
    expect(result.totalSheets).toBe(0);
    expect(result.matchedSheets).toBe(0);
    expect(result.files).toHaveLength(0);
  });

  it('sheetNameFilter include: nur passende Sheets zählen', () => {
    const result = evaluateSheetSelection(files, {
      mode: 'all',
      sheetNameFilter: { mode: 'include', values: ['Sheet1', 'Data'], match: 'exact' },
    });
    expect(result.matchedSheets).toBe(2); // Sheet1 aus f1, Data aus f2
    expect(result.files[0].matchedSheets).toBe(1);
    expect(result.files[1].matchedSheets).toBe(1);
  });

  it('sheetNameFilter exclude: passende Sheets abziehen', () => {
    const result = evaluateSheetSelection(files, {
      mode: 'all',
      sheetNameFilter: { mode: 'exclude', values: ['Sheet2'], match: 'exact' },
    });
    expect(result.matchedSheets).toBe(2);
    expect(result.files[0].matchedSheets).toBe(1);
  });

  it('selectedSheetsByFile: nur ausgewählte Indizes pro Datei', () => {
    const result = evaluateSheetSelection(files, {
      mode: 'selected',
      selectedSheetsByFile: { 'a.xlsx': [0], 'b.xlsx': [0] },
    });
    expect(result.matchedSheets).toBe(2);
    expect(result.files[0].matchedSheets).toBe(1);
    expect(result.files[1].matchedSheets).toBe(1);
  });
});
