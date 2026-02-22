import { useStore } from '../store/useStore';
import { StatusBanner } from './StatusBanner';
import { useT } from '../i18n';

export function DuplicateFilesBanner() {
  const t = useT();
  const duplicateFiles = useStore((s) => s.duplicateFiles);
  const toggleDuplicateReplace = useStore((s) => s.toggleDuplicateReplace);
  const replaceSelectedDuplicates = useStore((s) => s.replaceSelectedDuplicates);
  const replaceAllDuplicates = useStore((s) => s.replaceAllDuplicates);
  const clearDuplicates = useStore((s) => s.clearDuplicates);

  if (duplicateFiles.length === 0) return null;

  const title =
    duplicateFiles.length === 1
      ? `${duplicateFiles[0]!.name} – ${t('duplicates.replacePrompt')}`
      : `${t('duplicates.alreadyPresent')} (${duplicateFiles.length})`;
  const selectedCount = duplicateFiles.filter((d) => d.replace).length;

  return (
    <StatusBanner
      variant="warning"
      title={title}
      itemCount={duplicateFiles.length}
      collapsible
      onClose={clearDuplicates}
      closable
      closeLabel={t('duplicates.dismiss')}
      expandLabel={t('duplicates.expand')}
      collapseLabel={t('duplicates.collapse')}
    >
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              replaceSelectedDuplicates();
            }}
            disabled={selectedCount === 0}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            title={t('duplicates.replaceSelected')}
          >
            {t('duplicates.replaceSelected')}
          </button>
          <button
            type="button"
            onClick={() => replaceAllDuplicates()}
            className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium text-xs"
            title={t('duplicates.replaceAll')}
          >
            {t('duplicates.replaceAll')}
          </button>
          <button
            type="button"
            onClick={clearDuplicates}
            className="px-2 py-0.5 rounded hover:bg-amber-500/20 text-amber-300 text-xs"
            title={t('duplicates.replaceNone')}
          >
            {t('duplicates.replaceNone')}
          </button>
        </div>
        <ul className="list-none pl-0 space-y-1 border-t border-amber-500/20 pt-1.5 mt-1.5 max-h-48 overflow-y-auto">
          {duplicateFiles.map((d) => (
            <li key={d.name} className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer min-w-0 flex-1">
                <input
                  type="checkbox"
                  checked={d.replace}
                  onChange={() => toggleDuplicateReplace(d.name)}
                  className="rounded border-amber-500/50 bg-amber-500/10 text-amber-500 focus:ring-amber-500/50 shrink-0"
                  title={t('duplicates.replacePrompt')}
                />
                <span className="text-amber-300/95 truncate" title={d.name}>
                  {d.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </StatusBanner>
  );
}
