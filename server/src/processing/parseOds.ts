/**
 * ODS-Parser: Liest OpenDocument Spreadsheet (ZIP + content.xml) und gibt
 * Sheet-Daten als string[][] zurück.
 *
 * ODS ist ein ZIP-Archiv. Innerhalb liegt content.xml mit dem Tabelleninhalt
 * im ODF-Format. Wir extrahieren das mit jszip und parsen die XML-Struktur
 * manuell per regulären Ausdrücken, da kein voller DOM-Parser benötigt wird.
 */

import JSZip from 'jszip';

export interface OdsSheet {
  name: string;
  rows: string[][];
}

/**
 * Zelle mit Display-Text UND rohem numerischen Wert (office:value).
 * Wird für die Konsolidierung benötigt, damit deutsche Formatierung
 * (z. B. "-13.797,37 €") nicht falsch interpretiert wird.
 */
export interface OdsCellRich {
  text: string;           // Anzeigetext (text:p Inhalt)
  numericValue?: number;  // office:value wenn Typ float/currency/percentage
}

export interface OdsSheetRich {
  name: string;
  rows: OdsCellRich[][];
}

/**
 * Liest einen ODS-Buffer und gibt alle Sheets zurück (Strings).
 */
export async function parseOdsBuffer(buffer: Buffer): Promise<OdsSheet[]> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('Ungültige ODS-Datei: content.xml fehlt.');
  const xml = await contentFile.async('string');
  return parseContentXml(xml);
}

/**
 * Liest einen ODS-Buffer und gibt alle Sheets mit Rohwerten zurück.
 * Numerische Zellen enthalten zusätzlich `numericValue` (office:value geparsed),
 * damit bei der Konsolidierung keine Parsing-Fehler durch die Lokalisierung entstehen.
 */
export async function parseOdsBufferRich(buffer: Buffer): Promise<OdsSheetRich[]> {
  const zip = await JSZip.loadAsync(buffer);
  const contentFile = zip.file('content.xml');
  if (!contentFile) throw new Error('Ungültige ODS-Datei: content.xml fehlt.');
  const xml = await contentFile.async('string');
  return parseContentXmlRich(xml);
}

// ---------------------------------------------------------------------------
// Interner XML-Parser für ODF content.xml
// ---------------------------------------------------------------------------

/**
 * Entfernt XML-Namespace-Präfixe aus Tag- und Attributnamen für einfacheres Matching.
 * Bsp: "table:table" → "table", "office:value" → "value"
 */
function localName(qname: string): string {
  const idx = qname.indexOf(':');
  return idx >= 0 ? qname.slice(idx + 1) : qname;
}

/**
 * Liest einen Attributwert aus einem Raw-Tag-String.
 * Bsp: getAttribute('<table:table table:name="Sheet1">', 'name') → 'Sheet1'
 */
function getAttribute(tag: string, attrLocalName: string): string {
  const re = new RegExp(`[a-zA-Z-]+:${attrLocalName}\\s*=\\s*["']([^"']*)["']`);
  const m = re.exec(tag);
  return m ? m[1] : '';
}

/**
 * Liest den numerischen Wiederholungs-Wert (table:number-columns-repeated oder
 * table:number-rows-repeated).
 */
function getRepeated(tag: string, kind: 'columns' | 'rows'): number {
  const attr = kind === 'columns' ? 'number-columns-repeated' : 'number-rows-repeated';
  const re = new RegExp(`[a-zA-Z-]+:${attr}\\s*=\\s*["']([0-9]+)["']`);
  const m = re.exec(tag);
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * Tokenisiert den XML-String in Open-Tags, Close-Tags und Textknoten.
 * Reicht für ODF content.xml, da keine CDATA-Sektionen o.ä. vorkommen.
 */
interface Token {
  type: 'open' | 'close' | 'selfclose' | 'text';
  raw: string;       // der rohe Tag-String inkl. < >
  local: string;     // lokaler Name (ohne Namespace)
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
      // Nur relevante Textknoten (nicht nur Whitespace)
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
      const qname = raw.slice(2).replace(/\s.*$/, '').replace('>', '');
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

/**
 * Parst den XML-String von content.xml und extrahiert alle Tabellen
 * als Array von OdsSheet.
 */
function parseContentXml(xml: string): OdsSheet[] {
  const tokens = tokenize(xml);
  const sheets: OdsSheet[] = [];

  let inSpreadsheet = false;
  let inTable = false;
  let inRow = false;
  let inCell = false;
  let inTextP = false;

  let currentSheet: OdsSheet | null = null;
  let currentRow: string[] = [];
  let currentCellText = '';
  let currentCellValue = '';  // office:value / office:date-value etc.
  let currentCellType = '';   // office:value-type
  let cellRepeat = 1;
  let rowRepeat = 1;

  for (const tok of tokens) {
    if (tok.type === 'open' || tok.type === 'selfclose') {
      switch (tok.local) {
        case 'spreadsheet':
          inSpreadsheet = true;
          break;

        case 'table':
          if (inSpreadsheet) {
            inTable = true;
            const name = getAttribute(tok.raw, 'name') || `Sheet${sheets.length + 1}`;
            currentSheet = { name, rows: [] };
          }
          break;

        case 'table-row':
          if (inTable) {
            inRow = true;
            currentRow = [];
            rowRepeat = getRepeated(tok.raw, 'rows');
          }
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inRow) {
            inCell = true;
            currentCellText = '';
            currentCellType = getAttribute(tok.raw, 'value-type');
            currentCellValue = getAttribute(tok.raw, 'value') ||
                               getAttribute(tok.raw, 'date-value') ||
                               getAttribute(tok.raw, 'time-value') ||
                               getAttribute(tok.raw, 'boolean-value') ||
                               getAttribute(tok.raw, 'string-value');
            cellRepeat = getRepeated(tok.raw, 'columns');
          }
          // Selbst-schließende Zelle: direkt als Leerstring abschließen
          if (tok.type === 'selfclose' && inRow) {
            const val = resolveCellValue(currentCellType, currentCellValue, currentCellText);
            for (let r = 0; r < cellRepeat; r++) currentRow.push(val);
            inCell = false;
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
          if (currentSheet) {
            // Trailing leere Zeilen entfernen
            while (
              currentSheet.rows.length > 0 &&
              (currentSheet.rows[currentSheet.rows.length - 1] ?? []).every((c) => c === '')
            ) {
              currentSheet.rows.pop();
            }
            sheets.push(currentSheet);
            currentSheet = null;
          }
          inTable = false;
          break;

        case 'table-row':
          if (inRow && currentSheet) {
            // Trailing leere Zellen abschneiden
            let last = currentRow.length - 1;
            while (last >= 0 && currentRow[last] === '') last--;
            const trimmedRow = currentRow.slice(0, last + 1);
            // Zeile nur hinzufügen wenn nicht komplett leer
            const isEmpty = trimmedRow.length === 0;
            for (let r = 0; r < rowRepeat; r++) {
              if (!isEmpty || currentSheet.rows.length > 0) {
                currentSheet.rows.push([...trimmedRow]);
              }
            }
          }
          inRow = false;
          currentRow = [];
          rowRepeat = 1;
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inCell && inRow) {
            const val = resolveCellValue(currentCellType, currentCellValue, currentCellText);
            for (let r = 0; r < cellRepeat; r++) currentRow.push(val);
          }
          inCell = false;
          inTextP = false;
          currentCellText = '';
          currentCellValue = '';
          currentCellType = '';
          cellRepeat = 1;
          break;

        case 'p':
          inTextP = false;
          break;

        default:
          break;
      }
    } else if (tok.type === 'text') {
      if (inTextP && inCell) {
        // XML-Entitäten dekodieren
        currentCellText += decodeXmlEntities(tok.raw);
      }
    }
  }

  return sheets;
}

/**
 * Bestimmt den Zellwert: bevorzuge text:p-Inhalt, Fallback auf office:value.
 */
function resolveCellValue(type: string, officeValue: string, textContent: string): string {
  if (textContent) return textContent;
  if (officeValue) return officeValue;
  if (type === 'boolean') return officeValue === 'true' ? 'TRUE' : 'FALSE';
  return '';
}

/**
 * Wie resolveCellValue, gibt aber auch den rohen Zahlenwert zurück.
 * Numerische Typen: 'float', 'currency', 'percentage' → office:value ist immer
 * ein Standard-Dezimalzahl (Punkt als Trennzeichen, kein Tausender-Separator).
 */
function resolveCellValueRich(
  type: string,
  officeValue: string,
  textContent: string
): OdsCellRich {
  const text = textContent || officeValue || '';
  let numericValue: number | undefined;
  if (officeValue && (type === 'float' || type === 'currency' || type === 'percentage')) {
    const n = parseFloat(officeValue);
    if (!isNaN(n)) numericValue = n;
  }
  return { text, numericValue };
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ---------------------------------------------------------------------------
// Rich-Variante des Parsers (OdsSheetRich)
// ---------------------------------------------------------------------------

/**
 * Wie parseContentXml, gibt aber OdsSheetRich[] zurück (mit numericValue).
 */
function parseContentXmlRich(xml: string): OdsSheetRich[] {
  const tokens = tokenize(xml);
  const sheets: OdsSheetRich[] = [];

  let inSpreadsheet = false;
  let inTable = false;
  let inRow = false;
  let inCell = false;
  let inTextP = false;

  let currentSheet: OdsSheetRich | null = null;
  let currentRow: OdsCellRich[] = [];
  let currentCellText = '';
  let currentCellValue = '';
  let currentCellType = '';
  let cellRepeat = 1;
  let rowRepeat = 1;

  for (const tok of tokens) {
    if (tok.type === 'open' || tok.type === 'selfclose') {
      switch (tok.local) {
        case 'spreadsheet':
          inSpreadsheet = true;
          break;

        case 'table':
          if (inSpreadsheet) {
            inTable = true;
            const name = getAttribute(tok.raw, 'name') || `Sheet${sheets.length + 1}`;
            currentSheet = { name, rows: [] };
          }
          break;

        case 'table-row':
          if (inTable) {
            inRow = true;
            currentRow = [];
            rowRepeat = getRepeated(tok.raw, 'rows');
          }
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inRow) {
            inCell = true;
            currentCellText = '';
            currentCellType = getAttribute(tok.raw, 'value-type');
            currentCellValue =
              getAttribute(tok.raw, 'value') ||
              getAttribute(tok.raw, 'date-value') ||
              getAttribute(tok.raw, 'time-value') ||
              getAttribute(tok.raw, 'boolean-value') ||
              getAttribute(tok.raw, 'string-value');
            cellRepeat = getRepeated(tok.raw, 'columns');
          }
          if (tok.type === 'selfclose' && inRow) {
            const cell = resolveCellValueRich(currentCellType, currentCellValue, currentCellText);
            for (let r = 0; r < cellRepeat; r++) currentRow.push({ ...cell });
            inCell = false;
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
          if (currentSheet) {
            while (
              currentSheet.rows.length > 0 &&
              (currentSheet.rows[currentSheet.rows.length - 1] ?? []).every(
                (c) => c.text === '' && c.numericValue === undefined
              )
            ) {
              currentSheet.rows.pop();
            }
            sheets.push(currentSheet);
            currentSheet = null;
          }
          inTable = false;
          break;

        case 'table-row':
          if (inRow && currentSheet) {
            let last = currentRow.length - 1;
            while (last >= 0 && currentRow[last]!.text === '' && currentRow[last]!.numericValue === undefined) last--;
            const trimmedRow = currentRow.slice(0, last + 1);
            const isEmpty = trimmedRow.length === 0;
            for (let r = 0; r < rowRepeat; r++) {
              if (!isEmpty || currentSheet.rows.length > 0) {
                currentSheet.rows.push(trimmedRow.map((c) => ({ ...c })));
              }
            }
          }
          inRow = false;
          currentRow = [];
          rowRepeat = 1;
          break;

        case 'table-cell':
        case 'covered-table-cell':
          if (inCell && inRow) {
            const cell = resolveCellValueRich(currentCellType, currentCellValue, currentCellText);
            for (let r = 0; r < cellRepeat; r++) currentRow.push({ ...cell });
          }
          inCell = false;
          inTextP = false;
          currentCellText = '';
          currentCellValue = '';
          currentCellType = '';
          cellRepeat = 1;
          break;

        case 'p':
          inTextP = false;
          break;

        default:
          break;
      }
    } else if (tok.type === 'text') {
      if (inTextP && inCell) {
        currentCellText += decodeXmlEntities(tok.raw);
      }
    }
  }

  return sheets;
}
