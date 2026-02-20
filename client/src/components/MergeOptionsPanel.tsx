import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { MergeMode, SheetNameFilterOption, SheetSelectionMode } from 'shared';
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
  const files = useStore((s) => s.files);

  const currentMode = mergeOptions.mode;

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
    </div>
  );
}
