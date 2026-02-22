import { useT } from '../i18n';

export interface SelectionSummaryBarProps {
  /** Gesamt: Dateien in der Liste */
  fileCount: number;
  /** Gesamt: Sheets in der Liste */
  sheetCount: number;
  /** Ausgewählte Dateien (für Merge). Wenn > 0: Badge rechts mit Dateien + Sheets */
  selectedFileCount: number;
  /** Ausgewählte Sheets (nach Modus/Filter). Wird im Badge neben selectedFileCount angezeigt */
  selectedSheetCount: number;
}

/**
 * Kompakte Info-Leiste: links Gesamt (Dateien · Sheets), rechts bei Auswahl Badge (Dateien · Sheets).
 * Eine Stelle für „ausgewählt“, inkl. Sheet-Anzahl.
 */
export function SelectionSummaryBar({
  fileCount,
  sheetCount,
  selectedFileCount,
  selectedSheetCount,
}: SelectionSummaryBarProps) {
  const t = useT();
  const hasSelection = selectedFileCount > 0;
  return (
    <div
      className="flex items-center justify-between gap-4 px-3 py-2 rounded-lg
        bg-slate-800/40 dark:bg-surface-800/40 border border-slate-700/50 dark:border-surface-700/50
        flex-1 min-w-0"
    >
      <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
        {t('files.totalAvailable', { fileCount, sheetCount })}
      </span>
      {hasSelection && (
        <span
          className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 dark:bg-emerald-500/10 dark:text-emerald-400 shrink-0"
          aria-label={t('files.selectedForMerge', { fileCount: selectedFileCount, sheetCount: selectedSheetCount })}
        >
          {t('files.selectedForMerge', { fileCount: selectedFileCount, sheetCount: selectedSheetCount })}
        </span>
      )}
    </div>
  );
}
