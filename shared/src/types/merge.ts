export type MergeMode =
  | 'all_to_one_sheet'
  | 'one_file_per_sheet'
  | 'all_with_source_column'
  | 'consolidated_sheets'
  | 'row_per_file'
  | 'row_per_file_no_sum';

/** Wie viele Sheets pro Datei in den Merge einfließen (vor evtl. Sheet-Namen-Filter). */
export type SheetSelectionMode = 'all' | 'first';

/** Filter nach Sheet-Namen (include = nur behalten, exclude = entfernen). */
export interface SheetNameFilterOption {
  mode: 'include' | 'exclude';
  values: string[];
  match?: 'exact' | 'contains' | 'regex';
  caseSensitive?: boolean;
}

export interface MergeOptionsBase {
  mode: MergeMode;
  selectedSheets?: Record<string, string[]>;
  /** Modus für Sheet-Auswahl: alle Sheets oder nur erstes. Leer = alle. */
  sheetSelectionMode?: SheetSelectionMode;
  /** Optional: Sheets nach Namen filtern (include/exclude). */
  sheetNameFilter?: SheetNameFilterOption;
}

export interface SpreadsheetMergeOptions extends MergeOptionsBase {
  outputType: 'xlsx';
  /** Ausgabeformat der Datei: xlsx (Standard) oder ods */
  outputFormat?: 'xlsx' | 'ods';
}

export type MergeOptions = SpreadsheetMergeOptions;

export function isSpreadsheetMergeOptions(o: MergeOptions): o is SpreadsheetMergeOptions {
  return o.outputType === 'xlsx';
}
