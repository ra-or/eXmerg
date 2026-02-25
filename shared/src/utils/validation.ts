import { getExtension, ALLOWED_EXTENSIONS } from '../types/files.js';

/**
 * Prüft, ob der Dateiname ein erlaubtes Format hat (nur Extension).
 */
export function validateExtension(filename: string): boolean {
  const ext = getExtension(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Prüft Größe gegen Maximum (Bytes).
 */
export function validateFileSize(sizeBytes: number, maxBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= maxBytes;
}

/**
 * Prüft Gesamtgröße (Summe aller Dateien) gegen Maximum (Bytes).
 */
export function validateTotalSize(totalBytes: number, maxBytes: number): boolean {
  return totalBytes >= 0 && totalBytes <= maxBytes;
}

/** Optionale Limits für genaue Fehlermeldungen (in Bytes bzw. Anzahl). */
export interface ValidationLimitOptions {
  maxFileSizeBytes: number;
  maxTotalSizeBytes: number;
  maxFilesPerRequest: number;
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/**
 * User-friendly validation error message.
 * With limits, the concrete thresholds are included in the message.
 */
export function getValidationErrorMessage(
  reason: 'extension' | 'size' | 'count' | 'totalSize',
  limits?: ValidationLimitOptions,
): string {
  switch (reason) {
    case 'extension':
      return 'Invalid file format. Allowed: .xlsx, .xls, .ods, .csv, .tsv';
    case 'size':
      return limits
        ? `File too large. Maximum ${formatMb(limits.maxFileSizeBytes)} per file.`
        : 'File too large. Please check the maximum file size.';
    case 'count':
      return limits
        ? `Too many files. Maximum ${limits.maxFilesPerRequest} files per merge.`
        : 'Too many files. Please check the maximum number per request.';
    case 'totalSize':
      return limits
        ? `Total size exceeded. Maximum ${formatMb(limits.maxTotalSizeBytes)} for all files combined.`
        : 'Total file size exceeded.';
    default:
      return 'Validation error.';
  }
}
