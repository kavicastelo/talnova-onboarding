/**
 * RFC 4180 Compliant CSV / TSV Parser
 * Supports:
 * - Escaped quotes ("")
 * - Commas / delimiters inside quoted strings
 * - Multiline quoted fields
 * - Automatic delimiter detection (comma, semicolon, tab)
 * - UTF-8 Byte Order Mark (BOM) stripping
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  delimiter: string;
}

export function parseDelimitedText(text: string): ParsedCsvResult {
  if (!text || !text.trim()) {
    return { headers: [], rows: [], totalRows: 0, delimiter: ',' };
  }

  // 1. Strip UTF-8 BOM if present
  const cleanText = text.replace(/^\uFEFF/, '');

  // 2. Auto-detect delimiter by analyzing the first few lines
  const delimiter = detectDelimiter(cleanText);

  // 3. Parse tokens into rows
  const rawRows = tokenizeCsv(cleanText, delimiter);
  if (rawRows.length === 0) {
    return { headers: [], rows: [], totalRows: 0, delimiter };
  }

  // Clean and sanitize headers
  const rawHeaders = rawRows[0].map((h) => h.trim().replace(/^["']|["']$/g, ''));
  // Remove trailing empty headers
  while (rawHeaders.length > 0 && !rawHeaders[rawHeaders.length - 1]) {
    rawHeaders.pop();
  }

  const headers = rawHeaders;
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < rawRows.length; i++) {
    const rawRow = rawRows[i];
    // Skip empty lines
    if (rawRow.length === 0 || rawRow.every((cell) => !cell || !cell.trim())) {
      continue;
    }

    const rowObj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      rowObj[header] = rawRow[idx] !== undefined ? rawRow[idx].trim() : '';
    });
    rows.push(rowObj);
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    delimiter,
  };
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  if (semiCount > commaCount && semiCount > tabCount) return ';';
  return ',';
}

function tokenizeCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (insideQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote: "" -> "
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === delimiter) {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (nextChar === '\n') {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i += 2;
          continue;
        } else {
          currentRow.push(currentField);
          rows.push(currentRow);
          currentRow = [];
          currentField = '';
          i++;
          continue;
        }
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push last field & row if pending
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}
