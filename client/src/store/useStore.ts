import { create } from 'zustand';
import type { MergeMode, MergeOptions, SheetInfo, HistoryEntry } from 'shared';
export type Locale = 'de' | 'en';

function getSavedLocale(): Locale {
  try {
    return localStorage.getItem('eXmerg-locale') === 'en' ? 'en' : 'de';
  } catch { return 'de'; }
}

// ─── localStorage-Persistenz ──────────────────────────────────────────────────

function getSavedMode(): MergeMode {
  try {
    const saved = localStorage.getItem('mergeMode');
    const valid: MergeMode[] = [
      'all_to_one_sheet', 'one_file_per_sheet',
      'all_with_source_column', 'consolidated_sheets', 'row_per_file', 'row_per_file_no_sum',
    ];
    if (saved && valid.includes(saved as MergeMode)) return saved as MergeMode;
  } catch { /* ignorieren */ }
  return 'consolidated_sheets';
}

function getSavedFormat(): 'xlsx' | 'ods' {
  try {
    return localStorage.getItem('outputFormat') === 'ods' ? 'ods' : 'xlsx';
  } catch { /* ignorieren */ }
  return 'xlsx';
}

/** Sortierung der Dateiliste für die Merge-Reihenfolge. */
export type FileSortOrder =
  | 'uploadOrder'
  | 'filename'
  | 'alphabetical'
  | 'sizeAsc'
  | 'sizeDesc'
  | 'dateNewest'
  | 'dateOldest';

const FILE_SORT_ORDER_VALID: FileSortOrder[] = [
  'uploadOrder', 'filename', 'alphabetical', 'sizeAsc', 'sizeDesc', 'dateNewest', 'dateOldest',
];

function getSavedFileSortOrder(): FileSortOrder {
  try {
    const saved = localStorage.getItem('fileSortOrder');
    if (saved && FILE_SORT_ORDER_VALID.includes(saved as FileSortOrder)) {
      // Standard ist „Upload-Reihenfolge“; einmalig alten Default „filename“ migrieren
      if (saved === 'filename') {
        try { localStorage.setItem('fileSortOrder', 'uploadOrder'); } catch { /* ignore */ }
        return 'uploadOrder';
      }
      return saved as FileSortOrder;
    }
  } catch { /* ignorieren */ }
  return 'uploadOrder';
}

export interface FileItem {
  /** Lokale Datei (undefined für History-Einträge). */
  file?: File;
  /** Bereits auf dem Server (fileId) – für Drag-from-History. */
  preUploadedId?: string;
  /** Immer gesetzt: Anzeigename. */
  filename: string;
  size?: number;
  /** Änderungsdatum (von file.lastModified), für Sortierung nach Datum. */
  lastModified?: number;
  id: string;
  error?: string;
}

/** Sortiert die Dateiliste nach der gewählten Reihenfolge (gibt neue Array-Referenz zurück). */
export function sortFileList(files: FileItem[], order: FileSortOrder): FileItem[] {
  if (order === 'uploadOrder' || files.length <= 1) return [...files];
  const out = [...files];
  const natCollator = new Intl.Collator(undefined, { numeric: true });
  switch (order) {
    case 'filename':
      out.sort((a, b) => natCollator.compare(a.filename, b.filename));
      break;
    case 'alphabetical':
      out.sort((a, b) => a.filename.localeCompare(b.filename));
      break;
    case 'sizeAsc':
      out.sort((a, b) => (a.size ?? 0) - (b.size ?? 0));
      break;
    case 'sizeDesc':
      out.sort((a, b) => (b.size ?? 0) - (a.size ?? 0));
      break;
    case 'dateNewest':
      out.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
      break;
    case 'dateOldest':
      out.sort((a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0));
      break;
    default:
      break;
  }
  return out;
}

// ─── Dateiname-Generierung ────────────────────────────────────────────────────

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function generateOutputFilename(files: FileItem[], format: 'xlsx' | 'ods' = 'xlsx'): string {
  const ext = '.' + format;
  if (files.length === 0) return 'merged' + ext;

  const bases = files.map((f) => f.filename.replace(/\.[^.]+$/, ''));

  const allDates: Date[] = [];
  for (const base of bases) {
    let m: RegExpExecArray | null;
    const re = /\b(\d{1,2})[._\-/](\d{1,2})[._\-/](\d{4})\b/g;
    while ((m = re.exec(base)) !== null) {
      const day = parseInt(m[1]!, 10);
      const month = parseInt(m[2]!, 10);
      const year = parseInt(m[3]!, 10);
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        allDates.push(new Date(year, month - 1, day));
      }
    }
  }

  if (allDates.length > 0) {
    allDates.sort((a, b) => a.getTime() - b.getTime());
    const first = allDates[0]!;
    const last = allDates[allDates.length - 1]!;
    const pad = (n: number) => String(n).padStart(2, '0');
    const firstY = first.getFullYear();
    const lastY = last.getFullYear();
    const firstM = first.getMonth();
    const lastM = last.getMonth();
    if (firstY === lastY && firstM === lastM)
      return `${MONTHS_DE[firstM]} ${firstY}_merged${ext}`;
    if (firstY === lastY)
      return `${pad(first.getDate())}.${pad(first.getMonth() + 1)}.-${pad(last.getDate())}.${pad(last.getMonth() + 1)}.${firstY}_merged${ext}`;
    const fmt = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    return `${fmt(first)}-${fmt(last)}_merged${ext}`;
  }

  if (bases.length >= 2) {
    let prefix = bases[0]!;
    for (const name of bases.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < name.length && prefix[i] === name[i]) i++;
      prefix = prefix.slice(0, i);
    }
    prefix = prefix.replace(/[-_\s.]+$/, '');
    if (prefix.length > 2) return `${prefix}_merged${ext}`;
  }

  if (bases.length === 1 && bases[0]) return `${bases[0]}_merged${ext}`;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `merged_${today}${ext}`;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export interface FileSheetInfo {
  sheets: SheetInfo[];
  /** true während der API-Aufruf läuft */
  loading: boolean;
  /** Ausgewählte Sheet-IDs (leer = alle) */
  selected: string[];
  /** Erste bis zu 3 Zeilen (Header + Daten) für Hover-Vorschau */
  previewRows?: string[][];
}

interface AppState {
  /** Sprache der UI (de | en) */
  locale: Locale;
  files: FileItem[];
  /** Sheet-Infos pro Datei-ID */
  sheetInfo: Record<string, FileSheetInfo>;
  /** Anzahl beim letzten addFiles-Aufruf übersprungener Duplikate */
  skippedDuplicates: number;
  /** Dateinamen der übersprungenen Duplikate (für genaue Fehlermeldung) */
  skippedDuplicateNames: string[];
  /** Übersprungene Duplikate als File-Objekte (für „Vorhandene ersetzen“) */
  skippedDuplicateFiles: File[];
  mergeOptions: MergeOptions;
  /** Ausgabe-Format: xlsx (Standard) oder ods */
  outputFormat: 'xlsx' | 'ods';
  isProcessing: boolean;
  mergeError: string | null;
  /** Warnungen vom letzten Merge (nicht-fatale Fehler einzelner Dateien) */
  mergeWarnings: string[];
  downloadUrl: string | null;
  downloadFilename: string | null;
  outputFilename: string;
  isCustomFilename: boolean;
  uploadProgress: number | 'processing' | null;
  /** Sortierung der Dateiliste (Merge-Reihenfolge). */
  fileSortOrder: FileSortOrder;
  /** IDs gerade hinzugefügter Dateien (für grünes Aufblitzen), wird nach kurzer Zeit geleert. */
  newlyAddedFileIds: string[];

  /** Zähler – erhöht sich nach jedem erfolgreichen Merge (triggert History-Refresh). */
  historyVersion: number;
  bumpHistory: () => void;

  addFiles: (files: File[]) => void;
  addHistoryFile: (entry: HistoryEntry) => void;
  removeFile: (id: string) => void;
  removeFiles: (ids: string[]) => void;
  reorderFiles: (fromIndex: number, toIndex: number) => void;
  setSheetInfo: (fileId: string, info: Partial<FileSheetInfo>) => void;
  clearSkippedDuplicates: () => void;
  /** Vorhandene Dateien mit den übersprungenen Duplikaten ersetzen. */
  replaceWithSkippedDuplicates: () => void;
  setMergeOptions: (o: MergeOptions) => void;
  setOutputFormat: (f: 'xlsx' | 'ods') => void;
  setProcessing: (v: boolean) => void;
  setMergeError: (e: string | null) => void;
  setMergeWarnings: (w: string[]) => void;
  setDownload: (url: string | null, name: string | null) => void;
  setOutputFilename: (name: string, isCustom?: boolean) => void;
  setUploadProgress: (p: number | 'processing' | null) => void;
  setFileSortOrder: (order: FileSortOrder) => void;
  clearNewlyAddedFileIds: () => void;
  clearResult: () => void;
  reset: () => void;
  setLocale: (locale: Locale) => void;
}

const defaultMergeOptions: MergeOptions = {
  outputType: 'xlsx',
  mode: 'consolidated_sheets',
};

export const useStore = create<AppState>((set) => ({
  locale: getSavedLocale(),
  files: [],
  sheetInfo: {},
  skippedDuplicates: 0,
  skippedDuplicateNames: [],
  skippedDuplicateFiles: [],
  mergeOptions: { ...defaultMergeOptions, mode: getSavedMode() },
  outputFormat: getSavedFormat(),
  historyVersion: 0,
  isProcessing: false,
  mergeError: null,
  mergeWarnings: [],
  downloadUrl: null,
  downloadFilename: null,
  outputFilename: getSavedFormat() === 'ods' ? 'merged.ods' : 'merged.xlsx',
  isCustomFilename: false,
  uploadProgress: null,
  fileSortOrder: getSavedFileSortOrder(),
  newlyAddedFileIds: [],

  addFiles: (newFiles) =>
    set((s) => {
      const existingNames = new Set(s.files.map((f) => f.filename));
      const unique = newFiles.filter((f) => !existingNames.has(f.name));
      const duplicateFiles = newFiles.filter((f) => existingNames.has(f.name));
      const duplicateNames = duplicateFiles.map((f) => f.name);
      const skippedDuplicates = duplicateNames.length;

      const added = unique.map((file) => ({
        file,
        filename: file.name,
        size: file.size,
        lastModified: file.lastModified,
        id: Math.random().toString(36).slice(2),
        error: undefined as string | undefined,
      }));
      const allFiles = [...s.files, ...added];
      const newlyAddedFileIds = added.map((i) => i.id);

      // Sheet-Info-Einträge für neue Dateien anlegen (loading=true)
      const newSheetInfo = { ...s.sheetInfo };
      for (const item of added) {
        const ext = item.filename.split('.').pop()?.toLowerCase() ?? '';
        if (['xlsx', 'xls', 'ods'].includes(ext)) {
          newSheetInfo[item.id] = { sheets: [], loading: true, selected: [] };
        }
      }

      const outputFilename = s.isCustomFilename
        ? s.outputFilename
        : generateOutputFilename(allFiles, s.outputFormat);

      return { files: allFiles, sheetInfo: newSheetInfo, skippedDuplicates, skippedDuplicateNames: duplicateNames, skippedDuplicateFiles: duplicateFiles, newlyAddedFileIds, outputFilename };
    }),

  bumpHistory: () => set((s) => ({ historyVersion: s.historyVersion + 1 })),

  addHistoryFile: (entry) =>
    set((s) => {
      // Duplikat-Check: gleicher Dateiname oder gleiche fileId
      const existingNames = new Set(s.files.map((f) => f.filename));
      const existingPreUploaded = new Set(s.files.map((f) => f.preUploadedId).filter(Boolean));
      if (existingNames.has(entry.filename) || existingPreUploaded.has(entry.fileId)) return s;
      const id = Math.random().toString(36).slice(2);
      const newItem: FileItem = {
        preUploadedId: entry.fileId,
        filename: entry.filename,
        id,
      };
      const allFiles = [...s.files, newItem];
      return {
        files: allFiles,
        newlyAddedFileIds: [id],
        outputFilename: s.isCustomFilename ? s.outputFilename : generateOutputFilename(allFiles, s.outputFormat),
      };
    }),

  removeFile: (id) =>
    set((s) => {
      const newFiles = s.files.filter((f) => f.id !== id);
      const newSheetInfo = { ...s.sheetInfo };
      delete newSheetInfo[id];
      const outputFilename = s.isCustomFilename
        ? s.outputFilename
        : generateOutputFilename(newFiles, s.outputFormat);
      return { files: newFiles, sheetInfo: newSheetInfo, outputFilename };
    }),

  removeFiles: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      const newFiles = s.files.filter((f) => !idSet.has(f.id));
      const newSheetInfo = { ...s.sheetInfo };
      for (const id of ids) delete newSheetInfo[id];
      const outputFilename = s.isCustomFilename
        ? s.outputFilename
        : generateOutputFilename(newFiles, s.outputFormat);
      return { files: newFiles, sheetInfo: newSheetInfo, outputFilename };
    }),

  reorderFiles: (fromIndex, toIndex) =>
    set((s) => {
      if (fromIndex === toIndex) return s;
      const next = [...s.files];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) return s;
      next.splice(toIndex, 0, moved);
      const outputFilename = s.isCustomFilename
        ? s.outputFilename
        : generateOutputFilename(next, s.outputFormat);
      return { files: next, outputFilename };
    }),

  setSheetInfo: (fileId, info) =>
    set((s) => ({
      sheetInfo: {
        ...s.sheetInfo,
        [fileId]: { ...(s.sheetInfo[fileId] ?? { sheets: [], loading: false, selected: [] }), ...info },
      },
    })),

  clearSkippedDuplicates: () => set({ skippedDuplicates: 0, skippedDuplicateNames: [], skippedDuplicateFiles: [] }),

  replaceWithSkippedDuplicates: () =>
    set((s) => {
      if (s.skippedDuplicateFiles.length === 0) return s;
      const namesToReplace = new Set(s.skippedDuplicateNames);
      const remaining = s.files.filter((f) => !namesToReplace.has(f.filename));
      const newSheetInfo = { ...s.sheetInfo };
      for (const f of s.files) {
        if (namesToReplace.has(f.filename)) delete newSheetInfo[f.id];
      }
      const added = s.skippedDuplicateFiles.map((file) => ({
        file,
        filename: file.name,
        size: file.size,
        lastModified: file.lastModified,
        id: Math.random().toString(36).slice(2),
        error: undefined as string | undefined,
      }));
      const allFiles = [...remaining, ...added];
      for (const item of added) {
        const ext = item.filename.split('.').pop()?.toLowerCase() ?? '';
        if (['xlsx', 'xls', 'ods'].includes(ext)) {
          newSheetInfo[item.id] = { sheets: [], loading: true, selected: [] };
        }
      }
      const outputFilename = s.isCustomFilename ? s.outputFilename : generateOutputFilename(allFiles, s.outputFormat);
      return {
        files: allFiles,
        sheetInfo: newSheetInfo,
        skippedDuplicates: 0,
        skippedDuplicateNames: [],
        skippedDuplicateFiles: [],
        newlyAddedFileIds: added.map((i) => i.id),
        outputFilename,
      };
    }),


  setMergeOptions: (o) => {
    try { localStorage.setItem('mergeMode', o.mode); } catch { /* ignorieren */ }
    set({ mergeOptions: o });
  },

  setOutputFormat: (f) => {
    try { localStorage.setItem('outputFormat', f); } catch { /* ignorieren */ }
    set((s) => ({
      outputFormat: f,
      outputFilename: s.isCustomFilename ? s.outputFilename : generateOutputFilename(s.files, f),
      mergeOptions: { ...s.mergeOptions, outputFormat: f },
    }));
  },

  setProcessing: (v) => set({ isProcessing: v }),
  setMergeError: (e) => set({ mergeError: e }),
  setMergeWarnings: (w) => set({ mergeWarnings: w }),
  setDownload: (url, name) => set({ downloadUrl: url, downloadFilename: name }),

  setOutputFilename: (name, isCustom = true) =>
    set({ outputFilename: name, isCustomFilename: isCustom }),

  setUploadProgress: (p) => set({ uploadProgress: p }),

  setFileSortOrder: (order) => {
    set({ fileSortOrder: order });
    try { localStorage.setItem('fileSortOrder', order); } catch { /* ignorieren */ }
  },

  clearNewlyAddedFileIds: () => set({ newlyAddedFileIds: [] }),

  clearResult: () => set({ downloadUrl: null, downloadFilename: null, mergeWarnings: [] }),

  reset: () =>
    set((s) => ({
      files: [],
      sheetInfo: {},
      skippedDuplicates: 0,
      skippedDuplicateNames: [],
      skippedDuplicateFiles: [],
      newlyAddedFileIds: [],
      mergeOptions: { ...defaultMergeOptions, mode: getSavedMode() },
      outputFormat: s.outputFormat,
      isProcessing: false,
      mergeError: null,
      mergeWarnings: [],
      downloadUrl: null,
      downloadFilename: null,
      outputFilename: generateOutputFilename([], s.outputFormat),
      isCustomFilename: false,
      uploadProgress: null,
    })),

  setLocale: (locale) => {
    try { localStorage.setItem('eXmerg-locale', locale); } catch { /* ignore */ }
    set({ locale });
  },
}));
