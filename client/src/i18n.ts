import { useStore, type Locale } from './store/useStore';

export type { Locale };

export const translations: Record<string, { de: string; en: string }> = {
  // Header
  'app.subtitle':            { de: 'excel & ods merge', en: 'excel & ods merge' },

  // Upload
  'upload.title':            { de: 'Dateien hinzufügen', en: 'Add files' },
  'upload.titleMore':        { de: 'Weitere Dateien hinzufügen', en: 'Add more files' },
  'upload.subtitle':         { de: 'Per Drag & Drop auf die Seite – oder hier auswählen', en: 'Drag & drop onto the page – or select here' },
  'upload.supports':         { de: 'Unterstützt: .xlsx · .xls · .ods', en: 'Supports: .xlsx · .xls · .ods' },
  'upload.dropToAdd':        { de: 'Dateien ablegen zum Hochladen', en: 'Drop files to upload' },
  'upload.maxReached':       { de: 'Maximale Dateianzahl erreicht', en: 'Maximum number of files reached' },
  'upload.limits':           { de: 'max. {n} Dateien · {mb} MB pro Datei · {totalMb} MB gesamt', en: 'max. {n} files · {mb} MB per file · {totalMb} MB total' },
  'upload.browse':           { de: 'Durchsuchen', en: 'Browse' },
  'upload.errors.title':     { de: '{count} Datei(en) nicht hinzugefügt', en: '{count} file(s) not added' },
  'upload.errors.single':    { de: '{filename} wurde nicht hinzugefügt', en: '{filename} was not added' },
  'upload.errors.invalidType':    { de: 'falsches Format', en: 'wrong format' },
  'upload.errors.fileTooLarge':   { de: 'größer als {maxSize}', en: 'larger than {maxSize}' },
  'upload.errors.totalSizeExceeded': { de: 'Gesamtgröße über {maxTotalSize}', en: 'Total size over {maxTotalSize}' },

  // Merge options
  'merge.title':             { de: 'Merge-Optionen', en: 'Merge options' },
  'merge.hintNoFiles':       { de: 'Modus und Ausgabeformat festlegen – sie gelten nach dem Hochladen.', en: 'Set mode and output format – they apply after upload.' },
  'merge.output':            { de: 'Ausgabe:', en: 'Output:' },
  'merge.sheetSelection':    { de: 'Sheet-Auswahl', en: 'Sheet selection' },
  'merge.sheetAll':          { de: 'Alle Sheets', en: 'All sheets' },
  'merge.sheetFirst':        { de: 'Nur erstes Sheet', en: 'First sheet only' },
  'merge.sheetFilter':       { de: 'Filter nach Sheet-Namen', en: 'Filter by sheet name' },
  'merge.sheetFilterInclude': { de: 'Nur diese', en: 'Include only' },
  'merge.sheetFilterExclude': { de: 'Diese ausschließen', en: 'Exclude' },
  'merge.sheetFilterValues':  { de: 'Namen (ein Name pro Zeile)', en: 'Names (one per line)' },
  'merge.sheetFilterMatch':   { de: 'Vergleich:', en: 'Match:' },
  'merge.sheetFilterExact':   { de: 'Genau', en: 'Exact' },
  'merge.sheetFilterContains': { de: 'Enthält', en: 'Contains' },
  'merge.sheetFilterRegex':   { de: 'RegEx', en: 'Regex' },
  'merge.sheetFilterCase':    { de: 'Groß-/Kleinschreibung beachten', en: 'Case sensitive' },

  // Merge modes (short labels)
  'mode.one_file_per_sheet':      { de: 'Eine Datei = ein Sheet', en: 'One file = one sheet' },
  'mode.consolidated_sheets':      { de: 'Konsolidierung + Einzelne Sheets', en: 'Consolidation + individual sheets' },
  'mode.all_to_one_sheet':         { de: 'Alles in eine Tabelle', en: 'All in one table' },
  'mode.all_with_source_column':   { de: 'Mit Herkunftsspalte', en: 'With source column' },
  'mode.row_per_file':             { de: 'Zeilenmatrix mit Summen', en: 'Row matrix with totals' },
  'mode.row_per_file_no_sum':      { de: 'Zeilenmatrix', en: 'Row matrix' },

  // Merge mode descriptions (long text)
  'mode.one_file_per_sheet.desc':      { de: 'Jede Datei bekommt ein eigenes Sheet. Farben, Rahmen, verbundene Zellen, Spaltenbreiten und Formeln bleiben vollständig erhalten. Unterstützt XLSX und ODS.', en: 'Each file gets its own sheet. Colours, borders, merged cells, column widths and formulas are fully preserved. Supports XLSX and ODS.' },
  'mode.consolidated_sheets.desc':     { de: 'Sheet 1 = Zusammenfassung: numerische Werte werden zelladressgenau summiert, Formeln bleiben mit aktualisierten Ergebnissen erhalten. Danach folgt jede Datei als eigenes formatiertes Sheet. Unterstützt XLSX und ODS.', en: 'Sheet 1 = Summary: numeric values are summed by cell address, formulas are kept with updated results. Then each file as its own formatted sheet. Supports XLSX and ODS.' },
  'mode.all_to_one_sheet.desc':       { de: 'Alle Dateien werden untereinander in ein einziges Sheet gestapelt – inklusive Farben, Rahmen, verbundene Zellen, Spaltenbreiten und Formeln. Unterstützt XLSX und ODS.', en: 'All files are stacked into a single sheet – including colours, borders, merged cells, column widths and formulas. Supports XLSX and ODS.' },
  'mode.all_with_source_column.desc': { de: 'Wie „Alles in eine Tabelle", jedoch mit einer zusätzlichen Spalte ganz links, die für jede Datei den Dateinamen anzeigt. Vollständige Formatierung bleibt erhalten. Unterstützt XLSX und ODS.', en: 'Like "All in one table", but with an extra left column showing the filename for each file. Full formatting is preserved. Supports XLSX and ODS.' },
  'mode.row_per_file.desc':           { de: 'Wie Zeilenmatrix, plus eine Gesamt-Zeile unten mit den Spaltensummen. Ideal für tägliche Berichte.', en: 'Like row matrix, plus a total row at the bottom with column sums. Ideal for daily reports.' },
  'mode.row_per_file_no_sum.desc':    { de: 'Jede Datei wird zu einer Zeile, Spaltenheader aus Zellreferenzen (A1, B1, …). Nur die Dateien, keine Summenzeile.', en: 'Each file becomes one row, column headers from cell refs (A1, B1, …). File rows only, no total row.' },

  // Action bar
  'action.merge':            { de: 'Zusammenführen', en: 'Merge' },
  'action.mergeSelected':    { de: 'Zusammenführen ({selectedCount} ausgewählt)', en: 'Merge selected ({selectedCount})' },
  'action.mergeAll':         { de: 'Alle zusammenführen ({totalCount})', en: 'Merge all ({totalCount})' },
  'action.mergeSelection':   { de: 'Auswahl zusammenführen ({n})', en: 'Merge selection ({n})' },
  'action.mergeAgain':        { de: 'Neu mergen', en: 'Merge again' },
  'action.uploadProgress':   { de: 'Hochladen', en: 'Upload' },
  'action.processing':       { de: 'Verarbeite…', en: 'Processing…' },
  'action.queue':            { de: 'Warteschlange (Pos. {n})…', en: 'Queue (pos. {n})…' },
  'action.mergeComplete':    { de: 'Merge abgeschlossen', en: 'Merge complete' },
  'action.mergeSuccessMessage': { de: 'Merge abgeschlossen – {filename} ist bereit zum Herunterladen.', en: 'Merge complete – {filename} is ready to download.' },
  'action.mergeSuccessDownloading': { de: 'Merge abgeschlossen – {filename} wird heruntergeladen.', en: 'Merge complete – {filename} is being downloaded.' },
  'action.mergeAgainShort':   { de: 'Nochmal mergen', en: 'Merge again' },
  'action.closeResult':      { de: 'Ergebnis schließen', en: 'Close result' },
  'action.download':         { de: 'Herunterladen', en: 'Download' },
  'action.longRunning':      { de: 'Merge läuft noch (über 2 Minuten) – bitte Geduld.', en: 'Merge still running (over 2 min) – please wait.' },
  'action.filenamePlaceholder': { de: 'Dateiname (mit {ext})', en: 'Filename (with {ext})' },
  'action.auto':             { de: '✦ auto', en: '✦ auto' },
  'action.cancel':           { de: 'Abbrechen', en: 'Cancel' },

  // Error hints (OOM / Timeout)
  'error.hintOom':           { de: 'Tipp: Weniger Dateien oder kleinere Dateien wählen.', en: 'Tip: Use fewer or smaller files.' },
  'error.hintTimeout':       { de: 'Tipp: Weniger Dateien auf einmal mergen oder kleinere Dateien verwenden.', en: 'Tip: Merge fewer files at once or use smaller files.' },

  // Upload (Drag & Drop Rückmeldung)
  'upload.skippedInvalid':   { de: '{n} Datei(en) nicht hinzugefügt: falsches Format, über {mb} MB pro Datei oder über {totalMb} MB gesamt.', en: '{n} file(s) not added: wrong format, over {mb} MB per file, or over {totalMb} MB total.' },

  // History
  'history.title':           { de: 'Verlauf', en: 'History' },
  'history.entry':           { de: 'Eintrag', en: 'entry' },
  'history.entries':         { de: 'Einträge', en: 'entries' },
  'history.privacy':         { de: 'Einträge werden nur lokal in diesem Browser gespeichert – niemand sonst hat Zugriff (Datenschutz).', en: 'Entries are stored only locally in this browser – no one else has access (privacy).' },
  'history.addAsSource':     { de: '+Quelle', en: '+Source' },
  'history.addSourceTitle':  { de: 'Als Eingabe-Datei zur Merge-Liste hinzufügen', en: 'Add as input file to merge list' },
  'history.download':        { de: 'Download', en: 'Download' },
  'history.downloadTitle':   { de: 'Erneut herunterladen', en: 'Download again' },
  'history.file':            { de: 'Datei', en: 'file' },
  'history.files':           { de: 'Dateien', en: 'files' },
  'history.fromHistory':     { de: 'Aus Verlauf', en: 'From history' },
  'history.justNow':         { de: 'gerade eben', en: 'just now' },
  'history.secAgo':          { de: 'vor {n} Sek.', en: '{n} sec ago' },
  'history.minAgo':         { de: 'vor {n} Min.', en: '{n} min ago' },
  'history.hourAgo':        { de: 'vor {n} Std.', en: '{n} hr ago' },
  'history.storageUsed':    { de: 'Gesamter lokaler Speicher: {size}', en: 'Total local storage: {size}' },
  'history.clearEntire':    { de: 'Gesamten Verlauf löschen', en: 'Clear entire history' },
  'history.delete':         { de: 'Löschen', en: 'Delete' },

  // File list
  'files.totalAvailable':    { de: '{fileCount} Dateien und {sheetCount} Sheets vorhanden', en: '{fileCount} files and {sheetCount} sheets in list' },
  'files.summaryShort':      { de: '{fileCount} Dateien · {sheetCount} Sheets', en: '{fileCount} files · {sheetCount} sheets' },
  'files.selectedCountBadge': { de: '{n} ausgewählt', en: '{n} selected' },
  'files.selectedForMerge':   { de: '{fileCount} Dateien · {sheetCount} Sheets ausgewählt', en: '{fileCount} files · {sheetCount} sheets selected' },
  'files.selectionLabel':     { de: 'Auswahl', en: 'Selection' },
  'files.selectedLabel':     { de: 'ausgewählt', en: 'selected' },
  'files.remove':            { de: 'Entfernen', en: 'Remove' },
  'files.removeN':           { de: '{n} entfernen', en: 'Remove {n}' },
  'files.clearSelection':    { de: 'Auswahl aufheben', en: 'Clear selection' },
  'files.sortOrder':         { de: 'Merge-Reihenfolge', en: 'Merge order' },
  'files.sort.uploadOrder':  { de: 'Nach Upload-Reihenfolge (Standard)', en: 'By upload order (default)' },
  'files.sort.filename':     { de: 'Nach Dateiname', en: 'By filename' },
  'files.sort.alphabetical': { de: 'Alphabetisch', en: 'Alphabetical' },
  'files.sort.sizeAsc':      { de: 'Nach Größe (kleinste zuerst)', en: 'By size (smallest first)' },
  'files.sort.sizeDesc':     { de: 'Nach Größe (größte zuerst)', en: 'By size (largest first)' },
  'files.sort.dateNewest':   { de: 'Nach Datum (neueste zuerst)', en: 'By date (newest first)' },
  'files.sort.dateOldest':   { de: 'Nach Datum (älteste zuerst)', en: 'By date (oldest first)' },
  'files.sort.dragHint':     { de: 'Zum Umsortieren „Upload-Reihenfolge“ wählen', en: 'Choose „Upload order“ to drag & drop' },
  'files.reorder':           { de: 'Reihenfolge ändern', en: 'Change order' },
  'files.previewRow':        { de: 'Vorschau (erste {n} Zeile):', en: 'Preview (first {n} row):' },
  'files.previewRows':       { de: 'Vorschau (erste {n} Zeilen):', en: 'Preview (first {n} rows):' },
  'files.sheets':            { de: 'Sheets', en: 'Sheets' },
  'files.sheetsSelect':      { de: 'Sheets auswählen – leer = alle sheets mergen:', en: 'Select sheets – empty = merge all:' },
  'files.sheetsSelected':    { de: '{matched} von {total} Sheets ausgewählt', en: '{matched} of {total} sheets selected' },
  'files.removeTitle':       { de: 'Entfernen', en: 'Remove' },
  'files.historyLabel':      { de: 'Verlauf', en: 'History' },
  'duplicates.alreadyPresent': { de: 'Dateien bereits vorhanden – übersprungen', en: 'Files already present – skipped' },
  'duplicates.showAll':       { de: 'Alle anzeigen', en: 'Show all' },
  'duplicates.collapse':      { de: 'Ausblenden', en: 'Collapse' },
  'duplicates.expand':        { de: 'Einblenden', en: 'Expand' },
  'duplicates.replaceExisting': { de: 'Vorhandene ersetzen', en: 'Replace existing' },
  'duplicates.replaceSelected': { de: 'Ausgewählte ersetzen', en: 'Replace selected' },
  'duplicates.replaceAll':      { de: 'Alle ersetzen', en: 'Replace all' },
  'duplicates.replaceNone':     { de: 'Keine ersetzen', en: 'Replace none' },
  'duplicates.replacePrompt':   { de: 'Bereits vorhanden – ersetzen?', en: 'Already present – replace?' },
  'duplicates.dismiss':       { de: 'Hinweis schließen', en: 'Dismiss' },
  'duplicates.skippedOne':   { de: 'Datei wurde als Duplikat übersprungen.', en: 'file was skipped as duplicate.' },
  'duplicates.skippedMany':  { de: 'Dateien wurden als Duplikat übersprungen.', en: 'files were skipped as duplicates.' },
  'duplicates.skippedWithNames': { de: '{n} Datei(en) als Duplikat übersprungen: {names}', en: '{n} file(s) skipped as duplicate(s): {names}' },

  // Duplicates & warnings
  'duplicates.warning':      { de: '{n} doppelte Datei(en) übersprungen.', en: '{n} duplicate file(s) skipped.' },
  'warnings.filesFailed':    { de: '{n} Datei(en) konnte(n) nicht verarbeitet werden:', en: '{n} file(s) could not be processed:' },

  // Templates
  'templates.title':        { de: 'Vorlagen', en: 'Templates' },
  'templates.save':         { de: 'Speichern', en: 'Save' },
  'templates.saveTitle':    { de: 'Aktuelle Einstellungen als Vorlage speichern', en: 'Save current settings as template' },
  'templates.namePlaceholder': { de: 'Vorlagenname…', en: 'Template name…' },
  'templates.empty':        { de: 'Noch keine Vorlagen – aktuelle Einstellungen über „Speichern" sichern.', en: 'No templates yet – save current settings via "Save".' },

  // Errors / common
  'common.reset':            { de: 'Alles zurücksetzen', en: 'Reset all' },
  'common.report':           { de: 'Report', en: 'Report' },
  'error.title':            { de: 'Ein Fehler ist aufgetreten', en: 'An error occurred' },
  'error.retry':            { de: 'Erneut versuchen', en: 'Try again' },
};

function interpolate(text: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)), text);
}

export function useT() {
  const locale = useStore((s) => s.locale);
  return (key: string, vars?: Record<string, string | number>) => {
    const raw = translations[key]?.[locale] ?? translations[key]?.de ?? key;
    return vars ? interpolate(raw, vars) : raw;
  };
}

/** For use outside React (e.g. ErrorBoundary). Pass locale explicitly. */
export function t(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  const raw = translations[key]?.[locale] ?? translations[key]?.de ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'de';
  try {
    return localStorage.getItem('eXmerg-locale') === 'en' ? 'en' : 'de';
  } catch { return 'de'; }
}
