import * as XLSX from 'xlsx';
import { formatFieldValue } from './fieldSchema';

function buildExportRows(rows, fieldDefs) {
  const fields = fieldDefs || [];
  return (rows || []).map((row, index) => {
    const out = { 'Sl.No': index + 1 };
    fields.forEach((field) => {
      const raw = row?.[field.key];
      if (field.key === 'cost' || field.type === 'number') {
        out[field.label] = Number(raw || 0);
      } else {
        const formatted = formatFieldValue(field, raw);
        out[field.label] = formatted == null || formatted === '—' ? '' : formatted;
      }
    });
    return out;
  });
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download rows as .xlsx using current table columns. */
export function downloadTableExcel({ rows, fieldDefs, fileName = 'export' }) {
  const data = buildExportRows(rows, fieldDefs);
  const sheet = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data');
  const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(
    `${fileName}.xlsx`,
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
}

/** Open a printable HTML table so the user can Save as PDF. */
export function downloadTablePdf({ rows, fieldDefs, title = 'Export', fileName = 'export' }) {
  const fields = fieldDefs || [];
  const headers = ['Sl.No', ...fields.map((f) => f.label)];
  const body = (rows || []).map((row, index) => {
    const cells = [
      String(index + 1),
      ...fields.map((field) => {
        const raw = row?.[field.key];
        if (field.key === 'cost' || field.type === 'number') {
          return String(Number(raw || 0));
        }
        const formatted = formatFieldValue(field, raw);
        return formatted == null || formatted === '—' ? '' : String(formatted);
      }),
    ];
    return `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #1C1E22; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #E4E0D8; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #F1EEE6; font-weight: 600; }
    @media print {
      body { margin: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${body || '<tr><td colspan="' + headers.length + '">No data</td></tr>'}</tbody>
  </table>
  <script>
    window.onload = function () {
      document.title = ${JSON.stringify(fileName)};
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('Pop-up blocked. Allow pop-ups to download PDF.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
