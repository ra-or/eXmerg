import { useState } from 'react';
import { useStore } from '../store/useStore';
import type { MergeMode } from 'shared';
import { useT } from '../i18n';

const MODE_LABELS: Record<MergeMode, string> = {
  all_to_one_sheet:       'Alles in 1 Sheet',
  one_file_per_sheet:     '1 Sheet / Datei',
  all_with_source_column: 'Mit Herkunftsspalte',
  consolidated_sheets:    'Konsolidierung + Einzelne Sheets',
  row_per_file:           'Zeilenmatrix mit Summen',
  row_per_file_no_sum:    'Zeilenmatrix',
};

const STORAGE_KEY = 'mergeTemplates';

interface MergeTemplate {
  id: string;
  name: string;
  mode: MergeMode;
  outputFormat: 'xlsx' | 'ods';
  createdAt: number;
}

function loadTemplates(): MergeTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MergeTemplate[];
  } catch { return []; }
}

function saveTemplates(list: MergeTemplate[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

export function TemplatesPanel() {
  const t = useT();
  const mergeOptions  = useStore((s) => s.mergeOptions);
  const outputFormat  = useStore((s) => s.outputFormat);
  const setMergeOptions = useStore((s) => s.setMergeOptions);
  const setOutputFormat = useStore((s) => s.setOutputFormat);

  const [templates, setTemplates] = useState<MergeTemplate[]>(loadTemplates);
  const [nameInput, setNameInput] = useState('');
  const [showSave, setShowSave]   = useState(false);

  const currentMode = mergeOptions.mode;

  const handleSave = () => {
    const name = nameInput.trim();
    if (!name || !currentMode) return;
    const newTemplate: MergeTemplate = {
      id: Math.random().toString(36).slice(2),
      name,
      mode: currentMode,
      outputFormat,
      createdAt: Date.now(),
    };
    const next = [...templates, newTemplate];
    setTemplates(next);
    saveTemplates(next);
    setNameInput('');
    setShowSave(false);
  };

  const handleApply = (t: MergeTemplate) => {
    setMergeOptions({ ...mergeOptions, mode: t.mode });
    setOutputFormat(t.outputFormat);
  };

  const handleDelete = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    setTemplates(next);
    saveTemplates(next);
  };

  return (
    <div className="space-y-2 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span className="text-xs font-medium text-zinc-600 uppercase tracking-wide">{t('templates.title')}</span>
        <div className="h-px flex-1 bg-zinc-300 dark:bg-surface-700" />
        <button
          type="button"
          onClick={() => setShowSave((v) => !v)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 border border-zinc-400 dark:border-surface-600 hover:border-zinc-500 dark:hover:border-surface-500 transition-colors"
          title={t('templates.saveTitle')}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('templates.save')}
        </button>
      </div>

      {/* Speichern-Formular */}
      {showSave && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-surface-800 border border-zinc-300 dark:border-surface-600 animate-slide-up">
                <div className="flex-1 min-w-0">
                  <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSave(false); }}
              autoFocus
              placeholder={t('templates.namePlaceholder')}
              className="w-full bg-zinc-200 dark:bg-surface-700 border border-zinc-400 dark:border-surface-500 rounded px-2 py-1 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-emerald-500/50"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-1">
              {currentMode ? MODE_LABELS[currentMode] : '–'} · {outputFormat.toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!nameInput.trim()}
            className="btn-primary py-1.5 px-3 text-xs shrink-0 disabled:opacity-40"
          >
            OK
          </button>
          <button type="button" onClick={() => setShowSave(false)} className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Template-Liste */}
      {templates.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {templates.map((t) => {
            const isActive = currentMode === t.mode && outputFormat === t.outputFormat;
            return (
              <li key={t.id} className={[
                'flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border transition-colors group',
                isActive
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-100 dark:bg-surface-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-surface-600 hover:border-zinc-400 dark:hover:border-surface-500',
              ].join(' ')}>
                <button
                  type="button"
                  onClick={() => handleApply(t)}
                  className="truncate max-w-[120px]"
                  title={`${MODE_LABELS[t.mode]} · ${t.outputFormat.toUpperCase()}`}
                >
                  {t.name}
                </button>
                <span className="text-zinc-500 dark:text-zinc-700 shrink-0">·</span>
                <span className="text-zinc-500 dark:text-zinc-600 shrink-0 text-[10px]">{t.outputFormat}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(t.id)}
                  className="text-zinc-500 dark:text-zinc-700 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  title="Vorlage löschen"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {templates.length === 0 && !showSave && (
        <p className="text-xs text-zinc-500 dark:text-zinc-700 px-1">
          {t('templates.empty')}
        </p>
      )}
    </div>
  );
}
