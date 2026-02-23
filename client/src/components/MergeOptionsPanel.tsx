import { useMemo, useState } from 'react';
import { useStore, sortFileList } from '../store/useStore';
import type { MergeMode, SheetNameFilterOption, SheetSelectionMode } from 'shared';
import {
  sanitizeWorksheetName,
  truncateWorksheetName,
  ensureUniqueWorksheetName,
} from 'shared';
import { useT } from '../i18n';

const MODES: {
  value: MergeMode;
  icon: string;
  label: string;
  desc: string;
  badge?: string;
  badgeColor?: 'green' | 'sky' | 'amber';
  formatPreserved: boolean;
}[] = [
  {
    value: 'one_file_per_sheet',
    icon: '🗂️',
    label: 'Eine Datei = ein Sheet',
    desc: 'Jede Datei bekommt ein eigenes Sheet. Farben, Rahmen, verbundene Zellen, Spaltenbreiten und Formeln bleiben vollständig erhalten. Unterstützt XLSX und ODS.',
    badge: 'Formatierung',
    badgeColor: 'sky',
    formatPreserved: true,
  },
  {
    value: 'consolidated_sheets',
    icon: '📊',
    label: 'Konsolidierung + Einzelne Sheets',
    desc: 'Sheet 1 = Zusammenfassung: numerische Werte werden zelladressgenau summiert, Formeln bleiben mit aktualisierten Ergebnissen erhalten. Danach folgt jede Datei als eigenes formatiertes Sheet. Unterstützt XLSX und ODS.',
    badge: 'Konsolidierung',
    badgeColor: 'green',
    formatPreserved: true,
  },
  {
    value: 'all_to_one_sheet',
    icon: '📋',
    label: 'Alles in eine Tabelle',
    desc: 'Alle Dateien werden untereinander in ein einziges Sheet gestapelt – inklusive Farben, Rahmen, verbundene Zellen, Spaltenbreiten und Formeln. Unterstützt XLSX und ODS.',
    badge: 'Formatierung',
    badgeColor: 'sky',
    formatPreserved: true,
  },
  {
    value: 'all_with_source_column',
    icon: '🏷️',
    label: 'Mit Herkunftsspalte',
    desc: 'Wie „Alles in eine Tabelle", jedoch mit einer zusätzlichen Spalte ganz links, die für jede Datei den Dateinamen anzeigt. Vollständige Formatierung bleibt erhalten. Unterstützt XLSX und ODS.',
    badge: 'Herkunft',
    badgeColor: 'amber',
    formatPreserved: true,
  },
  {
    value: 'row_per_file_no_sum',
    icon: '📈',
    label: 'Zeilenmatrix',
    desc: 'Jede Datei wird zu einer Zeile, Spaltenheader aus Zellreferenzen (A1, B1, …). Nur die Dateien, keine Summenzeile.',
    badge: 'Matrix',
    badgeColor: 'amber',
    formatPreserved: false,
  },
  {
    value: 'row_per_file',
    icon: '📊',
    label: 'Zeilenmatrix mit Summen',
    desc: 'Wie Zeilenmatrix, plus eine Gesamt-Zeile unten mit den Spaltensummen. Ideal für tägliche Berichte.',
    badge: 'Matrix',
    badgeColor: 'amber',
    formatPreserved: false,
  },
];

type MergeOptions = ReturnType<typeof useStore.getState>['mergeOptions'];

function SheetSelectionSection({
  mergeOptions,
  setMergeOptions,
  t,
}: {
  mergeOptions: MergeOptions;
  setMergeOptions: (o: MergeOptions) => void;
  t: (key: string) => string;
}) {
  const [filterOpen, setFilterOpen] = useState(!!mergeOptions.sheetNameFilter?.values?.length);
  const sheetMode: SheetSelectionMode = mergeOptions.sheetSelectionMode ?? 'all';
  const filter = mergeOptions.sheetNameFilter;
  const valuesText = filter?.values?.join('\n') ?? '';

  const setSheetMode = (mode: SheetSelectionMode) => {
    setMergeOptions({ ...mergeOptions, sheetSelectionMode: mode === 'all' ? undefined : mode });
  };

  const setFilterEnabled = (enabled: boolean) => {
    if (!enabled) {
      setMergeOptions({ ...mergeOptions, sheetNameFilter: undefined });
      setFilterOpen(false);
      return;
    }
    setFilterOpen(true);
    setMergeOptions({
      ...mergeOptions,
      sheetNameFilter: {
        mode: 'include',
        values: [],
        match: 'exact',
        caseSensitive: false,
      },
    });
  };

  const updateFilter = (updates: Partial<SheetNameFilterOption>) => {
    const next: SheetNameFilterOption = {
      mode: filter?.mode ?? 'include',
      values: filter?.values ?? [],
      match: filter?.match ?? 'exact',
      caseSensitive: filter?.caseSensitive ?? false,
      ...updates,
    };
    setMergeOptions({ ...mergeOptions, sheetNameFilter: next });
  };

  const setValuesFromText = (text: string) => {
    const values = text.split(/\r?\n/).map((s) => s.trim());
    updateFilter({ values });
  };

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 shrink-0">{t('merge.sheetSelection')}</span>
        <button
          type="button"
          onClick={() => setSheetMode('all')}
          className={[
            'px-3 py-1 rounded text-xs font-medium border transition-colors',
            sheetMode === 'all'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border-zinc-400 dark:border-surface-500 hover:border-zinc-500 dark:hover:border-zinc-400',
          ].join(' ')}
        >
          {t('merge.sheetAll')}
        </button>
        <button
          type="button"
          onClick={() => setSheetMode('first')}
          className={[
            'px-3 py-1 rounded text-xs font-medium border transition-colors',
            sheetMode === 'first'
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : 'bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border-zinc-400 dark:border-surface-500 hover:border-zinc-500 dark:hover:border-zinc-400',
          ].join(' ')}
        >
          {t('merge.sheetFirst')}
        </button>
      </div>

      <div className="rounded-lg border border-zinc-300 dark:border-surface-600 overflow-hidden">
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2 text-left text-xs bg-zinc-100 dark:bg-surface-800/60 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-surface-700"
        >
          <span>{t('merge.sheetFilter')}</span>
          <span className="text-zinc-500">{filterOpen ? '▼' : '▶'}</span>
        </button>
        {filterOpen && (
          <div className="p-3 pt-0 space-y-2 border-t border-zinc-200 dark:border-surface-600 overflow-visible">
            {!filter ? (
              <button
                type="button"
                onClick={() => setFilterEnabled(true)}
                className="text-xs text-emerald-500 hover:text-emerald-400"
              >
                + {t('merge.sheetFilter')} aktivieren
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => updateFilter({ mode: 'include' })}
                    className={[
                      'px-2 py-1 rounded text-xs border',
                      filter.mode === 'include'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-200 dark:bg-surface-700 border-zinc-400 dark:border-surface-500 text-zinc-600 dark:text-zinc-400',
                    ].join(' ')}
                  >
                    {t('merge.sheetFilterInclude')}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFilter({ mode: 'exclude' })}
                    className={[
                      'px-2 py-1 rounded text-xs border',
                      filter.mode === 'exclude'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-200 dark:bg-surface-700 border-zinc-400 dark:border-surface-500 text-zinc-600 dark:text-zinc-400',
                    ].join(' ')}
                  >
                    {t('merge.sheetFilterExclude')}
                  </button>
                </div>
                <div className="min-w-0">
                  <label className="block text-xs text-zinc-500 mb-1">{t('merge.sheetFilterValues')}</label>
                  <textarea
                    value={valuesText}
                    onChange={(e) => setValuesFromText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.stopPropagation()}
                    placeholder={'z. B. Tabelle1\nDaten\nSheet2'}
                    rows={5}
                    className="w-full min-h-[7rem] px-2 py-1.5 text-xs rounded border border-zinc-400 dark:border-surface-500 bg-white dark:bg-surface-700 text-zinc-800 dark:text-zinc-200 resize-y align-top"
                  />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500">{t('merge.sheetFilterMatch')}</span>
                  {(['exact', 'contains', 'regex'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => updateFilter({ match: m })}
                      className={[
                        'px-2 py-0.5 rounded text-xs border',
                        filter.match === m || (!filter.match && m === 'exact')
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-zinc-200 dark:bg-surface-700 border-zinc-400 dark:border-surface-500 text-zinc-600 dark:text-zinc-400',
                      ].join(' ')}
                    >
                      {t(m === 'exact' ? 'merge.sheetFilterExact' : m === 'contains' ? 'merge.sheetFilterContains' : 'merge.sheetFilterRegex')}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={filter.caseSensitive ?? false}
                    onChange={(e) => updateFilter({ caseSensitive: e.target.checked })}
                    className="rounded border-zinc-400 dark:border-surface-500"
                  />
                  {t('merge.sheetFilterCase')}
                </label>
                <button
                  type="button"
                  onClick={() => setFilterEnabled(false)}
                  className="text-xs text-red-500 hover:text-red-400"
                >
                  Filter entfernen
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function MergeOptionsPanel() {
  const t = useT();
  const mergeOptions    = useStore((s) => s.mergeOptions);
  const setMergeOptions = useStore((s) => s.setMergeOptions);
  const outputFormat    = useStore((s) => s.outputFormat);
  const setOutputFormat = useStore((s) => s.setOutputFormat);
  const files           = useStore((s) => s.files);
  const fileSortOrder   = useStore((s) => s.fileSortOrder);
  const sheetInfo       = useStore((s) => s.sheetInfo);

  const [customNamesOpen, setCustomNamesOpen] = useState(false);

  const currentMode = mergeOptions.mode;
  const sortedFiles = sortFileList(files, fileSortOrder);
  const showCustomSheetNames = currentMode === 'one_file_per_sheet' || currentMode === 'consolidated_sheets';

  type MergeOrderRow = { file: typeof sortedFiles[number]; sheetId: string; sheetName: string; fileBaseName: string; sheetCount: number };

  /** Reihen in Merge-Reihenfolge (eine Zeile = ein Reiter in der Ausgabedatei). */
  const mergeOrderRows = useMemo((): MergeOrderRow[] => {
    const rows: MergeOrderRow[] = [];
    for (const file of sortedFiles) {
      const fileBaseName = file.filename.replace(/\.[^.]+$/, '');
      const sheets = sheetInfo[file.id]?.sheets ?? [];
      if (sheets.length > 1) {
        for (const sheet of sheets) {
          rows.push({ file, sheetId: sheet.id, sheetName: sheet.name, fileBaseName, sheetCount: sheets.length });
        }
      } else {
        rows.push({ file, sheetId: '0', sheetName: sheets[0]?.name ?? '', fileBaseName, sheetCount: 1 });
      }
    }
    return rows;
  }, [sortedFiles, sheetInfo]);

  /** Effektive Reiter-Namen in Merge-Reihenfolge (sanitized, gekürzt, eindeutig) wie in der Merge-Datei. Key: `${filename}\t${sheetId}` */
  const effectiveNames = useMemo(() => {
    const used = new Set<string>();
    const effectiveNames = new Map<string, string>();
    const custom = mergeOptions.customSheetNames ?? {};
    for (const row of mergeOrderRows) {
      const byFile = custom[row.file.filename] ?? {};
      const defaultRaw = row.sheetCount > 1 ? `${row.fileBaseName} – ${row.sheetName}` : row.fileBaseName;
      const rawInput = byFile[row.sheetId]?.trim() ?? '';
      const raw = rawInput !== '' ? rawInput : defaultRaw;
      const effective = ensureUniqueWorksheetName(
        truncateWorksheetName(sanitizeWorksheetName(raw)),
        used,
      );
      used.add(effective);
      effectiveNames.set(`${row.file.filename}\t${row.sheetId}`, effective);
    }
    return effectiveNames;
  }, [mergeOrderRows, mergeOptions.customSheetNames]);

  /** Schnellnamen-Muster: alle Reiter in Merge-Reihenfolge mit einem Muster belegen (oder zurücksetzen). */
  const applyNamePattern = (patternId: string) => {
    if (patternId === 'reset') {
      setMergeOptions({ ...mergeOptions, customSheetNames: undefined });
      return;
    }
    const patterns: Record<string, (index: number) => string> = {
      '01': (i) => String(i + 1).padStart(2, '0'),
      '001': (i) => String(i + 1).padStart(3, '0'),
      '1': (i) => String(i + 1),
      'sheet': (i) => `Sheet ${i + 1}`,
      'tab': (i) => `Tab ${String(i + 1).padStart(2, '0')}`,
      'data': (i) => `Data ${String(i + 1).padStart(2, '0')}`,
    };
    const fn = patterns[patternId];
    if (!fn) return;
    const next: Record<string, Record<string, string>> = {};
    for (let i = 0; i < mergeOrderRows.length; i++) {
      const row = mergeOrderRows[i];
      if (!next[row.file.filename]) next[row.file.filename] = {};
      next[row.file.filename][row.sheetId] = fn(i);
    }
    setMergeOptions({ ...mergeOptions, customSheetNames: next });
  };

  const setMode = (mode: MergeMode) => {
    setMergeOptions({ ...mergeOptions, mode });
  };

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-4">
        {t('merge.title')}
      </h2>

      {files.length === 0 && (
        <p className="text-sm text-zinc-500 mb-4">{t('merge.hintNoFiles')}</p>
      )}

      {/* ── Ausgabeformat ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-zinc-500 shrink-0">{t('merge.output')}</span>
        {(['xlsx', 'ods'] as const).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onClick={() => setOutputFormat(fmt)}
            className={[
              'px-3 py-1 rounded text-xs font-medium border transition-colors',
              outputFormat === fmt
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-zinc-200 dark:bg-surface-700 text-zinc-600 dark:text-zinc-400 border-zinc-400 dark:border-surface-500 hover:border-zinc-500 dark:hover:border-zinc-400',
            ].join(' ')}
          >
            .{fmt}
          </button>
        ))}
      </div>

      {/* ── Sheet-Auswahl (Modus + optional Filter) ────────────────────── */}
      <SheetSelectionSection mergeOptions={mergeOptions} setMergeOptions={setMergeOptions} t={t} />

      {/* Merge-Modi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MODES.map((m) => {
            const active = currentMode === m.value;
            const badgeClasses: Record<string, string> = {
              green: 'bg-emerald-500/20 text-emerald-400',
              sky:   'bg-sky-500/15 text-sky-400',
              amber: 'bg-amber-500/15 text-amber-400',
            };
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={[
                  'w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-all duration-150',
                  active
                    ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/20'
                    : 'bg-zinc-200 dark:bg-surface-700 border-zinc-400 dark:border-surface-500 hover:border-zinc-500 dark:hover:border-zinc-500 hover:bg-zinc-300 dark:hover:bg-surface-600',
                ].join(' ')}
              >
                {/* Radio-Kreis */}
                <div className={[
                  'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  active ? 'border-emerald-500' : 'border-zinc-400 dark:border-zinc-600',
                ].join(' ')}>
                  {active && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                </div>

                <div className="min-w-0 flex-1">
                  {/* Titel-Zeile */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm leading-none">{m.icon}</span>
                    <p className={[
                      'text-sm font-medium leading-none',
                      active ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-800 dark:text-zinc-200',
                    ].join(' ')}>
                      {t(`mode.${m.value}` as 'mode.one_file_per_sheet')}
                    </p>
                    {m.badge && (
                      <span className={[
                        'text-xs px-1.5 py-0.5 rounded font-medium',
                        badgeClasses[m.badgeColor ?? 'sky'] ?? badgeClasses.sky,
                      ].join(' ')}>
                        {m.badge}
                      </span>
                    )}
                    <span
                      title={m.formatPreserved ? 'Formatierung wird vollständig erhalten' : 'Neue strukturierte Ausgabe (eigenes Layout)'}
                      className={[
                        'ml-auto text-xs shrink-0',
                        m.formatPreserved ? 'text-emerald-500/70' : 'text-amber-500/60',
                      ].join(' ')}
                    >
                      {m.formatPreserved ? '✦ Format' : '⊞ Matrix'}
                    </span>
                  </div>

                  {/* Beschreibung */}
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">{t(`mode.${m.value}.desc` as 'mode.one_file_per_sheet.desc')}</p>
                </div>
              </button>
            );
          })}
      </div>

      {/* Namen der Tab-Reiter in der Ausgabedatei (ausklappbar) */}
      {showCustomSheetNames && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-surface-600">
          <button
            type="button"
            onClick={() => setCustomNamesOpen((o) => !o)}
            className="w-full flex items-center gap-2 text-left rounded-lg py-2 px-2 -mx-2 hover:bg-zinc-100 dark:hover:bg-surface-700/50 transition-colors"
            aria-expanded={customNamesOpen}
          >
            <svg
              className={['w-4 h-4 shrink-0 text-zinc-500 transition-transform', customNamesOpen && 'rotate-90'].filter(Boolean).join(' ')}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('merge.customSheetNames')}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate flex-1 min-w-0">
              {!customNamesOpen && t('merge.customSheetNamesCollapsed')}
            </span>
          </button>
          {customNamesOpen && (
            <div className="mt-3 pl-6 space-y-3">
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {t('merge.customSheetNamesIntro')}
              </p>
              {mergeOrderRows.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">{t('merge.namePatternsLabel')}</span>
                  {[
                    { id: '01', labelKey: 'merge.namePattern01' as const },
                    { id: '001', labelKey: 'merge.namePattern001' as const },
                    { id: '1', labelKey: 'merge.namePattern1' as const },
                    { id: 'sheet', labelKey: 'merge.namePatternSheet' as const },
                    { id: 'tab', labelKey: 'merge.namePatternTab' as const },
                    { id: 'data', labelKey: 'merge.namePatternData' as const },
                    { id: 'reset', labelKey: 'merge.namePatternReset' as const },
                  ].map(({ id, labelKey }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyNamePattern(id)}
                      className={[
                        'px-2 py-1 rounded text-xs font-medium border transition-colors',
                        id === 'reset'
                          ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15'
                          : 'border-zinc-400 dark:border-surface-500 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-surface-600',
                      ].join(' ')}
                    >
                      {t(labelKey)}
                    </button>
                  ))}
                </div>
              )}
              {sortedFiles.length === 0 ? (
                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                  {t('merge.customSheetNamesNoFiles')}
                </p>
              ) : (
                <>
                  {/* Spaltenüberschriften (bleiben beim Scrollen sichtbar) */}
                  <div className="grid grid-cols-[1fr,1fr] gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-surface-600 pb-1.5">
                    <span>{t('merge.customSheetNamesColSource')}</span>
                    <span>{t('merge.customSheetNamesColOutput')}</span>
                  </div>
                  <div className="space-y-4 max-h-[280px] overflow-auto pr-1 mt-1.5">
                  {sortedFiles.map((file) => {
                    const sheets = sheetInfo[file.id]?.sheets ?? [];
                    const byFile = mergeOptions.customSheetNames?.[file.filename] ?? {};
                    const updateSheetName = (sheetId: string, value: string) => {
                      const nextByFile = { ...byFile };
                      const v = value.trim();
                      if (v) nextByFile[sheetId] = v;
                      else delete nextByFile[sheetId];
                      const next = { ...(mergeOptions.customSheetNames ?? {}) };
                      if (Object.keys(nextByFile).length) next[file.filename] = nextByFile;
                      else delete next[file.filename];
                      setMergeOptions({ ...mergeOptions, customSheetNames: Object.keys(next).length ? next : undefined });
                    };
                    const fileBaseName = file.filename.replace(/\.[^.]+$/, '');
                    if (sheets.length > 1) {
                      return (
                        <div key={file.id} className="space-y-2">
                          <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate" title={file.filename}>
                            {t('merge.customSheetNamesMulti')}: {file.filename}
                          </p>
                          <div className="space-y-1.5 pl-3 border-l-2 border-zinc-200 dark:border-surface-600">
                            {sheets.map((sheet) => {
                              const key = `${file.filename}\t${sheet.id}`;
                              const effectiveName = effectiveNames.get(key) ?? `${fileBaseName} – ${sheet.name}`;
                              return (
                                <div key={sheet.id} className="grid grid-cols-[1fr,1fr] gap-2 items-center">
                                  <span className="text-xs text-zinc-500 dark:text-zinc-500 truncate" title={sheet.name}>
                                    → {sheet.name}
                                  </span>
                                  <input
                                    type="text"
                                    value={effectiveName}
                                    onChange={(e) => updateSheetName(sheet.id, e.target.value)}
                                    className="text-xs px-2 py-1.5 rounded border border-zinc-400 dark:border-surface-500 bg-zinc-100 dark:bg-surface-800 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                                    title={effectiveName}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    const key0 = `${file.filename}\t0`;
                    const effectiveName0 = effectiveNames.get(key0) ?? fileBaseName;
                    return (
                      <div key={file.id} className="grid grid-cols-[1fr,1fr] gap-2 items-center">
                        <span className="text-xs text-zinc-600 dark:text-zinc-500 truncate" title={file.filename}>
                          {t('merge.customSheetNamesSingle')}: {file.filename}
                        </span>
                        <input
                          type="text"
                          value={effectiveName0}
                          onChange={(e) => updateSheetName('0', e.target.value)}
                          className="text-xs px-2 py-1.5 rounded border border-zinc-400 dark:border-surface-500 bg-zinc-100 dark:bg-surface-800 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                          title={effectiveName0}
                        />
                      </div>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
