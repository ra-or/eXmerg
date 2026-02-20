/**
 * ODS → ExcelJS-Workbook mit vollständigem Styling.
 *
 * Liest aus dem ODS-ZIP:
 *   • styles.xml      → benannte / Master-Stile
 *   • content.xml     → automatische Stile + Tabellendaten
 *
 * Extrahiert:
 *   • Hintergrundfarben (fo:background-color)
 *   • Schrift: Bold, Italic, Underline, Farbe, Größe, Name
 *   • Rahmen (fo:border, fo:border-top/bottom/left/right)
 *   • Textausrichtung (horizontal + vertikal, Zeilenumbruch)
 *   • Spaltenbreiten  (style:column-width in cm/mm/in/pt)
 *   • Zeilenhöhen     (style:row-height in cm/mm/in/pt)
 *   • Verbundene Zellen (table:number-columns-spanned / -rows-spanned)
 *   • Zahlenformate   (currency → €, percentage, number)
 *   • Stil-Vererbung  (style:parent-style-name, mehrere Stufen)
 */

import ExcelJS from 'exceljs';
import JSZip from 'jszip';

// ─── Interne Stil-Typen ───────────────────────────────────────────────────────

interface BorderDef {
  style: ExcelJS.BorderStyle;
  color: string; // ARGB
}

interface CellStyleDef {
  parentName?: string;
  dataStyleName?: string; // Verweis auf Zahlenformat-Stil
  backgroundColor?: string;
  fontColor?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  fontName?: string;
  fontSize?: number; // pt
  borderTop?: BorderDef;
  borderBottom?: BorderDef;
  borderLeft?: BorderDef;
  borderRight?: BorderDef;
  hAlign?: ExcelJS.Alignment['horizontal'];
  vAlign?: ExcelJS.Alignment['vertical'];
  wrapText?: boolean;
  numFmt?: string; // Excel-Zahlenformat-String
}

interface StyleMap {
  cells: Map<string, CellStyleDef>;
  colWidths: Map<string, number>; // styleName → Excel-Zeichen-Einheiten
  rowHeights: Map<string, number>; // styleName → Punkte
  numFmts: Map<string, string>; // ODS-Zahlenformat-Name → Excel-Format-String
}

// ─── Einheiten-Konvertierung ──────────────────────────────────────────────────

function toExcelWidth(s: string): number {
  const val = parseFloat(s);
  if (isNaN(val) || val <= 0) return 8;
  if (s.includes('cm')) return Math.max(1, Math.round(val * 4.72 * 10) / 10);
  if (s.includes('mm')) return Math.max(1, Math.round(val * 0.472 * 10) / 10);
  if (s.includes('in')) return Math.max(1, Math.round(val * 12.0 * 10) / 10);
  if (s.includes('pt')) return Math.max(1, Math.round(val * 0.167 * 10) / 10);
  return 8;
}

function toPoints(s: string): number {
  const val = parseFloat(s);
  if (isNaN(val) || val <= 0) return 15;
  if (s.includes('cm')) return Math.round(val * 28.35 * 10) / 10;
  if (s.includes('mm')) return Math.round(val * 2.835 * 10) / 10;
  if (s.includes('in')) return Math.round(val * 72 * 10) / 10;
  if (s.includes('pt')) return val;
  return 15;
}

function odsColorToArgb(color: string): string | undefined {
  if (!color || color === 'transparent' || color === 'none') return undefined;
  const h = color.startsWith('#') ? color.slice(1) : null;
  if (!h) return undefined;
  if (h.length === 3) return 'FF' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length === 6) return 'FF' + h.toUpperCase();
  return undefined;
}

function parseBorderStr(s: string): BorderDef | undefined {
  if (!s || s === 'none') return undefined;
  const parts = s.trim().split(/\s+/);
  if (parts.length < 2) return undefined;
  const widthPt = parseFloat(parts[0] ?? '0');
  const styleStr = parts[1] ?? 'solid';
  const colorStr = parts[2] ?? '#000000';
  let bStyle: ExcelJS.BorderStyle = 'thin';
  if (styleStr === 'solid') {
    bStyle = widthPt >= 2.25 ? 'thick' : widthPt >= 1.5 ? 'medium' : 'thin';
  } else if (styleStr === 'dashed') {
    bStyle = widthPt >= 1.5 ? 'mediumDashed' : 'dashed';
  } else if (styleStr === 'dotted') {
    bStyle = 'dotted';
  } else if (styleStr === 'double') {
    bStyle = 'double';
  }
  return { style: bStyle, color: odsColorToArgb(colorStr) ?? 'FF000000' };
}

// ─── XML-Tokenizer (aus parseOds.ts übernommen, standalone) ──────────────────

interface Token {
  type: 'open' | 'close' | 'selfclose' | 'text';
  raw: string;
  local: string;
}

function localName(qname: string): string {
  const idx = qname.indexOf(':');
  return idx >= 0 ? qname.slice(idx + 1) : qname;
}

function getAttribute(tag: string, attrLocalName: string): string {
  const re = new RegExp(`[a-zA-Z-]+:${attrLocalName}\\s*=\\s*["']([^"']*)["']`);
  const m = re.exec(tag);
  // Fallback: auch ohne Namespace-Präfix suchen
  if (!m) {
    const re2 = new RegExp(`(?:^|\\s)${attrLocalName}\\s*=\\s*["']([^"']*)["']`);
    const m2 = re2.exec(tag);
    return m2 ? (m2[1] ?? '') : '';
  }
  return m[1] ?? '';
}

function getIntAttr(tag: string, attrLocalName: string, def = 1): number {
  const s = getAttribute(tag, attrLocalName);
  const n = parseInt(s, 10);
  return isNaN(n) || n < 1 ? def : n;
}

function tokenize(xml: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < xml.length) {
    const start = xml.indexOf('<', pos);
    if (start === -1) {
      const text = xml.slice(pos).trim();
      if (text) tokens.push({ type: 'text', raw: text, local: '' });
      break;
    }
    if (start > pos) {
      const text = xml.slice(pos, start);
      if (text.trim()) tokens.push({ type: 'text', raw: text, local: '' });
    }
    const end = xml.indexOf('>', start);
    if (end === -1) break;
    const raw = xml.slice(start, end + 1);
    if (raw.startsWith('<?') || raw.startsWith('<!--') || raw.startsWith('<!')) {
      pos = end + 1;
      continue;
    }
    if (raw.startsWith('</')) {
      const qname = raw.slice(2).replace(/[\s>].*$/, '');
      tokens.push({ type: 'close', raw, local: localName(qname) });
    } else if (raw.endsWith('/>')) {
      const qname = raw.slice(1).split(/[\s/]/)[0] ?? '';
      tokens.push({ type: 'selfclose', raw, local: localName(qname) });
    } else {
      const qname = raw.slice(1).split(/[\s>]/)[0] ?? '';
      tokens.push({ type: 'open', raw, local: localName(qname) });
    }
    pos = end + 1;
  }
  return tokens;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ─── Stil-Map aufbauen ────────────────────────────────────────────────────────

function buildStyleMap(contentXml: string, stylesXml: string): StyleMap {
  const map: StyleMap = {
    cells: new Map(),
    colWidths: new Map(),
    rowHeights: new Map(),
    numFmts: new Map(),
  };

  // Beide XML-Dateien zusammen tokenisieren
  const combined = stylesXml + '\n' + contentXml;
  const tokens = tokenize(combined);

  let inStyles = false;
  let inAutoStyles = false;
  let inStyle = false;
  let styleName = '';
  let styleFamily = '';
  let dataStyleName = '';
  let currentDef: CellStyleDef = {};

  // Zahlenformat-Tracking
  let inNumFmt = false;
  let numFmtStyleName = '';
  let numFmtKind = ''; // 'currency' | 'number' | 'percentage'
  let numFmtCurrencySymbol = '';

  for (const tok of tokens) {
    // ── Zahlenformat-Stile ────────────────────────────────────────────────────
    if (tok.type === 'open' || tok.type === 'selfclose') {
      switch (tok.local) {
        case 'currency-style':
          if (tok.type === 'open') {
            inNumFmt = true;
            numFmtStyleName = getAttribute(tok.raw, 'name');
            numFmtKind = 'currency';
            numFmtCurrencySymbol = '';
          }
          break;
        case 'number-style':
          if (tok.type === 'open') {
            inNumFmt = true;
            numFmtStyleName = getAttribute(tok.raw, 'name');
            numFmtKind = 'number';
          }
          break;
        case 'percentage-style':
          if (tok.type === 'open') {
            inNumFmt = true;
            numFmtStyleName = getAttribute(tok.raw, 'name');
            numFmtKind = 'percentage';
          }
          break;
        case 'currency-symbol':
          // Inline-Text des Währungssymbols kommt als nächstes text-Token
          break;
      }
    }

    if (tok.type === 'text' && inNumFmt && numFmtKind === 'currency') {
      numFmtCurrencySymbol = tok.raw.trim();
    }

    if (tok.type === 'close') {
      switch (tok.local) {
        case 'currency-style':
        case 'number-style':
        case 'percentage-style':
          if (inNumFmt && numFmtStyleName) {
            let fmt: string;
            if (numFmtKind === 'currency') {
              const sym = numFmtCurrencySymbol || '€';
              fmt = `#,##0.00 "${sym}"`;
            } else if (numFmtKind === 'percentage') {
              fmt = '0.00%';
            } else {
              fmt = '#,##0.00';
            }
            map.numFmts.set(numFmtStyleName, fmt);
          }
          inNumFmt = false;
          numFmtStyleName = '';
          numFmtKind = '';
          numFmtCurrencySymbol = '';
          break;
      }
    }

    // ── Style-Definitionen ────────────────────────────────────────────────────
    if (tok.type === 'open' || tok.type === 'selfclose') {
      switch (tok.local) {
        case 'styles':
          if (tok.type === 'open') inStyles = true;
          break;
        case 'automatic-styles':
          if (tok.type === 'open') inAutoStyles = true;
          break;

        case 'style':
          if ((inStyles || inAutoStyles) && tok.type === 'open') {
            inStyle = true;
            styleName = getAttribute(tok.raw, 'name');
            styleFamily = getAttribute(tok.raw, 'family');
            dataStyleName = getAttribute(tok.raw, 'data-style-name');
            currentDef = {};
            const parent = getAttribute(tok.raw, 'parent-style-name');
            if (parent) currentDef.parentName = parent;
            if (dataStyleName) currentDef.dataStyleName = dataStyleName;
          }
          break;

        case 'table-column-properties':
          if (inStyle && styleFamily === 'table-column') {
            const w = getAttribute(tok.raw, 'column-width');
            if (w) map.colWidths.set(styleName, toExcelWidth(w));
          }
          break;

        case 'table-row-properties':
          if (inStyle && styleFamily === 'table-row') {
            const h = getAttribute(tok.raw, 'row-height');
            if (h) map.rowHeights.set(styleName, toPoints(h));
          }
          break;

        case 'table-cell-properties':
          if (inStyle) {
            // Hintergrundfarbe
            const bg = getAttribute(tok.raw, 'background-color');
            const bgArgb = odsColorToArgb(bg);
            if (bgArgb) currentDef.backgroundColor = bgArgb;

            // Rahmen – Shorthand
            const border = getAttribute(tok.raw, 'border');
            if (border && border !== 'none') {
              const b = parseBorderStr(border);
              if (b) {
                currentDef.borderTop = b;
                currentDef.borderBottom = b;
                currentDef.borderLeft = b;
                currentDef.borderRight = b;
              }
            }
            // Einzelne Rahmen (überschreiben Shorthand)
            const bTop = getAttribute(tok.raw, 'border-top');
            if (bTop) {
              const b = parseBorderStr(bTop);
              if (b) currentDef.borderTop = b;
              else delete currentDef.borderTop;
            }
            const bBottom = getAttribute(tok.raw, 'border-bottom');
            if (bBottom) {
              const b = parseBorderStr(bBottom);
              if (b) currentDef.borderBottom = b;
              else delete currentDef.borderBottom;
            }
            const bLeft = getAttribute(tok.raw, 'border-left');
            if (bLeft) {
              const b = parseBorderStr(bLeft);
              if (b) currentDef.borderLeft = b;
              else delete currentDef.borderLeft;
            }
            const bRight = getAttribute(tok.raw, 'border-right');
            if (bRight) {
              const b = parseBorderStr(bRight);
              if (b) currentDef.borderRight = b;
              else delete currentDef.borderRight;
            }

            // Zeilenumbruch
            if (getAttribute(tok.raw, 'wrap-option') === 'wrap') currentDef.wrapText = true;

            // Vertikale Ausrichtung
            const vAlign = getAttribute(tok.raw, 'vertical-align');
            if (vAlign === 'middle' || vAlign === 'center') currentDef.vAlign = 'middle';
            else if (vAlign === 'top') currentDef.vAlign = 'top';
            else if (vAlign === 'bottom') currentDef.vAlign = 'bottom';
          }
          break;

        case 'text-properties':
          if (inStyle) {
            if (getAttribute(tok.raw, 'font-weight') === 'bold') currentDef.fontBold = true;
            if (getAttribute(tok.raw, 'font-style') === 'italic') currentDef.fontItalic = true;
            const ul = getAttribute(tok.raw, 'text-underline-style');
            if (ul && ul !== 'none') currentDef.fontUnderline = true;

            const color = getAttribute(tok.raw, 'color');
            const colorArgb = odsColorToArgb(color);
            if (colorArgb) currentDef.fontColor = colorArgb;

            const fs = getAttribute(tok.raw, 'font-size');
            if (fs) {
              const pt = parseFloat(fs);
              if (!isNaN(pt) && pt > 0) currentDef.fontSize = pt;
            }

            const fn = getAttribute(tok.raw, 'font-name') || getAttribute(tok.raw, 'font-family');
            if (fn) currentDef.fontName = fn;
          }
          break;

        case 'paragraph-properties':
          if (inStyle) {
            const ta = getAttribute(tok.raw, 'text-align');
            if (ta === 'center') currentDef.hAlign = 'center';
            else if (ta === 'right' || ta === 'end') currentDef.hAlign = 'right';
            else if (ta === 'left' || ta === 'start') currentDef.hAlign = 'left';
            else if (ta === 'justify') currentDef.hAlign = 'justify';
          }
          break;
      }
    } else if (tok.type === 'close') {
      switch (tok.local) {
        case 'styles':
          inStyles = false;
          break;
        case 'automatic-styles':
          inAutoStyles = false;
          break;
        case 'style':
          if (inStyle) {
            if (styleFamily === 'table-cell' && styleName) {
              map.cells.set(styleName, { ...currentDef });
            }
            inStyle = false;
            styleName = '';
            styleFamily = '';
            dataStyleName = '';
            currentDef = {};
          }
          break;
      }
    }
  }

  // Stil-Vererbung auflösen (bis zu 5 Stufen)
  resolveInheritance(map);

  // Zahlenformate in Zell-Stile einsetzen
  for (const def of map.cells.values()) {
    if (def.dataStyleName) {
      const nf = map.numFmts.get(def.dataStyleName);
      if (nf) def.numFmt = nf;
    }
  }

  return map;
}

function resolveInheritance(map: StyleMap): void {
  for (let pass = 0; pass < 6; pass++) {
    for (const def of map.cells.values()) {
      if (!def.parentName) continue;
      const parent = map.cells.get(def.parentName);
      if (!parent) continue;
      // Nur übernehmen wenn Kind die Eigenschaft NICHT gesetzt hat
      if (!def.backgroundColor && parent.backgroundColor) def.backgroundColor = parent.backgroundColor;
      if (def.fontBold === undefined && parent.fontBold !== undefined) def.fontBold = parent.fontBold;
      if (def.fontItalic === undefined && parent.fontItalic !== undefined) def.fontItalic = parent.fontItalic;
      if (def.fontUnderline === undefined && parent.fontUnderline !== undefined) def.fontUnderline = parent.fontUnderline;
      if (!def.fontColor && parent.fontColor) def.fontColor = parent.fontColor;
      if (!def.fontSize && parent.fontSize) def.fontSize = parent.fontSize;
      if (!def.fontName && parent.fontName) def.fontName = parent.fontName;
      if (!def.borderTop && parent.borderTop) def.borderTop = parent.borderTop;
      if (!def.borderBottom && parent.borderBottom) def.borderBottom = parent.borderBottom;
      if (!def.borderLeft && parent.borderLeft) def.borderLeft = parent.borderLeft;
      if (!def.borderRight && parent.borderRight) def.borderRight = parent.borderRight;
      if (!def.hAlign && parent.hAlign) def.hAlign = parent.hAlign;
      if (!def.vAlign && parent.vAlign) def.vAlign = parent.vAlign;
      if (def.wrapText === undefined && parent.wrapText !== undefined) def.wrapText = parent.wrapText;
      if (!def.numFmt && parent.numFmt) def.numFmt = parent.numFmt;
    }
  }
}

function cellDefToExcelStyle(def: CellStyleDef): Partial<ExcelJS.Style> {
  const style: Partial<ExcelJS.Style> = {};

  if (def.backgroundColor) {
    style.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: def.backgroundColor },
    };
  }

  const font: Partial<ExcelJS.Font> = {};
  if (def.fontBold) font.bold = true;
  if (def.fontItalic) font.italic = true;
  if (def.fontUnderline) font.underline = true;
  if (def.fontColor) font.color = { argb: def.fontColor };
  if (def.fontSize) font.size = def.fontSize;
  if (def.fontName) font.name = def.fontName;
  if (Object.keys(font).length > 0) style.font = font;

  const border: Partial<ExcelJS.Borders> = {};
  if (def.borderTop) border.top = { style: def.borderTop.style, color: { argb: def.borderTop.color } };
  if (def.borderBottom) border.bottom = { style: def.borderBottom.style, color: { argb: def.borderBottom.color } };
  if (def.borderLeft) border.left = { style: def.borderLeft.style, color: { argb: def.borderLeft.color } };
  if (def.borderRight) border.right = { style: def.borderRight.style, color: { argb: def.borderRight.color } };
  if (Object.keys(border).length > 0) style.border = border;

  const align: Partial<ExcelJS.Alignment> = {};
  if (def.hAlign) align.horizontal = def.hAlign;
  if (def.vAlign) align.vertical = def.vAlign;
  if (def.wrapText) align.wrapText = true;
  if (Object.keys(align).length > 0) style.alignment = align;

  if (def.numFmt) style.numFmt = def.numFmt;

  return style;
}

// ─── Workbook aus ODS-Daten aufbauen ─────────────────────────────────────────

interface MergeRange {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
}

interface ColDef {
  styleName: string;
  repeat: number;
}

function buildWorkbookFromOds(contentXml: string, styleMap: StyleMap): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const tokens = tokenize(contentXml);

  let inSpreadsheet = false;
  let inTable = false;
  let inRow = false;
  let inCell = false;
  let inTextP = false;

  let ws: ExcelJS.Worksheet | null = null;
  let currentRow = 0;
  let currentCol = 0;
  let rowRepeat = 1;
  let cellRepeat = 1;
  let cellColSpan = 1;
  let cellRowSpan = 1;
  let isCoveredCell = false;

  let currentCellText = '';
  let currentCellOfficeValue = '';
  let currentCellType = '';
  let currentCellStyle = '';
  let currentRowStyle = '';

  let sheetColDefs: ColDef[] = [];
  let sheetMerges: MergeRange[] = [];

  const flushCell = (row: number, col: number): void => {
    if (!ws || isCoveredCell || row < 1 || col < 1) return;

    const cell = ws.getCell(row, col);

    // Wert setzen
    if (currentCellType === 'float' || currentCellType === 'currency' || currentCellType === 'percentage') {
      const n = parseFloat(currentCellOfficeValue);
      if (!isNaN(n)) cell.value = n;
    } else if (currentCellType === 'boolean') {
      cell.value = currentCellOfficeValue === 'true';
    } else if (currentCellText) {
      cell.value = currentCellText;
    } else if (currentCellOfficeValue) {
      cell.value = currentCellOfficeValue;
    }

    // Stil setzen
    if (currentCellStyle) {
      const def = styleMap.cells.get(currentCellStyle);
      if (def) {
        const exStyle = cellDefToExcelStyle(def);
        if (Object.keys(exStyle).length > 0) {
          try { cell.style = exStyle as ExcelJS.Style; } catch { /* ignore */ }
        }
      }
    }

    // Merge eintragen
    if (cellColSpan > 1 || cellRowSpan > 1) {
      sheetMerges.push({ row, col, colSpan: cellColSpan, rowSpan: cellRowSpan });
    }
  };

  for (const tok of tokens) {
    if (tok.type === 'open' || tok.type === 'selfclose') {
      switch (tok.local) {
        case 'spreadsheet':
          inSpreadsheet = true;
          break;

        case 'table':
          if (inSpreadsheet && tok.type === 'open') {
            inTable = true;
            const name = getAttribute(tok.raw, 'name') || `Sheet${wb.worksheets.length + 1}`;
            ws = wb.addWorksheet(name);
            sheetColDefs = [];
            sheetMerges = [];
            currentRow = 0;
          }
          break;

        case 'table-column':
          if (inTable && !inRow) {
            const sn = getAttribute(tok.raw, 'style-name');
            const repeat = getIntAttr(tok.raw, 'number-columns-repeated', 1);
            sheetColDefs.push({ styleName: sn, repeat });
          }
          break;

        case 'table-row':
          if (inTable && tok.type === 'open') {
            inRow = true;
            currentRow++;
            currentCol = 0;
            rowRepeat = getIntAttr(tok.raw, 'number-rows-repeated', 1);
            currentRowStyle = getAttribute(tok.raw, 'style-name');
            if (ws && currentRowStyle) {
              const h = styleMap.rowHeights.get(currentRowStyle);
              if (h !== undefined) ws.getRow(currentRow).height = h;
            }
          }
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inRow) {
            inCell = true;
            isCoveredCell = tok.local === 'covered-table-cell';
            currentCellText = '';
            currentCellType = getAttribute(tok.raw, 'value-type');
            currentCellOfficeValue =
              getAttribute(tok.raw, 'value') ||
              getAttribute(tok.raw, 'date-value') ||
              getAttribute(tok.raw, 'time-value') ||
              '';
            currentCellStyle = getAttribute(tok.raw, 'style-name');
            cellRepeat = getIntAttr(tok.raw, 'number-columns-repeated', 1);
            cellColSpan = getIntAttr(tok.raw, 'number-columns-spanned', 1);
            cellRowSpan = getIntAttr(tok.raw, 'number-rows-spanned', 1);

            if (tok.type === 'selfclose') {
              currentCol++;
              flushCell(currentRow, currentCol);
              currentCol += cellRepeat - 1;
              inCell = false;
              isCoveredCell = false;
              currentCellText = '';
              currentCellOfficeValue = '';
              currentCellType = '';
              currentCellStyle = '';
              cellRepeat = 1;
              cellColSpan = 1;
              cellRowSpan = 1;
            }
          }
          break;

        case 'p':
          if (inCell) inTextP = true;
          break;

        default:
          break;
      }
    } else if (tok.type === 'close') {
      switch (tok.local) {
        case 'spreadsheet':
          inSpreadsheet = false;
          break;

        case 'table':
          if (ws) {
            applyColWidths(ws, sheetColDefs, styleMap);
            for (const m of sheetMerges) {
              if (m.colSpan > 1 || m.rowSpan > 1) {
                try {
                  ws.mergeCells(m.row, m.col, m.row + m.rowSpan - 1, m.col + m.colSpan - 1);
                } catch { /* ignore */ }
              }
            }
          }
          inTable = false;
          ws = null;
          break;

        case 'table-row':
          if (inRow && rowRepeat > 1 && ws) {
            // Zeilenhöhe für wiederholte Zeilen übernehmen
            const baseH = ws.getRow(currentRow).height;
            for (let r = 1; r < rowRepeat; r++) {
              if (baseH) ws.getRow(currentRow + r).height = baseH;
            }
            currentRow += rowRepeat - 1;
          }
          inRow = false;
          currentCol = 0;
          rowRepeat = 1;
          currentRowStyle = '';
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inCell && inRow) {
            currentCol++;
            flushCell(currentRow, currentCol);
            currentCol += cellRepeat - 1;
          }
          inCell = false;
          inTextP = false;
          isCoveredCell = false;
          currentCellText = '';
          currentCellOfficeValue = '';
          currentCellType = '';
          currentCellStyle = '';
          cellRepeat = 1;
          cellColSpan = 1;
          cellRowSpan = 1;
          break;

        case 'p':
          inTextP = false;
          break;

        default:
          break;
      }
    } else if (tok.type === 'text') {
      if (inTextP && inCell && !isCoveredCell) {
        currentCellText += decodeXmlEntities(tok.raw);
      }
    }
  }

  return wb;
}

function applyColWidths(ws: ExcelJS.Worksheet, colDefs: ColDef[], styleMap: StyleMap): void {
  let colIdx = 1;
  for (const def of colDefs) {
    for (let r = 0; r < def.repeat; r++) {
      if (colIdx > 300) return; // Sicherheitsbegrenzung
      if (def.styleName) {
        const w = styleMap.colWidths.get(def.styleName);
        if (w !== undefined && w > 0) {
          try { ws.getColumn(colIdx).width = w; } catch { /* ignore */ }
        }
      }
      colIdx++;
    }
  }
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Liest eine ODS-Datei und gibt ein vollständig formatiertes ExcelJS-Workbook zurück.
 * Erhält: Hintergrundfarben, Schriftstile, Rahmen, Spaltenbreiten, Zeilenhöhen,
 *          verbundene Zellen und Zahlenformate.
 */
export async function parseOdsToWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const zip = await JSZip.loadAsync(buffer);

  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('Ungültige ODS-Datei: content.xml fehlt.');
  const contentXml = await contentFile.async('string');

  const stylesXml = (await zip.file('styles.xml')?.async('string')) ?? '';

  const styleMap = buildStyleMap(contentXml, stylesXml);
  return buildWorkbookFromOds(contentXml, styleMap);
}
