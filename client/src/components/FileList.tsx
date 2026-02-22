import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileSortOrder } from '../store/useStore';
import { useStore, sortFileList } from '../store/useStore';
import { fetchSheets } from '../api/client';
import { getExtension } from 'shared';
import { useT } from '../i18n';
import { Portal } from './ui/Portal';
import { SelectionSummaryBar } from './SelectionSummaryBar';
import { Z_INDEX } from '../constants/zIndex';
import {
  evaluateSheetSelection,
  type FileMeta,
  type SheetCollectOptionsForPreview,
} from '../utils/sheetSelectionPreview';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatFileDate(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

const EXT_COLORS: Record<string, string> = {
  '.xlsx': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  '.xls':  'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  '.ods':  'bg-sky-500/15 text-sky-400 border-sky-500/20',
};

/** Semantische Farbe für Sheet-Ratio (nur CSS-Klassen, kein Layout). */
function getRatioColor(matched: number, total: number): string {
  if (total === 0) return 'text-zinc-500 dark:text-zinc-400';
  if (matched === 0) return 'text-zinc-500 dark:text-zinc-400';
  if (matched === total) return 'text-emerald-400';
  return 'text-sky-400';
}

export function FileList() {
  const t = useT();
  const files              = useStore((s) => s.files);
  const fileSortOrder      = useStore((s) => s.fileSortOrder);
  const sheetInfo          = useStore((s) => s.sheetInfo);
  const newlyAddedFileIds      = useStore((s) => s.newlyAddedFileIds);
  const clearNewlyAddedFileIds = useStore((s) => s.clearNewlyAddedFileIds);
  const removeFile         = useStore((s) => s.removeFile);
  const removeFiles        = useStore((s) => s.removeFiles);
  const reorderFiles       = useStore((s) => s.reorderFiles);
  const setSheetInfo       = useStore((s) => s.setSheetInfo);
  const setSelectedFileIds = useStore((s) => s.setSelectedFileIds);
  const uploadProgress     = useStore((s) => s.uploadProgress);
  const downloadUrl        = useStore((s) => s.downloadUrl);
  const mergeOptions       = useStore((s) => s.mergeOptions);
  const setMergeOptions    = useStore((s) => s.setMergeOptions);
  const setFileSortOrder   = useStore((s) => s.setFileSortOrder);

  const sortedFiles = useMemo(() => sortFileList(files, fileSortOrder), [files, fileSortOrder]);
  const selectedFileIds = useStore((s) => s.selectedFileIds);
  const selectedIds = useMemo(() => new Set(selectedFileIds), [selectedFileIds]);
  const isUploadOrder = fileSortOrder === 'uploadOrder';

  // Live-Vorschau: wie viele Sheets nach Modus/Filter übrig bleiben (kein Laden, keine API)
  const filesMeta: FileMeta[] = useMemo(
    () =>
      sortedFiles.map((item) => {
        const info = sheetInfo[item.id];
        const sheets = (info?.sheets ?? []).map((s, i) => ({ name: s.name, index: i }));
        return { id: item.id, filename: item.filename, sheets };
      }),
    [sortedFiles, sheetInfo],
  );
  const sheetCollectOptions: SheetCollectOptionsForPreview | undefined = useMemo(() => {
    const mode = mergeOptions.sheetSelectionMode === 'first' ? 'first' : 'all';
    const selectedSheetsByFile =
      mergeOptions.selectedSheets && Object.keys(mergeOptions.selectedSheets).length > 0
        ? Object.fromEntries(
            Object.entries(mergeOptions.selectedSheets).map(([fn, ids]) => [
              fn,
              (ids ?? []).map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)),
            ]),
          )
        : undefined;
    const sheetNameFilter = mergeOptions.sheetNameFilter?.values?.length
      ? mergeOptions.sheetNameFilter
      : undefined;
    if (!selectedSheetsByFile && !sheetNameFilter && mode === 'all') return undefined;
    return { mode, selectedSheetsByFile, sheetNameFilter };
  }, [mergeOptions.sheetSelectionMode, mergeOptions.selectedSheets, mergeOptions.sheetNameFilter]);
  const selectionPreview = useMemo(
    () => evaluateSheetSelection(filesMeta, sheetCollectOptions),
    [filesMeta, sheetCollectOptions],
  );
  const filterActive = useMemo(
    () =>
      mergeOptions.sheetSelectionMode === 'first' ||
      (mergeOptions.sheetNameFilter?.values?.length ?? 0) > 0,
    [mergeOptions.sheetSelectionMode, mergeOptions.sheetNameFilter],
  );
  const totalSheetsInList = useMemo(
    () => filesMeta.reduce((n, f) => n + f.sheets.length, 0),
    [filesMeta],
  );
  const selectedSheetCount = useMemo(
    () =>
      selectionPreview.files
        .filter((f) => selectedIds.has(f.fileId))
        .reduce((s, f) => s + (filterActive ? f.matchedSheets : f.totalSheets), 0),
    [selectionPreview.files, selectedIds, filterActive],
  );

  const dragSrc = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [openSheets, setOpenSheets] = useState<Record<string, boolean>>({});

  // Grünes Aufblitzen nach kurzer Zeit zurücksetzen
  useEffect(() => {
    if (newlyAddedFileIds.length === 0) return;
    const t = setTimeout(clearNewlyAddedFileIds, 2000);
    return () => clearTimeout(t);
  }, [newlyAddedFileIds, clearNewlyAddedFileIds]);

  // ── Mehrfachauswahl (sync mit Store für Merge-Scope) ────────────────────────
  const anySelected  = selectedIds.size > 0;
  const allSelected  = sortedFiles.length > 0 && selectedIds.size === sortedFiles.length;

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedFileIds(Array.from(next));
  };

  const toggleSelectAll = () => {
    setSelectedFileIds(allSelected ? [] : sortedFiles.map((f) => f.id));
  };

  const deleteSelected = () => {
    removeFiles([...selectedIds]);
    setSelectedFileIds([]);
  };

  // Auswahl aufräumen wenn Dateien extern entfernt wurden
  useEffect(() => {
    const fileIds = new Set(files.map((f) => f.id));
    const cleaned = selectedFileIds.filter((id) => fileIds.has(id));
    if (cleaned.length !== selectedFileIds.length) setSelectedFileIds(cleaned);
  }, [files, selectedFileIds, setSelectedFileIds]);

  const isUploading  = uploadProgress !== null && uploadProgress !== 'processing';
  const isProcessing = uploadProgress === 'processing';
  const isDone       = !!downloadUrl;
  const uploadPct    = typeof uploadProgress === 'number' ? uploadProgress : 0;
  const busy         = isUploading || isProcessing;

  /** Während eines Merges: nur diese Dateien zeigen Fortschritt (ausgewählte oder alle). */
  const mergingIds = useMemo(() => {
    if (!busy) return new Set<string>();
    if (selectedIds.size > 0) return new Set(selectedIds);
    return new Set(sortedFiles.map((f) => f.id));
  }, [busy, selectedIds, sortedFiles]);

  // Hover-Vorschau (Portal, viewport-aware Position + kurze Verzögerung)
  const PREVIEW_MAX_WIDTH = 520;
  const PREVIEW_MAX_HEIGHT = 280;
  const PREVIEW_MARGIN = 16;
  const PREVIEW_DELAY_MS = 280;

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredRect, setHoveredRect] = useState<DOMRect | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const previewDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRowMouseEnter = (id: string, el: HTMLElement) => {
    setHoveredId(id);
    setHoveredRect(el.getBoundingClientRect());
    setShowPreview(false);
    previewDelayRef.current = setTimeout(() => setShowPreview(true), PREVIEW_DELAY_MS);
  };
  const handleRowMouseLeave = () => {
    setHoveredId(null);
    setHoveredRect(null);
    setShowPreview(false);
    if (previewDelayRef.current) {
      clearTimeout(previewDelayRef.current);
      previewDelayRef.current = null;
    }
  };

  const hidePreviewOnScroll = useCallback(() => {
    setHoveredId(null);
    setHoveredRect(null);
    setShowPreview(false);
    if (previewDelayRef.current) {
      clearTimeout(previewDelayRef.current);
      previewDelayRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (previewDelayRef.current) clearTimeout(previewDelayRef.current);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', hidePreviewOnScroll, { passive: true });
    return () => window.removeEventListener('scroll', hidePreviewOnScroll);
  }, [hidePreviewOnScroll]);

  // Virtualisierung für lange Listen (100+ Dateien)
  const listParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedFiles.length,
    getScrollElement: () => listParentRef.current,
    estimateSize: () => 58,
    overscan: 5,
  });

  // ── Sheet-Info automatisch laden ──────────────────────────────────────────
  useEffect(() => {
    for (const item of files) {
      if (!item.file) continue; // History-Einträge ohne lokale Datei überspringen
      const info = sheetInfo[item.id];
      if (!info || !info.loading) continue;
      void fetchSheets(item.file).then((res) => {
        setSheetInfo(item.id, {
          sheets: res.sheets,
          loading: false,
          selected: [],
          previewRows: res.previewRows,
        });
      }).catch(() => {
        setSheetInfo(item.id, { sheets: [], loading: false, selected: [] });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.map((f) => f.id).join(',')]);

  // ── Drag-Handler ──────────────────────────────────────────────────────────
  const handleDragStart = (i: number) => (e: React.DragEvent) => {
    dragSrc.current = i;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };
  const handleDragOver = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrc.current !== null && dragSrc.current !== i) setDragOver(i);
  };
  const handleDrop = (i: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSrc.current !== null && dragSrc.current !== i) reorderFiles(dragSrc.current, i);
    dragSrc.current = null;
    setDragOver(null);
  };
  const handleDragEnd = () => { dragSrc.current = null; setDragOver(null); };

  // ── Sheet-Auswahl ─────────────────────────────────────────────────────────
  const toggleSheetSelected = (fileId: string, sheetId: string) => {
    const info = sheetInfo[fileId];
    if (!info) return;
    const selected = info.selected.includes(sheetId)
      ? info.selected.filter((s) => s !== sheetId)
      : [...info.selected, sheetId];
    setSheetInfo(fileId, { selected });
    const item = files.find((f) => f.id === fileId);
    if (!item) return;
    const prev = mergeOptions.selectedSheets ?? {};
    const next = { ...prev };
    if (selected.length === 0) {
      delete next[item.filename];
    } else {
      next[item.filename] = selected;
    }
    setMergeOptions({ ...mergeOptions, selectedSheets: next });
  };

  if (sortedFiles.length === 0) return null;

  const SORT_OPTIONS: { value: FileSortOrder; labelKey: string }[] = [
    { value: 'uploadOrder', labelKey: 'files.sort.uploadOrder' },
    { value: 'filename', labelKey: 'files.sort.filename' },
    { value: 'alphabetical', labelKey: 'files.sort.alphabetical' },
    { value: 'sizeAsc', labelKey: 'files.sort.sizeAsc' },
    { value: 'sizeDesc', labelKey: 'files.sort.sizeDesc' },
    { value: 'dateNewest', labelKey: 'files.sort.dateNewest' },
    { value: 'dateOldest', labelKey: 'files.sort.dateOldest' },
  ];

  return (
    <div className="space-y-2">

      {/* ── Summary-Bar + Merge-Reihenfolge (eine Zeile, auf kleinen Screens Wrap) ─ */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <SelectionSummaryBar
          fileCount={files.length}
          sheetCount={totalSheetsInList}
          selectedFileCount={selectedIds.size}
          selectedSheetCount={selectedSheetCount}
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{t('files.sortOrder')}</span>
          <select
            value={fileSortOrder}
            onChange={(e) => setFileSortOrder(e.target.value as FileSortOrder)}
            className="text-xs rounded border border-zinc-400 dark:border-surface-500 bg-zinc-100 dark:bg-surface-700 text-zinc-800 dark:text-zinc-200 px-2 py-1 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
          {!isUploadOrder && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500 hidden sm:inline" title={t('files.sort.dragHint')}>
              {t('files.sort.dragHint')}
            </span>
          )}
        </div>
      </div>

      {/* ── Bulk-Aktionsleiste (nur bei Auswahl) ─────────────────────────── */}
      {anySelected && !busy && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-800 border border-surface-600 animate-slide-up">
          {/* Select-All-Checkbox */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center justify-center w-4 h-4 rounded border transition-colors shrink-0
              border-emerald-500/60 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
            title={allSelected ? 'Alle abwählen' : 'Alle auswählen'}
          >
            {allSelected ? (
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="4" y="11" width="16" height="2" rx="1" />
              </svg>
            )}
          </button>

          <span className="text-xs text-zinc-500 dark:text-zinc-400 flex-1">
            {t('files.selectionLabel')}
          </span>

          <button
            type="button"
            onClick={deleteSelected}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium
              bg-red-500/10 text-red-400 border border-red-500/20
              hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {selectedIds.size === 1 ? t('files.remove') : t('files.removeN', { n: selectedIds.size })}
          </button>

          <button
            type="button"
            onClick={() => setSelectedFileIds([])}
            className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors shrink-0"
            title={t('files.clearSelection')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* ── Datei-Liste (virtualisiert) ───────────────────────────────────── */}
      <div
        ref={listParentRef}
        onScroll={hidePreviewOnScroll}
        className="min-h-[200px] max-h-[60vh] overflow-auto rounded-lg border border-zinc-200 dark:border-surface-600"
      >
        <div
          style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
          className="w-full"
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const index = virtualRow.index;
            const item = sortedFiles[index]!;
            const ext           = getExtension(item.filename);
            const color         = EXT_COLORS[ext] ?? 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
            const info          = sheetInfo[item.id];
            const hasMultiSheets = (info?.sheets.length ?? 0) > 1;
            const sheetsOpen    = openSheets[item.id] ?? false;
            const isSelected    = selectedIds.has(item.id);
            const isPartOfMerge = mergingIds.has(item.id);
            const filePreview   = selectionPreview.files.find((f) => f.fileId === item.id);
            const noSheetsMatch = filePreview ? filePreview.totalSheets > 0 && filePreview.matchedSheets === 0 : false;

            return (
              <div
                key={item.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: 6,
                }}
              >
                <div
                  draggable={!busy && !anySelected && isUploadOrder}
                  onDragStart={!busy && !anySelected && isUploadOrder ? handleDragStart(index) : undefined}
                  onDragOver={!busy && !anySelected && isUploadOrder ? handleDragOver(index) : undefined}
                  onDrop={!busy && !anySelected && isUploadOrder ? handleDrop(index) : undefined}
                  onDragEnd={!busy && !anySelected && isUploadOrder ? handleDragEnd : undefined}
                  onMouseEnter={(e) => handleRowMouseEnter(item.id, e.currentTarget)}
                  onMouseLeave={handleRowMouseLeave}
                  className={[
                  'relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all group overflow-visible',
                  newlyAddedFileIds.includes(item.id) && 'file-added-flash border-emerald-500/30',
                  noSheetsMatch && 'opacity-50',
                  dragOver === index
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/40 scale-[1.01]'
                    : isSelected
                    ? 'bg-emerald-500/10 dark:bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-zinc-100 dark:bg-surface-800 border-zinc-300 dark:border-surface-600 hover:border-zinc-400 dark:hover:border-surface-500',
                ].filter(Boolean).join(' ')}
              >
                {/* Fortschrittsbalken */}
                {isPartOfMerge && isUploading && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-surface-600">
                    <div className="h-full bg-emerald-500 transition-all duration-200 ease-out" style={{ width: `${Math.min(100, Math.round(uploadPct))}%` }} />
                  </div>
                )}
                {isPartOfMerge && isProcessing && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden">
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-shimmer" />
                  </div>
                )}

                {/* Checkbox (immer bei Auswahl-Modus sichtbar, sonst bei Hover) */}
                {!busy && (
                  <button
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className={[
                      'shrink-0 flex items-center justify-center w-4 h-4 rounded border transition-colors',
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                        : anySelected
                        ? 'border-surface-500 bg-surface-700 text-transparent hover:border-emerald-500/40'
                        : 'border-transparent text-transparent opacity-0 group-hover:opacity-100 group-hover:border-surface-500 group-hover:bg-surface-700',
                    ].join(' ')}
                    title={isSelected ? 'Abwählen' : 'Auswählen'}
                  >
                    {isSelected && (
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Drag-Handle (versteckt wenn Auswahl aktiv) */}
                {!busy && !anySelected && isUploadOrder && (
                  <span className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-500 dark:text-zinc-700 hover:text-zinc-600 dark:hover:text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity touch-none" title={t('files.reorder')}>
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M7 2a1 1 0 000 2 1 1 0 000-2zm0 6a1 1 0 000 2 1 1 0 000-2zm0 6a1 1 0 000 2 1 1 0 000-2zm6-12a1 1 0 000 2 1 1 0 000-2zm0 6a1 1 0 000 2 1 1 0 000-2zm0 6a1 1 0 000 2 1 1 0 000-2z" />
                    </svg>
                  </span>
                )}

                {/* Positions-Nummer */}
                <span className="shrink-0 text-xs font-mono text-zinc-500 dark:text-zinc-700 w-4 text-right select-none">{index + 1}</span>

                {/* Badge: History-Einträge mit Uhr-Icon */}
                {item.preUploadedId && !item.file ? (
                  <span className="badge border bg-violet-500/15 text-violet-400 border-violet-500/20 shrink-0" title={t('history.fromHistory')}>
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                ) : (
                  <span className={`badge border ${color} shrink-0`}>{ext.slice(1)}</span>
                )}

                {/* Dateiname (Vorschau wird per Portal über der Liste gerendert) */}
                <div className="flex-1 min-w-0">
                  <span className="block truncate text-sm text-zinc-800 dark:text-zinc-200">{item.filename}</span>
                </div>

                {/* Badge: Sheets-Vorschau (immer anzeigen wenn Datei Sheets hat, Farbe: grau / blau / grün) */}
                {filePreview && filePreview.totalSheets > 0 && (
                  <span
                    className={['shrink-0 text-xs font-medium transition-colors duration-150', getRatioColor(filePreview.matchedSheets, filePreview.totalSheets)].join(' ')}
                    title={t('files.sheetsSelected', { matched: filePreview.matchedSheets, total: filePreview.totalSheets })}
                  >
                    {filePreview.matchedSheets} / {filePreview.totalSheets}
                  </span>
                )}

                {/* Sheet-Auswahl-Toggle */}
                {hasMultiSheets && !busy && (
                  <button
                    type="button"
                    onClick={() => setOpenSheets((p) => ({ ...p, [item.id]: !sheetsOpen }))}
                    className={[
                      'shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors',
                      sheetsOpen
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 border border-transparent hover:border-zinc-400 dark:hover:border-surface-500',
                    ].join(' ')}
                    title={t('files.sheetsSelect')}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                    </svg>
                    <span>{info.selected.length > 0 ? `${info.selected.length}/${info.sheets.length}` : t('files.sheets')}</span>
                  </button>
                )}

                {/* Größe / Status */}
                {isDone ? (
                  <span className="shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20">
                    <svg className="w-2.5 h-2.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : isPartOfMerge && isProcessing ? (
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </span>
                ) : isPartOfMerge && isUploading ? (
                  <span className="shrink-0 text-xs font-mono text-emerald-400 w-8 text-right tabular-nums">{Math.round(uploadPct)}%</span>
                ) : (
                  <span className="shrink-0 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-600">
                    {item.lastModified ? (
                      <span title={new Date(item.lastModified).toLocaleString()}>{formatFileDate(item.lastModified)}</span>
                    ) : null}
                    {item.size ? (
                      <span>{formatSize(item.size)}</span>
                    ) : item.preUploadedId ? (
                      <span>{t('files.historyLabel')}</span>
                    ) : null}
                  </span>
                )}

                {/* Einzeln entfernen (ausgeblendet wenn Auswahl-Modus aktiv) */}
                {!busy && !anySelected && (
                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    className="shrink-0 p-1 rounded text-zinc-500 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                    title={t('files.removeTitle')}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* ── Sheet-Auswahl-Panel ────────────────────────────────── */}
              {hasMultiSheets && sheetsOpen && (
                <div className="mt-1 ml-8 p-3 rounded-lg bg-zinc-100 dark:bg-surface-800/60 border border-zinc-300 dark:border-surface-600 flex flex-wrap gap-2 animate-slide-up">
                  <span className="text-xs text-zinc-600 w-full mb-1">
                    {t('files.sheetsSelect')}
                  </span>
                  {info.sheets.map((sheet) => {
                    const sel = info.selected.includes(sheet.id);
                    return (
                      <button
                        key={sheet.id}
                        type="button"
                        onClick={() => toggleSheetSelected(item.id, sheet.id)}
                        className={[
                          'px-2.5 py-1 rounded text-xs font-medium border transition-colors',
                          sel
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border-zinc-400 dark:border-surface-500 hover:border-zinc-500',
                        ].join(' ')}
                      >
                        {sel && (
                          <svg className="inline w-2.5 h-2.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {sheet.name}
                      </button>
                    );
                  })}
                </div>
              )}
              </div>
          );
          })}
        </div>
      </div>

      {/* Hover-Vorschau: viewport-aware (überdeckt Liste nicht), erscheint nach kurzer Verzögerung */}
      {showPreview && hoveredId && hoveredRect && (() => {
        const preview = sheetInfo[hoveredId]?.previewRows;
        if (!preview || preview.length === 0) return null;
        const win = typeof window !== 'undefined' ? window : null;
        const spaceBelow = win ? win.innerHeight - hoveredRect.bottom - PREVIEW_MARGIN : 400;
        const showAbove = spaceBelow < PREVIEW_MAX_HEIGHT;
        const left = win
          ? Math.max(PREVIEW_MARGIN, Math.min(hoveredRect.left, win.innerWidth - PREVIEW_MAX_WIDTH - PREVIEW_MARGIN))
          : hoveredRect.left;
        const top = showAbove
          ? Math.max(PREVIEW_MARGIN, hoveredRect.top - PREVIEW_MAX_HEIGHT - 8)
          : hoveredRect.bottom + 6;
        return (
          <Portal>
            <div
              className="min-w-[300px] max-w-[520px] max-h-[280px] flex flex-col p-3 rounded-xl border border-slate-700/60 bg-slate-900/95 dark:bg-surface-900/95 backdrop-blur shadow-2xl pointer-events-none animate-fade-in"
              style={{
                position: 'fixed',
                left,
                top,
                zIndex: Z_INDEX.OVERLAY,
              }}
            >
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1.5 shrink-0">
                {preview.length === 1 ? t('files.previewRow', { n: preview.length }) : t('files.previewRows', { n: preview.length })}
              </p>
              <div className="overflow-auto min-h-0 flex-1">
                <table className="text-xs border-collapse">
                  <tbody>
                    {preview.map((row, ri) => (
                      <tr key={ri} className={ri === 0 ? 'bg-slate-800/80 dark:bg-surface-800' : ri % 2 === 0 ? 'bg-slate-800/50 dark:bg-surface-800/80' : ''}>
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={[
                              'px-1.5 py-0.5 border border-slate-700/50 dark:border-surface-700 max-w-[90px] truncate whitespace-nowrap',
                              ri === 0 ? 'font-medium text-zinc-300 dark:text-zinc-300' : 'text-zinc-400 dark:text-zinc-500',
                            ].join(' ')}
                            title={cell}
                          >
                            {cell || <span className="text-zinc-500 dark:text-zinc-600">–</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Portal>
        );
      })()}
    </div>
  );
}
