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
 * User-freundliche Fehlermeldung für Validierung.
 * Mit limits werden die konkreten Grenzwerte in der Meldung angezeigt.
 */
export function getValidationErrorMessage(
  reason: 'extension' | 'size' | 'count' | 'totalSize',
  limits?: ValidationLimitOptions
): string {
  switch (reason) {
    case 'extension':
      return 'Ungültiges Dateiformat. Erlaubt: .xlsx, .xls, .ods';
    case 'size':
      return limits
        ? `Eine Datei ist zu groß. Maximal ${formatMb(limits.maxFileSizeBytes)} pro Datei erlaubt.`
        : 'Datei ist zu groß. Bitte maximale Dateigröße beachten.';
    case 'count':
      return limits
        ? `Zu viele Dateien. Maximal ${limits.maxFilesPerRequest} Dateien pro Merge erlaubt.`
        : 'Zu viele Dateien. Bitte die maximale Anzahl pro Anfrage beachten.';
    case 'totalSize':
      return limits
        ? `Gesamtgröße überschritten. Maximal ${formatMb(limits.maxTotalSizeBytes)} für alle Dateien zusammen erlaubt.`
        : 'Gesamtgröße aller Dateien überschritten.';
    default:
      return 'Validierungsfehler.';
  }
}
