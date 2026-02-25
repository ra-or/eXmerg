import type {
  MergeApiResponse,
  MergeJobResponse,
  MergeOptions,
  SheetsResponse,
  HistoryEntry,
  MergeProgressEvent,
} from 'shared';

const API_BASE = '/api';

export async function fetchMerge(files: File[], options: MergeOptions): Promise<MergeApiResponse> {
  return fetchMergeWithProgress(files, options, null);
}

/**
 * Wie fetchMerge, aber mit XHR für echten Upload-Fortschritt.
 * onUploadProgress(pct) wird mit 0–100 aufgerufen; nach 100 läuft
 * der Server noch (Processing-Phase).
 * filename: optionaler gewünschter Dateiname, der dem Server mitgeteilt wird (für Verlauf).
 */
export function fetchMergeWithProgress(
  files: File[],
  options: MergeOptions,
  onUploadProgress: ((pct: number) => void) | null,
  filename?: string,
): Promise<MergeApiResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    form.append('options', JSON.stringify(options));
    if (filename) form.append('filename', filename);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + '/merge');

    if (onUploadProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
      // Upload abgeschlossen → Server verarbeitet noch
      xhr.upload.addEventListener('load', () => onUploadProgress(100));
    }

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText) as MergeApiResponse;
        if (xhr.status >= 400) {
          reject(new Error('success' in data && !data.success ? data.error : 'Merge fehlgeschlagen.'));
        } else {
          resolve(data);
        }
      } catch {
        reject(new Error('Merge fehlgeschlagen.'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Netzwerkfehler beim Merge.')));
    xhr.addEventListener('abort', () => reject(new Error('Merge abgebrochen.')));
    xhr.send(form);
  });
}

/** Liest die Sheet-Namen einer einzelnen Datei (für Sheet-Auswahl UI). */
export async function fetchSheets(file: File): Promise<SheetsResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(API_BASE + '/sheets', { method: 'POST', body: form });
  const data = (await res.json()) as SheetsResponse;
  if (!res.ok) throw new Error(data.error || 'Sheet-Namen konnten nicht geladen werden.');
  return data;
}

/**
 * Lädt eine einzelne Datei per XHR hoch (für sequenziellen Chunk-Upload).
 * Gibt die server-seitige fileId zurück.
 */
export function uploadFileToServer(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE + '/upload-file');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.upload.addEventListener('load', () => onProgress(100));

    xhr.addEventListener('load', () => {
      let data: { fileId?: string; error?: string };
      try {
        data = JSON.parse(xhr.responseText) as { fileId?: string; error?: string };
      } catch {
        const hint = xhr.status >= 400 ? ` (HTTP ${xhr.status})` : '';
        const excerpt =
          typeof xhr.responseText === 'string' && xhr.responseText.length > 0
            ? ' – Antwort ist kein JSON.'
            : ' – Server antwortet leer oder nicht mit JSON.';
        reject(new Error('Upload fehlgeschlagen.' + hint + excerpt));
        return;
      }
      if (xhr.status >= 400) {
        reject(new Error(data.error || `Upload fehlgeschlagen. (HTTP ${xhr.status})`));
        return;
      }
      if (!data.fileId) {
        reject(new Error('Server hat keine fileId zurückgegeben.'));
        return;
      }
      resolve(data.fileId);
    });
    xhr.addEventListener('error', () => reject(new Error('Netzwerkfehler beim Upload. Ist der Server erreichbar?')));
    xhr.addEventListener('abort', () => reject(new Error('Upload abgebrochen.')));
    xhr.send(form);
  });
}

/**
 * Startet einen Merge für bereits hochgeladene Dateien (fileIds-Modus).
 * Gibt sofort eine mergeId zurück; Fortschritt via subscribeToMergeProgress.
 */
export async function startMerge(
  fileIds: string[],
  fileNames: string[],
  options: MergeOptions,
  filename?: string,
): Promise<string> {
  const form = new FormData();
  form.append('options', JSON.stringify(options));
  form.append('fileIds', JSON.stringify(fileIds));
  form.append('fileNames', JSON.stringify(fileNames));
  if (filename) form.append('filename', filename);

  const res = await fetch(API_BASE + '/merge', { method: 'POST', body: form });
  const data = (await res.json()) as MergeApiResponse;
  if (!res.ok || !data.success) {
    throw new Error('error' in data ? data.error : 'Merge fehlgeschlagen.');
  }
  if (!('mergeId' in data)) throw new Error('Kein mergeId erhalten.');
  return (data as MergeJobResponse).mergeId;
}

/**
 * Bricht einen laufenden oder wartenden Merge ab.
 */
export async function cancelMerge(mergeId: string): Promise<void> {
  const res = await fetch(`/api/merge/${encodeURIComponent(mergeId)}/cancel`, { method: 'DELETE' });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Abbrechen fehlgeschlagen.');
  }
}

/**
 * Öffnet einen SSE-Stream für den laufenden Merge.
 * Gibt eine Cleanup-Funktion zurück (schließt den EventSource).
 */
export function subscribeToMergeProgress(
  mergeId: string,
  handlers: {
    onQueued?: (position: number) => void;
    onProgress?: (pct: number, msg: string) => void;
    onComplete: (downloadUrl: string, filename: string, warnings: string[]) => void;
    onError: (message: string) => void;
  },
): () => void {
  const es = new EventSource(API_BASE + '/progress/' + mergeId);

  es.onmessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data as string) as MergeProgressEvent;
      switch (data.type) {
        case 'queued':
          handlers.onQueued?.(data.position);
          break;
        case 'progress':
          handlers.onProgress?.(data.pct, data.msg);
          break;
        case 'complete':
          handlers.onComplete(data.downloadUrl, data.filename, data.warnings);
          es.close();
          break;
        case 'error':
          handlers.onError(data.message);
          es.close();
          break;
      }
    } catch {
      /* parse error ignorieren */
    }
  };

  es.onerror = () => {
    handlers.onError('Verbindung zum Server unterbrochen.');
    es.close();
  };

  return () => es.close();
}

/**
 * Lädt alle Dateien parallel mit max. `concurrency` gleichzeitigen Uploads.
 * onFileProgress(fileIdx, pct) wird pro Datei aufgerufen.
 * Gibt ein sortiertes Array { fileId, filename } zurück.
 */
export async function uploadFilesParallel(
  items: Array<{ file: File; idx: number }>,
  concurrency: number,
  onFileProgress: (idx: number, pct: number) => void,
): Promise<Array<{ idx: number; fileId: string }>> {
  const results: Array<{ idx: number; fileId: string }> = [];
  let next = 0;

  async function worker() {
    while (next < items.length) {
      const task = items[next++]!;
      const fileId = await uploadFileToServer(task.file, (pct) => onFileProgress(task.idx, pct));
      results.push({ idx: task.idx, fileId });
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results.sort((a, b) => a.idx - b.idx);
}

/** @deprecated Verlauf wird jetzt client-seitig (localStorage) verwaltet. */
export async function fetchHistory(): Promise<HistoryEntry[]> {
  return [];
}

export function getDownloadUrl(path: string): string {
  return API_BASE + path;
}
