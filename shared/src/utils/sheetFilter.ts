import type { SheetNameFilterOption } from '../types/merge.js';

const DEFAULT_MATCH: NonNullable<SheetNameFilterOption['match']> = 'exact';
const DEFAULT_CASE_SENSITIVE = false;

/**
 * Prüft, ob ein Sheet-Name zum Filter passt.
 * Defaults: match = 'exact', caseSensitive = false.
 * Gemeinsam genutzt von Client (Live-Vorschau) und Server (collectSheetSources).
 */
export function matchesSheetName(sheetName: string, filter: SheetNameFilterOption): boolean {
  const match = filter.match ?? DEFAULT_MATCH;
  const caseSensitive = filter.caseSensitive ?? DEFAULT_CASE_SENSITIVE;
  const name = caseSensitive ? sheetName : sheetName.toLowerCase();
  const values = filter.values;

  for (const raw of values) {
    const value = caseSensitive ? raw : raw.toLowerCase();
    let hit = false;
    if (match === 'exact') {
      hit = name === value;
    } else if (match === 'contains') {
      hit = name.includes(value);
    } else if (match === 'regex') {
      try {
        const re = new RegExp(value, caseSensitive ? '' : 'i');
        hit = re.test(sheetName);
      } catch {
        hit = false;
      }
    }
    if (hit) return true;
  }
  return false;
}
