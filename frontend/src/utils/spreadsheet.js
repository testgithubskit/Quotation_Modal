import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/** e.g. activities-18-9-2026.xlsx (slashes replaced — invalid in Windows filenames) */
export function datedFilename(baseName, extension) {
  const d = new Date();
  const stamp = `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`;
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;
  return `${baseName}-${stamp}.${ext}`;
}

function cellText(value) {
  if (value == null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function looksLikeHeaderCell(text) {
  const t = text.toLowerCase();
  return (
    t.includes('sl.no')
    || t.includes('sl no')
    || t === 's.no'
    || t === 'sno'
    || t.includes('particular')
    || t.includes('activity code')
    || t.includes('customer name')
    || t === 'code'
    || t === 'name'
    || t.includes('specification')
    || t.includes('description')
    || t.includes('unit price')
    || t.includes('proposed charge')
  );
}

/** Find the first row that looks like a real column header (skips title/banner rows). */
function findHeaderRowIndex(matrix) {
  let bestIdx = 0;
  let bestScore = -1;
  const scan = Math.min(matrix.length, 30);
  for (let i = 0; i < scan; i += 1) {
    const row = matrix[i] || [];
    const texts = row.map(cellText).filter(Boolean);
    if (texts.length < 2) continue;
    let score = 0;
    texts.forEach((t) => {
      if (looksLikeHeaderCell(t)) score += 3;
      else if (t.length > 0 && t.length < 40) score += 1;
    });
    // Prefer rows that include an id-like header + a name-like header
    const joined = texts.join(' | ').toLowerCase();
    if (joined.includes('sl') && joined.includes('particular')) score += 8;
    if (joined.includes('activity') && joined.includes('code')) score += 8;
    if (joined.includes('customer') && joined.includes('name')) score += 8;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function matrixToObjects(matrix) {
  if (!matrix?.length) return [];
  const headerIdx = findHeaderRowIndex(matrix);
  const headerRow = matrix[headerIdx] || [];
  const headers = headerRow.map((h, i) => {
    const label = cellText(h);
    return label || `Column_${i + 1}`;
  });

  // Deduplicate headers
  const seen = {};
  const uniqueHeaders = headers.map((h) => {
    const key = h;
    if (seen[key] == null) {
      seen[key] = 0;
      return key;
    }
    seen[key] += 1;
    return `${key}_${seen[key]}`;
  });

  const rows = [];
  for (let r = headerIdx + 1; r < matrix.length; r += 1) {
    const line = matrix[r] || [];
    const obj = {};
    let nonEmpty = 0;
    uniqueHeaders.forEach((header, c) => {
      const val = line[c];
      const text = typeof val === 'number' ? val : cellText(val);
      obj[header] = text;
      if (text !== '' && text != null) nonEmpty += 1;
    });
    if (nonEmpty === 0) continue;
    // Skip repeated header rows inside the sheet
    const first = cellText(obj[uniqueHeaders[0]]);
    if (looksLikeHeaderCell(first) && uniqueHeaders.some((h) => looksLikeHeaderCell(cellText(obj[h])))) {
      continue;
    }
    rows.push(obj);
  }
  return rows;
}

/**
 * Parse .xlsx / .xls / .csv into row objects.
 * Handles title rows above the real header (e.g. metrology price lists).
 * Merges all sheets that contain tabular data.
 */
export function parseSpreadsheetFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const allRows = [];
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) return;
          const matrix = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: false,
            blankrows: false,
          });
          const objects = matrixToObjects(matrix);
          objects.forEach((row) => {
            allRows.push({ ...row, _sheet: sheetName.trim() });
          });
        });
        resolve(allRows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

export function downloadRowsExcel(rows, filename = 'export.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': '' }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, filename);
}

/** @param {Record<string, unknown>[]} rows */
export function downloadRowsPdf(rows, filename = 'export.pdf', title = 'Export') {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14);
  doc.text(title, 40, 36);

  const headers = rows.length ? Object.keys(rows[0]).filter((k) => k !== '_sheet') : ['No data'];
  const body = rows.map((row) => headers.map((key) => String(row[key] ?? '')));

  autoTable(doc, {
    startY: 48,
    head: [headers],
    body: body.length ? body : [['No rows']],
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [13, 148, 136] },
  });

  doc.save(filename);
}
