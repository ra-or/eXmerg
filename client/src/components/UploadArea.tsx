import { useCallback, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { isAllowedFile, DEFAULT_FILE_LIMITS } from 'shared';
import { HISTORY_DRAG_TYPE } from './DownloadHistory';
import { useT } from '../i18n';

const MAX_SIZE = DEFAULT_FILE_LIMITS.maxFileSizeBytes;
const MAX_FILES = DEFAULT_FILE_LIMITS.maxFilesPerRequest;
const MAX_TOTAL_BYTES = DEFAULT_FILE_LIMITS.maxTotalSizeBytes;

export function UploadArea() {
  const t = useT();
  const addFiles       = useStore((s) => s.addFiles);
  const addHistoryFile = useStore((s) => s.addHistoryFile);
  const filesInStore   = useStore((s) => s.files);
  const fileCount      = filesInStore.length;
  const currentTotalBytes = filesInStore.reduce((s, f) => s + (f.size ?? 0), 0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [skippedMessage, setSkippedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!skippedMessage) return;
    const id = setTimeout(() => setSkippedMessage(null), 6000);
    return () => clearTimeout(id);
  }, [skippedMessage]);

  const validateAndAdd = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const valid: File[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const f = fileList[i];
        if (f && isAllowedFile(f.name) && f.size <= MAX_SIZE) valid.push(f);
      }
      const remainingCount = Math.max(0, MAX_FILES - fileCount);
      const remainingBytes = Math.max(0, MAX_TOTAL_BYTES - currentTotalBytes);
      const toAdd: File[] = [];
      let usedBytes = 0;
      for (const f of valid) {
        if (toAdd.length >= remainingCount) break;
        if (usedBytes + f.size > remainingBytes) break;
        toAdd.push(f);
        usedBytes += f.size;
      }
      const skipped = fileList.length - toAdd.length;
      if (skipped > 0) {
        setSkippedMessage(t('upload.skippedInvalid', {
          n: skipped,
          mb: Math.round(MAX_SIZE / (1024 * 1024)),
          totalMb: Math.round(MAX_TOTAL_BYTES / (1024 * 1024)),
        }));
      }
      if (toAdd.length) addFiles(toAdd);
    },
    [addFiles, fileCount, currentTotalBytes, t]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // History-Eintrag als Quelle hinzufügen (Drag from DownloadHistory)
      const historyData = e.dataTransfer.getData(HISTORY_DRAG_TYPE);
      if (historyData) {
        e.preventDefault();
        setIsDragOver(false);
        try {
          addHistoryFile(JSON.parse(historyData));
        } catch { /* ignore */ }
        return;
      }
      e.preventDefault();
      setIsDragOver(false);
      validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd]
  );
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const full = fileCount >= MAX_FILES || currentTotalBytes >= MAX_TOTAL_BYTES;

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      className={[
        'relative flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200',
        isDragOver
          ? 'border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/20'
          : full
          ? 'border-surface-500 bg-surface-800 opacity-60 cursor-not-allowed'
          : 'border-dashed border-zinc-400 dark:border-surface-500 bg-zinc-100 dark:bg-surface-800 hover:border-zinc-500 dark:hover:border-zinc-500 cursor-pointer',
      ].join(' ')}
    >
      {/* Icon */}
      <div className={[
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
        isDragOver
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
          : 'border-zinc-400 dark:border-surface-500 bg-zinc-200 dark:bg-surface-700 text-zinc-500',
      ].join(' ')}>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.987 4.595A4.5 4.5 0 0117.25 19.5H6.75z" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={['text-sm font-medium', isDragOver ? 'text-emerald-600 dark:text-emerald-300' : 'text-zinc-700 dark:text-zinc-300'].join(' ')}>
          {isDragOver ? t('upload.dropNow') : full ? t('upload.maxReached') : fileCount === 0 ? t('upload.hintEmpty') : t('upload.hint')}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-600 mt-0.5">
          {t('upload.limits', { n: MAX_FILES, mb: MAX_SIZE / 1024 / 1024, totalMb: MAX_TOTAL_BYTES / 1024 / 1024 })}
        </p>
        {skippedMessage && (
          <p className="text-xs text-amber-500 dark:text-amber-400 mt-1" role="alert">
            {skippedMessage}
          </p>
        )}
      </div>

      {/* Zähler */}
      {fileCount > 0 && (
        <span className="shrink-0 text-xs font-mono text-zinc-500 bg-zinc-200 dark:bg-surface-700 border border-zinc-400 dark:border-surface-500 px-2 py-1 rounded">
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
