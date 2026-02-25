import type { MergeOptions } from './merge.js';

export interface PreviewSheetMeta {
  sheetId: string;
  name: string;
  rowCount: number;
  columnCount: number;
  sampleRows: string[][];
}

export interface PreviewFileMeta {
  filename: string;
  sheets: PreviewSheetMeta[];
}

export interface PreviewResponse {
  files: PreviewFileMeta[];
  error?: string;
}

// ─── Merge-Preview ────────────────────────────────────────────────────────────

/** Eine Tabelle im Merge-Vorschau-Ergebnis. */
export interface MergePreviewSheet {
  /** Name des Sheets (Dateiname, "Zusammenfassung", "Übersicht" …) */
  name: string;
  /** Zeilen × Spalten – nur primitive Werte (kein Style) */
  rows: (string | number | boolean | null)[][];
  /** true wenn mehr Zeilen vorhanden sind als angezeigt werden */
  truncated: boolean;
}

export interface MergePreviewResponse {
  sheets: MergePreviewSheet[];
  mode: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

// ─── Sheets-Info ──────────────────────────────────────────────────────────────

export interface SheetInfo {
  id: string;
  name: string;
  /** Erste Zeilen für Hover-Vorschau (pro Sheet) */
  previewRows?: string[][];
}

export interface SheetsResponse {
  sheets: SheetInfo[];
  error?: string;
  /** @deprecated Nutze sheets[].previewRows; Fallback: erstes Sheet */
  previewRows?: string[][];
}

// ─────────────────────────────────────────────────────────────────────────────

export interface MergeResponse {
  success: true;
  downloadUrl: string;
  filename: string;
  /** Nicht-fatale Warnungen (z. B. einzelne fehlerhafte Dateien) */
  warnings?: string[];
  error?: never;
}

/** Antwort wenn Merge via SSE läuft – gibt mergeId für /api/progress/:id zurück. */
export interface MergeJobResponse {
  success: true;
  mergeId: string;
  error?: never;
}

export interface MergeErrorResponse {
  success: false;
  error: string;
  downloadUrl?: never;
  filename?: never;
}

export type MergeApiResponse = MergeResponse | MergeJobResponse | MergeErrorResponse;

// ─── SSE Progress Events ──────────────────────────────────────────────────────

export type MergeProgressEvent =
  | { type: 'queued'; position: number }
  | { type: 'progress'; pct: number; msg: string }
  | { type: 'complete'; downloadUrl: string; filename: string; warnings: string[] }
  | { type: 'error'; message: string };

export interface MergeRequestOptions {
  options: MergeOptions;
}

// ─── Download-Verlauf ─────────────────────────────────────────────────────────

export interface HistoryEntry {
  /** Eindeutige Eintrags-ID */
  id: string;
  /** Datei-ID im Upload-Verzeichnis (für Download-URL) */
  fileId: string;
  /** Vorgeschlagener Dateiname (inkl. Extension) */
  filename: string;
  /** Merge-Modus-Bezeichner */
  mode: string;
  /** Anzahl der gemergten Dateien */
  fileCount: number;
  /** Unix-Timestamp (ms) des Merge-Abschlusses */
  timestamp: number;
  /** true wenn die Ausgabedatei ODS ist */
  isOds: boolean;
  /** Dateigröße in Bytes (optional, wird nach Blob-Download gesetzt) */
  size?: number;
}

export interface HistoryResponse {
  entries: HistoryEntry[];
}
