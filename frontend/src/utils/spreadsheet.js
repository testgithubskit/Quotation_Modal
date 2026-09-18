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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function reportColumns(rows) {
  if (!rows?.length) return ['SL NO'];
  const keys = Object.keys(rows[0]).filter((k) => k !== '_sheet' && k !== 'SL NO' && k !== 'Sl No');
  return ['SL NO', ...keys];
}

function reportBody(rows, columns) {
  return (rows || []).map((row, i) => columns.map((col) => {
    if (col === 'SL NO') return String(i + 1);
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

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Simple sheet (no report header) — used by template designer export */
export function downloadRowsExcel(rows, filename = 'export.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': '' }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, filename);
}

/**
 * Report-style Excel with centered org name, title, SL NO, and full cell borders.
 * Written as HTML spreadsheet so Excel shows borders without a paid SheetJS build.
 */
export function downloadReportExcel(rows, filename = 'export.xls', {
  organizationName = 'Organization',
  title = 'Report',
} = {}) {
  const columns = reportColumns(rows);
  const body = reportBody(rows, columns);
  const colCount = columns.length;
  const generated = formatGeneratedOn();
  const border = 'border:1px solid #94a3b8;';
  const cell = `${border}padding:6px 8px;font-family:Arial,sans-serif;font-size:11px;color:#0f172a;`;
  const headCell = `${border}padding:7px 8px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#ffffff;background:#64748b;text-transform:uppercase;`;

  const headerRow = columns.map((c) => `<th style="${headCell}">${escapeHtml(c)}</th>`).join('');
  const dataRows = body.map((cells, idx) => {
    const bg = idx % 2 === 1 ? 'background:#f8fafc;' : 'background:#ffffff;';
    return `<tr>${cells.map((v) => `<td style="${cell}${bg}">${escapeHtml(v)}</td>`).join('')}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Report</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
  <tr><td colspan="${colCount}" style="text-align:center;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#0f172a;padding:8px 4px">${escapeHtml(organizationName)}</td></tr>
  <tr><td colspan="${colCount}" style="text-align:center;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#475569;padding:2px 4px 10px">${escapeHtml(title)}</td></tr>
  <tr><td colspan="${colCount}" style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;padding:2px 4px">Total rows: ${body.length}</td></tr>
  <tr><td colspan="${colCount}" style="font-family:Arial,sans-serif;font-size:11px;color:#64748b;padding:2px 4px 12px">Generated on: ${escapeHtml(generated)}</td></tr>
  <tr>${headerRow}</tr>
  ${dataRows || `<tr><td colspan="${colCount}" style="${cell}">No rows</td></tr>`}
</table>
</body></html>`;

  const safeName = filename.toLowerCase().endsWith('.xlsx')
    ? `${filename.slice(0, -5)}.xls`
    : (filename.toLowerCase().endsWith('.xls') ? filename : `${filename}.xls`);
  triggerDownload(new Blob([html], { type: 'application/vnd.ms-excel' }), safeName);
}

/** @param {Record<string, unknown>[]} rows */
export function downloadRowsPdf(rows, filename = 'export.pdf', title = 'Export') {
  downloadReportPdf(rows, filename, { title, organizationName: '' });
}

/** Report-style PDF: centered org name, title, SL NO, grid borders */
export function downloadReportPdf(rows, filename = 'export.pdf', {
  organizationName = '',
  title = 'Report',
} = {}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 36;

  if (organizationName) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(String(organizationName).toUpperCase(), pageW / 2, y, { align: 'center' });
    y += 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(String(title), pageW / 2, y, { align: 'center' });
  y += 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Total rows: ${rows?.length || 0}`, 40, y);
  y += 12;
  doc.text(`Generated on: ${formatGeneratedOn()}`, 40, y);
  y += 14;

  const columns = reportColumns(rows);
  const body = reportBody(rows, columns);

  autoTable(doc, {
    startY: y,
    head: [columns.map((c) => c.toUpperCase())],
    body: body.length ? body : [columns.map((_, i) => (i === 0 ? '' : 'No rows'))],
    styles: {
      fontSize: 8,
      cellPadding: 4,
      lineColor: [148, 163, 184],
      lineWidth: 0.4,
      textColor: [15, 23, 42],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [100, 116, 139],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
      lineColor: [148, 163, 184],
      lineWidth: 0.4,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: 'grid',
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}
