/**
 * Live-Vorschau der Sheet-Auswahl ohne Datei-Laden oder Backend.
 * Verwendet nur vorhandene Sheet-Metadaten und aktuelle Optionen.
 */

export interface FileMeta {
  id: string;
  filename: string;
  sheets: { name: string; index: number }[];
}

export interface SheetNameFilterOption {
  mode: 'include' | 'exclude';
  values: string[];
  match?: 'exact' | 'contains' | 'regex';
  caseSensitive?: boolean;
}

/** Optionen wie im Backend (mode + pro-Datei oder global selectedSheets + Filter). */
export interface SheetCollectOptionsForPreview {
  mode?: 'all' | 'first' | 'selected';
  /** Bei mode === 'selected': Indizes pro Datei (filename → number[]). */
  selectedSheetsByFile?: Record<string, number[]>;
  /** Global bei mode === 'selected' (gleiche Indizes für jede Datei). */
  selectedSheets?: number[];
  sheetNameFilter?: SheetNameFilterOption;
}

const DEFAULT_MATCH: NonNullable<SheetNameFilterOption['match']> = 'exact';
const DEFAULT_CASE_SENSITIVE = false;

/**
 * Prüft, ob ein Sheet-Name zum Filter passt.
 * Gleiche Logik wie im Backend (mergeService.matchesSheetName).
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

export interface SheetSelectionResult {
  totalSheets: number;
  matchedSheets: number;
  files: {
    fileId: string;
    totalSheets: number;
    matchedSheets: number;
  }[];
}

/**
 * Ermittelt aus Datei-Metadaten und Optionen, wie viele Sheets nach
 * Modus und Filter übrig bleiben. Kein Datei-Laden, keine API.
 */
export function evaluateSheetSelection(
  files: FileMeta[],
  options: SheetCollectOptionsForPreview | undefined,
): SheetSelectionResult {
  const mode = options?.mode ?? 'all';
  const selectedSheetsByFile = options?.selectedSheetsByFile;
  const globalSelected = options?.selectedSheets;
  const filter = options?.sheetNameFilter;
  const hasFilter = (filter?.values?.length ?? 0) > 0;

  let totalSheetsAll = 0;
  let matchedSheets = 0;
  const fileResults: SheetSelectionResult['files'] = [];

  for (const file of files) {
    const sheets = file.sheets ?? [];
    const fileTotalSheets = sheets.length;
    totalSheetsAll += fileTotalSheets;

    if (sheets.length === 0) {
      fileResults.push({ fileId: file.id, totalSheets: 0, matchedSheets: 0 });
      continue;
    }

    let candidateIndices: number[];
    if (mode === 'first') {
      candidateIndices = [0];
    } else if (selectedSheetsByFile?.[file.filename]?.length) {
      const maxIdx = sheets.length - 1;
      candidateIndices = selectedSheetsByFile[file.filename]!.filter(
        (i) => Number.isInteger(i) && i >= 0 && i <= maxIdx,
      );
    } else if (mode === 'selected' && globalSelected?.length) {
      const maxIdx = sheets.length - 1;
      candidateIndices = globalSelected.filter(
        (i) => Number.isInteger(i) && i >= 0 && i <= maxIdx,
      );
    } else {
      candidateIndices = sheets.map((s) => s.index);
    }

    let afterFilter = 0;
    for (const idx of candidateIndices) {
      const sheet = sheets.find((s) => s.index === idx) ?? sheets[idx];
      if (!sheet) continue;
      const name = sheet.name ?? `Sheet${idx + 1}`;
      if (hasFilter && filter && (filter.values?.length ?? 0) > 0) {
        const matches = matchesSheetName(name, filter);
        if (filter.mode === 'include' && !matches) continue;
        if (filter.mode === 'exclude' && matches) continue;
      }
      afterFilter += 1;
    }

    matchedSheets += afterFilter;
    fileResults.push({
      fileId: file.id,
      totalSheets: fileTotalSheets,
      matchedSheets: afterFilter,
    });
  }

  return {
    totalSheets: totalSheetsAll,
    matchedSheets,
    files: fileResults,
  };
}
