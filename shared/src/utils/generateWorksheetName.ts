/**
 * Excel worksheet name constraints.
 * @see https://support.microsoft.com/en-us/office/rename-a-worksheet-3f1f3f8e-3f53-4004-a077-7c9c337a6920
 */
export const WORKSHEET_NAME_MAX_LENGTH = 31;

/** Characters forbidden in Excel worksheet names: [] : * ? / \ */
const FORBIDDEN_CHARS = /[\[\]:*?/\\]/g;

const SEP = ' – '; // en-dash for "file – sheet"

const FALLBACK_NAME = 'Sheet';

/**
 * Sanitizes a worksheet name: removes forbidden characters and trims.
 * Never returns an empty string (uses fallback "Sheet" if empty after sanitize).
 */
export function sanitizeWorksheetName(name: string): string {
  const trimmed = (name ?? '').trim();
  if (trimmed === '') return FALLBACK_NAME;
  const sanitized = trimmed.replace(FORBIDDEN_CHARS, '_').trim();
  return sanitized === '' ? FALLBACK_NAME : sanitized;
}

/**
 * Truncates a worksheet name to 31 characters.
 * For "fileBaseName – sheetName" style names: preserves file part, truncates sheet part with ellipsis.
 * Otherwise truncates the whole string with ellipsis.
 */
export function truncateWorksheetName(name: string): string {
  const max = WORKSHEET_NAME_MAX_LENGTH;
  const s = (name ?? '').trim();
  if (s.length <= max) return s || FALLBACK_NAME;
  const idx = s.indexOf(SEP);
  if (idx !== -1) {
    const filePart = s.slice(0, idx);
    const sheetPart = s.slice(idx + SEP.length);
    if (filePart.length >= max) return (filePart.slice(0, max - 1) + '…') || FALLBACK_NAME;
    const maxSheetLen = max - filePart.length - SEP.length - 1; // 1 for ellipsis
    if (maxSheetLen <= 0) return (filePart.slice(0, max - 1) + '…') || FALLBACK_NAME;
    const truncatedSheet = sheetPart.length > maxSheetLen
      ? sheetPart.slice(0, maxSheetLen) + '…'
      : sheetPart;
    const result = filePart + SEP + truncatedSheet;
    return result.length > max ? result.slice(0, max - 1) + '…' : result;
  }
  return s.slice(0, max - 1) + '…';
}

/**
 * Returns a name unique within existingNames by appending " (2)", " (3)", … as needed.
 * Result is truncated to 31 characters if the suffix would exceed the limit.
 */
export function ensureUniqueWorksheetName(
  name: string,
  existingNames: Set<string>,
): string {
  const base = (name ?? '').trim().slice(0, WORKSHEET_NAME_MAX_LENGTH);
  const safe = base || FALLBACK_NAME;
  if (!existingNames.has(safe)) return safe;
  for (let n = 2; n < 1000; n++) {
    const suffix = ` (${n})`;
    const candidate = safe.slice(0, WORKSHEET_NAME_MAX_LENGTH - suffix.length) + suffix;
    if (!existingNames.has(candidate)) return candidate;
  }
  return safe;
}

export interface GenerateWorksheetNameParams {
  fileBaseName: string;
  sheetName: string;
  sheetCountInFile: number;
  existingNames: Set<string>;
}

/**
 * Generates a consistent, Excel-safe worksheet name for the merge pipeline.
 *
 * - Single sheet in file → file base name.
 * - Multiple sheets → "fileBaseName – sheetName".
 * - Sanitizes forbidden characters, truncates to 31 chars, ensures uniqueness.
 */
export function generateWorksheetName(params: GenerateWorksheetNameParams): string {
  const { fileBaseName, sheetName, sheetCountInFile, existingNames } = params;
  const base = (fileBaseName ?? '').trim() || FALLBACK_NAME;
  const sheet = (sheetName ?? '').trim();

  const rawName = sheetCountInFile <= 1
    ? base
    : sheet ? `${base}${SEP}${sheet}` : base;

  const sanitized = sanitizeWorksheetName(rawName);
  const truncated = truncateWorksheetName(sanitized);
  return ensureUniqueWorksheetName(truncated, existingNames);
}
