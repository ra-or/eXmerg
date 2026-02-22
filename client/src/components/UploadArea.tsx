import { DEFAULT_FILE_LIMITS } from 'shared';
import { useT } from '../i18n';

const MAX_SIZE = DEFAULT_FILE_LIMITS.maxFileSizeBytes;
const MAX_FILES = DEFAULT_FILE_LIMITS.maxFilesPerRequest;
const MAX_TOTAL_BYTES = DEFAULT_FILE_LIMITS.maxTotalSizeBytes;

export interface UploadAreaProps {
  /** Von useFileDrop (MergePage) – Validierung + Hinzufügen */
  validateAndAdd: (fileList: FileList | null) => void;
  /** Limit erreicht (keine weiteren Dateien) */
  full: boolean;
  /** Aktuelle Dateianzahl (für Anzeige) */
  fileCount: number;
}

export function UploadArea({ validateAndAdd, full, fileCount }: UploadAreaProps) {
  const t = useT();
  const title = fileCount === 0 ? t('upload.title') : t('upload.titleMore');

  return (
    <div
      className={[
        'relative flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors',
        full
          ? 'border-zinc-300 dark:border-surface-600 bg-zinc-100 dark:bg-surface-800 opacity-60 cursor-not-allowed'
          : 'border-zinc-200 dark:border-surface-600 bg-zinc-100 dark:bg-surface-800',
      ].join(' ')}
    >
      {/* Icon */}
      <div
        className={[
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
          'border-zinc-300 dark:border-surface-500 bg-zinc-200 dark:bg-surface-700 text-zinc-500 dark:text-zinc-400',
        ].join(' ')}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.987 4.595A4.5 4.5 0 0117.25 19.5H6.75z" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {title}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">
          {t('upload.subtitle')}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">
          {fileCount === 0 ? t('upload.supports') : t('upload.limits', { n: MAX_FILES, mb: MAX_SIZE / 1024 / 1024, totalMb: MAX_TOTAL_BYTES / 1024 / 1024 })}
        </p>
      </div>

      {/* Zähler */}
      {fileCount > 0 && (
        <span className="shrink-0 text-xs font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-surface-700 border border-zinc-300 dark:border-surface-600 px-2 py-1 rounded">
          {fileCount}/{MAX_FILES}
        </span>
      )}

      {/* Button */}
      <label className={['btn-secondary shrink-0 text-xs', full ? 'pointer-events-none opacity-40' : 'cursor-pointer'].join(' ')}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        {t('upload.browse')}
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,.ods"
          className="hidden"
          disabled={full}
          onChange={(e) => validateAndAdd(e.target.files)}
        />
      </label>
    </div>
  );
}
