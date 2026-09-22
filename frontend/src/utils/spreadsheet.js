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

function reportColumns(rows) {
  if (!rows?.length) return ['SL NO'];
  const keys = Object.keys(rows[0]).filter((k) => k !== '_sheet' && k !== 'SL NO' && k !== 'Sl No');
  return ['SL NO', ...keys];
}

function reportBody(rows, columns) {
  return (rows || []).map((row, i) => columns.map((col) => {
    if (col === 'SL NO') {
      const existing = row['Sl No'] ?? row['SL NO'] ?? row['Sl No.'];
      if (existing != null && existing !== '') return String(existing);
      return String(i + 1);
    }
    const val = row[col];
    return val == null || val === '' ? '—' : String(val);
  }));
}

function formatGeneratedOn(date = new Date()) {
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

/** Simple sheet (no report header) — used by template designer export */
export function downloadRowsExcel(rows, filename = 'export.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': '' }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, filename);
}

/**
 * Report-style Excel (.xlsx) with org name, title, SL NO, and data rows.
 * Real Office Open XML workbook (not HTML disguised as .xls).
 */
export function downloadReportExcel(rows, filename = 'export.xlsx', {
  organizationName = 'Organization',
  title = 'Report',
} = {}) {
  const columns = reportColumns(rows);
  const body = reportBody(rows, columns);
  const generated = formatGeneratedOn();
  const colCount = Math.max(columns.length, 1);

  const aoa = [
    [organizationName],
    [title],
    [`Total rows: ${body.length}`],
    [`Generated on: ${generated}`],
    [],
    columns,
    ...(body.length ? body : [columns.map(() => '')]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
  ];
  worksheet['!cols'] = columns.map((c) => ({
    wch: Math.min(40, Math.max(12, String(c).length + 4)),
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

  let safeName = filename || 'export.xlsx';
  if (safeName.toLowerCase().endsWith('.xls') && !safeName.toLowerCase().endsWith('.xlsx')) {
    safeName = `${safeName.slice(0, -4)}.xlsx`;
  } else if (!safeName.toLowerCase().endsWith('.xlsx')) {
    safeName = `${safeName}.xlsx`;
  }
  XLSX.writeFile(workbook, safeName);
}

/** @param {Record<string, unknown>[]} rows */
export function downloadRowsPdf(rows, filename = 'export.pdf', title = 'Export') {
  downloadReportPdf(rows, filename, { title, organizationName: '' });
}

/** Report-style PDF: centered org name, title, SL NO, grid borders (tight production layout) */
export function downloadReportPdf(rows, filename = 'export.pdf', {
  organizationName = '',
  title = 'Report',
} = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 28;

  if (organizationName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(String(organizationName).toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 16;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(String(title), pageW / 2, y, { align: 'center' });
  y += 14;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total rows: ${rows?.length || 0}  ·  Generated on: ${formatGeneratedOn()}`, 36, y);
  y += 10;

  const columns = reportColumns(rows);
  const body = reportBody(rows, columns);

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.toUpperCase())],
    body: body.length ? body : [columns.map((_, i) => (i === 0 ? '' : 'No rows'))],
    styles: {
      fontSize: 8,
      cellPadding: { top: 3, right: 4, bottom: 3, left: 4 },
      lineColor: [0, 0, 0],
      lineWidth: 0.4,
      textColor: [0, 0, 0],
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [13, 148, 136],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      lineColor: [0, 0, 0],
      lineWidth: 0.4,
      cellPadding: { top: 4, right: 4, bottom: 4, left: 4 },
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    theme: 'grid',
    margin: { left: 36, right: 36, top: 28, bottom: 28 },
    tableWidth: 'auto',
  });

  doc.save(filename);
}
