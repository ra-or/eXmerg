import { describe, it, expect } from 'vitest';
import { matchesSheetName } from 'shared';
import type { SheetNameFilterOption } from 'shared';

describe('matchesSheetName', () => {
  it('exact match (case insensitive by default)', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['Tabelle1'] };
    expect(matchesSheetName('Tabelle1', filter)).toBe(true);
    expect(matchesSheetName('tabelle1', filter)).toBe(true);
    expect(matchesSheetName('Tabelle2', filter)).toBe(false);
  });

  it('contains match', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['Jan'], match: 'contains' };
    expect(matchesSheetName('Januar', filter)).toBe(true);
    expect(matchesSheetName('Dezember', filter)).toBe(false);
  });

  it('regex match', () => {
    const filter: SheetNameFilterOption = { mode: 'include', values: ['^Sheet\\d+$'], match: 'regex' };
    expect(matchesSheetName('Sheet1', filter)).toBe(true);
    expect(matchesSheetName('Sheet42', filter)).toBe(true);
    expect(matchesSheetName('MySheet1', filter)).toBe(false);
  });
});
