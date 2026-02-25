import { useCallback, useState } from 'react';
import { useStore, type RejectedFile, type UploadErrorReason } from '../store/useStore';
import { isAllowedFile, DEFAULT_FILE_LIMITS } from 'shared';
import { HISTORY_DRAG_TYPE } from '../components/DownloadHistory';

/** Drag-Typ für Umsortieren in der Dateiliste – Upload-Bereich zeigt dann kein Overlay. */
export const REORDER_DRAG_TYPE = 'application/x-exmerg-reorder';

const MAX_SIZE = DEFAULT_FILE_LIMITS.maxFileSizeBytes;
const MAX_FILES = DEFAULT_FILE_LIMITS.maxFilesPerRequest;
const MAX_TOTAL_BYTES = DEFAULT_FILE_LIMITS.maxTotalSizeBytes;

function buildRejectedList(
  fileList: FileList,
  fileCount: number,
  currentTotalBytes: number,
): { rejected: RejectedFile[]; toAdd: File[] } {
  const remainingCount = Math.max(0, MAX_FILES - fileCount);
  const remainingBytes = Math.max(0, MAX_TOTAL_BYTES - currentTotalBytes);
  const rejected: RejectedFile[] = [];
  const validCandidates: File[] = [];

  for (let i = 0; i < fileList.length; i++) {
    const f = fileList[i];
    if (!f) continue;
    const reasons: UploadErrorReason[] = [];
    if (!isAllowedFile(f.name)) reasons.push('invalidType');
    if (f.size > MAX_SIZE) reasons.push('fileTooLarge');
    if (reasons.length > 0) {
      rejected.push({ name: f.name, reasons });
    } else {
      validCandidates.push(f);
    }
  }

  const toAdd: File[] = [];
  let usedBytes = 0;
  for (const f of validCandidates) {
    if (toAdd.length >= remainingCount) {
      rejected.push({ name: f.name, reasons: ['totalSizeExceeded'] });
      continue;
    }
    if (usedBytes + f.size > remainingBytes) {
      rejected.push({ name: f.name, reasons: ['totalSizeExceeded'] });
      continue;
    }
    toAdd.push(f);
    usedBytes += f.size;
  }

  return { rejected, toAdd };
}

/**
 * Drop-Logik für Dateien (ganze Seite oder Upload-Bereich).
 * Gibt Handler und validateAndAdd zurück; isDragOver für Overlay-Feedback.
 */
export function useFileDrop() {
  const addFiles = useStore((s) => s.addFiles);
  const setRejectedFiles = useStore((s) => s.setRejectedFiles);
  const addHistoryFile = useStore((s) => s.addHistoryFile);
  const filesInStore = useStore((s) => s.files);
  const fileCount = filesInStore.length;
  const currentTotalBytes = filesInStore.reduce((s, f) => s + (f.size ?? 0), 0);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndAdd = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const { rejected, toAdd } = buildRejectedList(fileList, fileCount, currentTotalBytes);
      setRejectedFiles(rejected);
      if (toAdd.length) addFiles(toAdd);
    },
    [addFiles, setRejectedFiles, fileCount, currentTotalBytes],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(REORDER_DRAG_TYPE)) return;
      const historyData = e.dataTransfer.getData(HISTORY_DRAG_TYPE);
      if (historyData) {
        e.preventDefault();
        setIsDragOver(false);
        try {
          addHistoryFile(JSON.parse(historyData));
        } catch {
          /* ignore */
        }
        return;
      }
      e.preventDefault();
      setIsDragOver(false);
      validateAndAdd(e.dataTransfer.files);
    },
    [validateAndAdd, addHistoryFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(REORDER_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    // Nur ausblenden wenn wir den Container wirklich verlassen (nicht in ein Kind wechseln)
    const relatedTarget = e.relatedTarget as Node | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  }, []);

  return {
    onDrop,
    onDragOver,
    onDragLeave,
    isDragOver,
    validateAndAdd,
    full: fileCount >= MAX_FILES || currentTotalBytes >= MAX_TOTAL_BYTES,
  };
}
