import { describe, it, expect } from 'vitest';
import { matchesSheetName } from './mergeService.js';
import type { SheetNameFilter } from './mergeService.js';

describe('matchesSheetName', () => {
  it('exact match (case insensitive by default)', () => {
    const filter: SheetNameFilter = { mode: 'include', values: ['Tabelle1'] };
    expect(matchesSheetName('Tabelle1', filter)).toBe(true);
    expect(matchesSheetName('tabelle1', filter)).toBe(true);
    expect(matchesSheetName('Tabelle2', filter)).toBe(false);
  });

  it('contains match', () => {
    const filter: SheetNameFilter = { mode: 'include', values: ['Jan'], match: 'contains' };
    expect(matchesSheetName('Januar', filter)).toBe(true);
    expect(matchesSheetName('Dezember', filter)).toBe(false);
  });

  it('regex match', () => {
    const filter: SheetNameFilter = { mode: 'include', values: ['^Sheet\\d+$'], match: 'regex' };
    expect(matchesSheetName('Sheet1', filter)).toBe(true);
    expect(matchesSheetName('Sheet42', filter)).toBe(true);
    expect(matchesSheetName('MySheet1', filter)).toBe(false);
  });
});
