/**
 * Kopiert einen ExcelJS-Worksheet vollständig in einen anderen:
 * - Zellwerte inkl. Formeln (Formeltext + gecachtes Ergebnis werden beide erhalten)
 * - Zellstile (Hintergrundfarbe, Schrift, Rahmen, Zahlenformat, Ausrichtung)
 * - Spaltenbreiten und Zeilenhöhen
 * - Zellverbindungen (Merged Cells) – korrekt über top/left/bottom/right
 * - Eingefrorene Zeilen/Spalten (Views)
 */

import ExcelJS from 'exceljs';

/**
 * ExcelJS-internes _merges-Objekt:
 * Key   = Adresse der Master-Zelle (z. B. "B3")
 * Value = Dimensions-Objekt mit top/left/bottom/right (1-basiert)
 */
type MergeDimensions = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

type WorksheetInternal = ExcelJS.Worksheet & {
  _merges: Record<string, MergeDimensions>;
};

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function cloneStyle(style: Partial<ExcelJS.Style>): Partial<ExcelJS.Style> {
  try {
    return JSON.parse(JSON.stringify(style)) as Partial<ExcelJS.Style>;
  } catch {
    return {};
  }
}

/** Zeilen-Style aus Row lesen (model.style oder direkte Style-Properties). Export für mergeService. */
export function getRowStyle(row: ExcelJS.Row): Partial<ExcelJS.Style> | null {
  const model = (row as ExcelJS.Row & { model?: { style?: Partial<ExcelJS.Style> } }).model;
  if (model?.style && Object.keys(model.style).length > 0) {
    return cloneStyle(model.style);
  }
  const style: Partial<ExcelJS.Style> = {};
  const r = row as unknown as Record<string, unknown>;
  if (r.font && typeof r.font === 'object') style.font = r.font as Partial<ExcelJS.Font>;
  if (r.fill && typeof r.fill === 'object') style.fill = r.fill as ExcelJS.Fill;
  if (r.alignment && typeof r.alignment === 'object') style.alignment = r.alignment as Partial<ExcelJS.Alignment>;
  if (r.border && typeof r.border === 'object') style.border = r.border as Partial<ExcelJS.Borders>;
  if (r.numFmt && typeof r.numFmt === 'string') style.numFmt = r.numFmt;
  if (Object.keys(style).length === 0) return null;
  return style;
}

/**
 * Bereitet den Zellwert fürs Kopieren vor.
 * Formeln werden mit ihrem gecachten Ergebnis beibehalten.
 */
export function prepareValue(cell: ExcelJS.Cell): ExcelJS.CellValue {
  const val = cell.value;
  if (val === null || val === undefined) return null;

  if (typeof val === 'object') {
    if ('formula' in val) {
      const fv = val as ExcelJS.CellFormulaValue;
      return {
        formula: fv.formula,
        result: fv.result,
        date1904: fv.date1904,
      } satisfies ExcelJS.CellFormulaValue;
    }
    if ('sharedFormula' in val) {
      const fv = val as ExcelJS.CellFormulaValue;
      if (fv.formula) {
        return {
          formula: fv.formula,
          result: fv.result,
          date1904: fv.date1904,
        } satisfies ExcelJS.CellFormulaValue;
      }
      return fv.result !== undefined ? (fv.result as ExcelJS.CellValue) : null;
    }
  }
  return val;
}

/**
 * Kopiert alle Spaltenbreiten und -stile.
 * Nutzt sowohl `src.columns` als auch `_columns` intern.
 */
function copyColumnWidths(src: ExcelJS.Worksheet, dest: ExcelJS.Worksheet): void {
  type WsWithCols = {
    _columns?: Array<{
      number: number;
      width?: number;
      hidden?: boolean;
      style?: Partial<ExcelJS.Style>;
    } | null>;
  };

  const internalCols = ((src as unknown as WsWithCols)._columns) ?? [];
  const maxCol = Math.max(src.columnCount || 0, internalCols.length);

  for (let c = 1; c <= maxCol; c++) {
    try {
      const srcCol = src.getColumn(c);
      const destCol = dest.getColumn(c);
      if (srcCol.width !== undefined && srcCol.width > 0) destCol.width = srcCol.width;
      if (srcCol.hidden) destCol.hidden = true;
      if (srcCol.style && Object.keys(srcCol.style).length > 0) {
        destCol.style = cloneStyle(srcCol.style) as ExcelJS.Style;
      }
    } catch { /* nicht zugänglich */ }
  }

  for (const col of internalCols) {
    if (!col) continue;
    try {
      const destCol = dest.getColumn(col.number);
      if (col.width !== undefined && col.width > 0) destCol.width = col.width;
      if (col.hidden) destCol.hidden = true;
      if (col.style && Object.keys(col.style).length > 0) {
        destCol.style = cloneStyle(col.style) as ExcelJS.Style;
      }
    } catch { /* ignorieren */ }
  }
}

// ─── Haupt-Kopierfunktion ─────────────────────────────────────────────────────

/**
 * Kopiert einen ganzen Worksheet von `src` nach `dest`.
 * Benutzt copyWorksheetCells intern – kann auch einzeln genutzt werden.
 */
export function copyWorksheet(src: ExcelJS.Worksheet, dest: ExcelJS.Worksheet): void {
  // Worksheet-Eigenschaften
  if (src.properties) {
    try { dest.properties = { ...src.properties }; } catch { /* ignore */ }
  }

  // Views (eingefrorene Zeilen / Spalten)
  if (Array.isArray(src.views) && src.views.length > 0) {
    try { dest.views = src.views.map((v) => ({ ...v })); } catch { /* ignore */ }
  }

  // Seiteneinrichtung
  if (src.pageSetup) {
    try { dest.pageSetup = { ...src.pageSetup }; } catch { /* ignore */ }
  }

  copyColumnWidths(src, dest);
  copyWorksheetCells(src, dest, (cell) => prepareValue(cell));
  applyMerges(src, dest);
}

/**
 * Kopiert nur Zeilen/Zellen (ohne Merges, Views, Spaltenbreiten).
 * `getValue` entscheidet, welcher Wert für jede Zelle gesetzt wird.
 */
export function copyWorksheetCells(
  src: ExcelJS.Worksheet,
  dest: ExcelJS.Worksheet,
  getValue: (cell: ExcelJS.Cell, row: number, col: number) => ExcelJS.CellValue
): void {
  src.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
    const destRow = dest.getRow(rowNum);
    if (srcRow.height && srcRow.height > 0) destRow.height = srcRow.height;
    if (srcRow.hidden) destRow.hidden = true;

    const rowStyle = getRowStyle(srcRow);
    if (rowStyle && Object.keys(rowStyle).length > 0) {
      try {
        (destRow as unknown as { style?: Partial<ExcelJS.Style> }).style = cloneStyle(rowStyle) as ExcelJS.Style;
      } catch { /* ignore */ }
    }

    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
      if (srcCell.isMerged && srcCell.address !== srcCell.master.address) return;

      const destCell = dest.getCell(rowNum, colNum);
      destCell.value = getValue(srcCell, rowNum, colNum);

      const cellStyle = srcCell.style;
      const style = cellStyle && Object.keys(cellStyle).length > 0
        ? cellStyle
        : rowStyle;
      if (style && Object.keys(style).length > 0) {
        try {
          destCell.style = cloneStyle(style) as ExcelJS.Style;
        } catch { /* ignore */ }
      }
    });

    destRow.commit();
  });
}

/**
 * Überträgt alle Merge-Ranges von src nach dest.
 *
 * ExcelJS speichert _merges als:
 *   Key   = Adresse der Master-Zelle (z. B. "B3")
 *   Value = { top, left, bottom, right }  (1-basierte Zeilen-/Spalten-Nummern)
 *
 * mergeCells(top, left, bottom, right) akzeptiert diese Nummern direkt.
 */
export function applyMerges(src: ExcelJS.Worksheet, dest: ExcelJS.Worksheet): void {
  const ws = src as unknown as WorksheetInternal;
  if (!ws._merges) return;

  for (const dims of Object.values(ws._merges)) {
    if (!dims || typeof dims.top !== 'number') continue;
    // Nur echte Merges (mindestens 2 Zellen)
    if (dims.top === dims.bottom && dims.left === dims.right) continue;
    try {
      dest.mergeCells(dims.top, dims.left, dims.bottom, dims.right);
    } catch { /* überspringen */ }
  }
}
