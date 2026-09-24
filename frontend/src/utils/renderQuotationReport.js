import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { DEFAULT_PAGE_SETTINGS, pagePixelSize } from './reportPlaceholders.js';
import { datedFilename } from './spreadsheet.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Keep blank Enter lines visible in print/PDF (empty <p> otherwise collapses). */
export function preserveBlankParagraphs(html) {
  return String(html || '')
    .replace(/<p(\b[^>]*)?>\s*<\/p>/gi, '<p$1>&nbsp;</p>')
    .replace(/<p(\b[^>]*)?>\s*<br\b[^>]*>\s*<\/p>/gi, '<p$1>&nbsp;</p>');
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

/** Strip leading activity codes like "SEED-A002 — Name" → "Name". */
export function activityDisplayName(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  const m = s.match(/^[A-Za-z0-9._/-]+\s*[—–-]\s*(.+)$/);
  return m ? m[1].trim() : s;
}

function lineFromParts({
  slNo,
  activityName,
  description,
  specification,
  quantity,
  unit,
  unit_price,
  total,
  isSub,
}) {
  return {
    slNo: String(slNo),
    activityName: activityDisplayName(activityName),
    description: description || '',
    specification: specification || '',
    quantity: Number(quantity ?? 0),
    unit: unit || '',
    unit_price: Number(unit_price ?? 0),
    total: Number(total ?? (Number(quantity || 0) * Number(unit_price || 0))),
    isSub: Boolean(isSub),
  };
}

/**
 * Build line items with hierarchical Sl No (1, 2, 3.1, 3.2)
 * and activity names without codes.
 */
export function resolveLineItems(report) {
  const apiItems = report?.items || [];
  const saved = report?.custom_data?.activities;

  if (Array.isArray(saved) && saved.length > 0) {
    const lines = [];
    let apiIdx = 0;
    saved.forEach((a, parentIdx) => {
      const parentNo = parentIdx + 1;
      const parentItem = apiItems[apiIdx++];
      const parentCd = parentItem?.custom_data || {};
      lines.push(lineFromParts({
        slNo: parentNo,
        activityName: parentCd.sampleActivity || a.sampleActivity || '',
        description: parentItem?.description || a.description || '',
        specification: parentCd.specification || a.specification || '',
        quantity: parentItem?.quantity ?? a.qty ?? 0,
        unit: parentItem?.unit || a.unit || '',
        unit_price: parentItem?.unit_price ?? a.unitRate ?? 0,
        total: parentItem?.total,
        isSub: false,
      }));
      (a.subActivities || []).forEach((s, subIdx) => {
        const subItem = apiItems[apiIdx++];
        const subCd = subItem?.custom_data || {};
        lines.push(lineFromParts({
          slNo: `${parentNo}.${subIdx + 1}`,
          activityName: subCd.sampleActivity || s.sampleActivity || '',
          description: subItem?.description || s.description || '',
          specification: subCd.specification || s.specification || '',
          quantity: subItem?.quantity ?? s.qty ?? 0,
          unit: subItem?.unit || s.unit || '',
          unit_price: subItem?.unit_price ?? s.unitRate ?? 0,
          total: subItem?.total,
          isSub: true,
        }));
      });
    });
    return lines;
  }

  let parentNo = 0;
  let subNo = 0;
  return apiItems.map((item) => {
    const cd = item.custom_data || {};
    const isSub = Boolean(cd.is_sub_activity);
    let slNo;
    if (isSub) {
      subNo += 1;
      slNo = `${Math.max(parentNo, 1)}.${subNo}`;
    } else {
      parentNo += 1;
      subNo = 0;
      slNo = String(parentNo);
    }
    return lineFromParts({
      slNo,
      activityName: cd.sampleActivity || '',
      description: item.description || '',
      specification: cd.specification || '',
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
      total: item.total,
      isSub,
    });
  });
}

function buildItemsTableHtml(items = [], grandTotal) {
  const border = '1px solid #000';
  const pad = '3px 6px';
  const rows = items.map((item) => {
    const qty = `${item.quantity} ${item.unit || ''}`.trim();
    const nameStyle = item.isSub ? 'padding-left:14px;' : '';
    return `<tr>
      <td style="border:${border};padding:${pad};text-align:center">${item.slNo}</td>
      <td style="border:${border};padding:${pad};${nameStyle}">${esc(item.activityName)}</td>
      <td style="border:${border};padding:${pad}">${esc(item.description)}</td>
      <td style="border:${border};padding:${pad};text-align:center">${esc(qty)}</td>
      <td style="border:${border};padding:${pad};text-align:right">${fmtMoney(item.unit_price)}</td>
      <td style="border:${border};padding:${pad};text-align:right;font-weight:600">${fmtMoney(item.total)}</td>
    </tr>`;
  }).join('');

  const sumQty = items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
  const sum = items.reduce((acc, i) => acc + Number(i.total || 0), 0);
  const totalVal = grandTotal != null && grandTotal !== '' ? Number(grandTotal) : sum;

  return `<table style="width:100%;border-collapse:collapse;border-spacing:0;font-size:inherit;margin:0">
    <thead>
      <tr>
        <th style="border:${border};padding:${pad};text-align:center;width:48px;font-weight:600">Sl No</th>
        <th style="border:${border};padding:${pad};text-align:left;font-weight:600">Activity Name</th>
        <th style="border:${border};padding:${pad};text-align:left;font-weight:600">Description</th>
        <th style="border:${border};padding:${pad};font-weight:600">Qty</th>
        <th style="border:${border};padding:${pad};text-align:right;font-weight:600">Rate</th>
        <th style="border:${border};padding:${pad};text-align:right;font-weight:600">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="border:${border};padding:${pad}">No items</td></tr>`}
      <tr>
        <td colspan="3" style="border:${border};padding:${pad};font-weight:700">Total</td>
        <td style="border:${border};padding:${pad};font-weight:700;text-align:center">${sumQty}</td>
        <td style="border:${border};padding:${pad}"></td>
        <td style="border:${border};padding:${pad};font-weight:700;text-align:right">${fmtMoney(totalVal)}</td>
      </tr>
    </tbody>
  </table>`;
}

function fillPlaceholders(html, map) {
  if (!html) return '';
  let out = String(html);
  // Chip spans from designer
  out = out.replace(
    /<span\b([^>]*\bdata-placeholder=["']([^"']+)["'][^>]*)>[\s\S]*?<\/span>/gi,
    (full, attrs, key) => {
      if (!Object.prototype.hasOwnProperty.call(map, key)) return '';
      const v = map[key];
      if (v == null) return '';
      const text = String(v);
      const styleMatch = String(attrs).match(/\bstyle=["']([^"']*)["']/i);
      const style = styleMatch?.[1] || '';
      const family = style.match(/font-family:\s*([^;]+)/i);
      const size = style.match(/font-size:\s*([^;]+)/i);
      const kept = [
        family ? `font-family: ${family[1].trim()}` : '',
        size ? `font-size: ${size[1].trim()}` : '',
      ].filter(Boolean).join('; ');
      if (!kept || text.trim().startsWith('<')) return text;
      return `<span style="${kept}">${text}</span>`;
    },
  );
  // Legacy {{token}}
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const v = map[key];
      return v == null ? '' : String(v);
    }
    return '';
  });
  return out;
}

export function buildPlaceholderMap({ report, customer, organization } = {}) {
  const cd = report?.custom_data || {};
  const header = cd.header || {};
  const lineItems = resolveLineItems(report);
  const map = {
    report_no: report?.quotation_number || header.reportNo || '',
    date: report?.quotation_date
      ? dayjs(report.quotation_date).format('DD/MM/YYYY')
      : (header.date || ''),
    customer_name: customer?.name || cd.contactPerson || '',
    company_name: cd.companyName || customer?.notes || '',
    contact_person: customer?.name || cd.contactPerson || '',
    mobile: cd.mobileNumber || customer?.phone || '',
    email: cd.emailId || customer?.email || '',
    subject: cd.subject || '',
    items_table: buildItemsTableHtml(lineItems, report?.total),
    grand_total: fmtMoney(report?.total),
    terms: cd.termsAndConditions || report?.notes || '',
    activity_notes: Array.isArray(cd.activityNotes)
      ? cd.activityNotes.map(esc).join('<br/>')
      : '',
    org_name: organization?.name || organization?.organization_name || '',
    org_address: organization?.address || '',
    page_number: '1',
    total_pages: '1',
  };

  Object.entries(header).forEach(([k, v]) => {
    if (v != null && map[k] === undefined) map[k] = v;
  });
  if (cd.customerFields && typeof cd.customerFields === 'object') {
    Object.entries(cd.customerFields).forEach(([k, v]) => {
      if (v != null) map[k] = v;
    });
  }
  if (cd.termsFields && typeof cd.termsFields === 'object') {
    Object.entries(cd.termsFields).forEach(([k, v]) => {
      if (v != null) map[k] = v;
    });
  }
  if (cd.placeholderFields && typeof cd.placeholderFields === 'object') {
    Object.entries(cd.placeholderFields).forEach(([k, v]) => {
      if (v != null) map[k] = v;
    });
  }
  return map;
}

export function renderQuotationDocument({ report, customer, template, organization } = {}) {
  const td = template?.template_data || {};
  const pageSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    pageSize: td.pageSize || DEFAULT_PAGE_SETTINGS.pageSize,
    orientation: td.orientation || DEFAULT_PAGE_SETTINGS.orientation,
    margins: td.margins || DEFAULT_PAGE_SETTINGS.margins,
    headerSpacing: td.headerSpacing ?? DEFAULT_PAGE_SETTINGS.headerSpacing,
    footerSpacing: td.footerSpacing ?? DEFAULT_PAGE_SETTINGS.footerSpacing,
    fontFamily: td.fontFamily || DEFAULT_PAGE_SETTINGS.fontFamily,
    fontSize: td.fontSize || DEFAULT_PAGE_SETTINGS.fontSize,
  };

  const map = buildPlaceholderMap({ report, customer, organization });
  const headerHtml = fillPlaceholders(td.headerHtml, map);
  const bodyHtml = fillPlaceholders(td.bodyHtml, map);
  const footerHtml = fillPlaceholders(td.footerHtml, map);
  const { width, height } = pagePixelSize(pageSettings);
  const hasContent = Boolean(headerHtml || bodyHtml || footerHtml);

  return {
    pageSettings,
    width,
    height,
    headerHtml,
    bodyHtml,
    footerHtml,
    hasContent,
    map,
    lineItems: resolveLineItems(report),
  };
}

export function buildFilledDocumentHtml({ report, customer, template, organization } = {}) {
  const doc = renderQuotationDocument({ report, customer, template, organization });
  const { pageSettings, headerHtml, bodyHtml, footerHtml, hasContent } = doc;
  if (!hasContent) return null;

  const m = pageSettings.margins || {};
  const top = m.top ?? 5;
  const right = m.right ?? 5;
  const bottom = m.bottom ?? 5;
  const left = m.left ?? 5;
  const pagePxLocal = pagePixelSize(pageSettings);
  const contentH = Math.max(40, pagePxLocal.hMm - Number(top) - Number(bottom));
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report?.quotation_number || 'Report')}</title>
<style>
  @page { size: ${pageSettings.pageSize} ${pageSettings.orientation}; margin: ${top}mm ${right}mm ${bottom}mm ${left}mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif;
    font-size: ${pageSettings.fontSize || '12px'};
    color: #000;
    line-height: 1.35;
  }
  .doc-page {
    min-height: ${contentH}mm;
    display: flex;
    flex-direction: column;
  }
  .doc-header { flex-shrink: 0; }
  .doc-body {
    flex: 1 1 auto;
    margin: ${pageSettings.headerSpacing || 0}mm 0 ${pageSettings.footerSpacing || 0}mm;
  }
  .doc-footer { flex-shrink: 0; margin-top: auto; }
  table { border-collapse: collapse; border-spacing: 0; width: 100%; margin: 0; }
  td, th { border: 1px solid #000; padding: 3px 6px; vertical-align: top; background: #fff; }
  th { font-weight: 600; }
  td[style*="border-top: none"], th[style*="border-top: none"] { border-top: none !important; }
  td[style*="border-right: none"], th[style*="border-right: none"] { border-right: none !important; }
  td[style*="border-bottom: none"], th[style*="border-bottom: none"] { border-bottom: none !important; }
  td[style*="border-left: none"], th[style*="border-left: none"] { border-left: none !important; }
  p {
    margin: 0;
    line-height: 1.35;
    min-height: 1.35em;
  }
  p:empty::before { content: '\\00a0'; }
  img { max-width: 100%; height: auto; display: block; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  <div class="doc-page">
    <div class="doc-header">${preserveBlankParagraphs(headerHtml)}</div>
    <div class="doc-body">${preserveBlankParagraphs(bodyHtml)}</div>
    <div class="doc-footer">${preserveBlankParagraphs(footerHtml)}</div>
  </div>
</body></html>`;
}

/** Excel rows matching the generate-report items grid. */
export function quotationExcelRows(report) {
  return resolveLineItems(report).map((row) => ({
    'Sl No': row.slNo,
    'Activity Name': row.activityName,
    Description: row.description,
    Specification: row.specification,
    Qty: row.quantity,
    Unit: row.unit,
    'Unit Rate (₹)': row.unit_price,
    'Total Cost (₹)': row.total,
  }));
}

export function downloadQuotationExcel(report, {
  customer,
  organizationName = 'Organization',
  filename,
} = {}) {
  let name = filename || datedFilename(
    `quotation-${report?.quotation_number || 'report'}`,
    'xlsx',
  );
  if (name.toLowerCase().endsWith('.xls') && !name.toLowerCase().endsWith('.xlsx')) {
    name = `${name.slice(0, -4)}.xlsx`;
  } else if (!name.toLowerCase().endsWith('.xlsx')) {
    name = `${name}.xlsx`;
  }

  const cd = report?.custom_data || {};
  const lines = resolveLineItems(report);
  const columns = [
    'Sl No', 'Activity Name', 'Description', 'Specification',
    'Qty', 'Unit', 'Unit Rate (₹)', 'Total Cost (₹)',
  ];
  const notes = Array.isArray(cd.activityNotes)
    ? cd.activityNotes.filter(Boolean).join('\n')
    : (cd.activityNotes || '');
  const terms = cd.termsAndConditions || report?.notes || '';

  const aoa = [
    [organizationName],
    [`Quotation ${report?.quotation_number || ''}`.trim()],
    [],
    ['Customer Details'],
    ['Customer', customer?.name || '—'],
    ['Contact Person', cd.contactPerson || customer?.name || '—'],
    ['Company', cd.companyName || customer?.notes || '—'],
    ['Mobile', cd.mobileNumber || customer?.phone || '—'],
    ['Email', cd.emailId || customer?.email || '—'],
    ['Subject', cd.subject || '—'],
    ['Report No', report?.quotation_number || '—'],
    ['Date', report?.quotation_date ? dayjs(report.quotation_date).format('DD/MM/YYYY') : '—'],
    [],
    columns,
    ...lines.map((row) => [
      row.slNo,
      row.activityName,
      row.description,
      row.specification,
      row.quantity,
      row.unit,
      row.unit_price,
      row.total,
    ]),
    ['', '', '', '', '', '', 'Total', Number(report?.total || 0)],
    [],
    ['Notes'],
    [notes || '—'],
    [],
    ['Terms & Conditions'],
    [terms || '—'],
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: columns.length - 1 } },
  ];
  worksheet['!cols'] = columns.map(() => ({ wch: 16 }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation');
  XLSX.writeFile(workbook, name);
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function quotationPdfFilename(report) {
  return datedFilename(
    `quotation-${report?.quotation_number || 'report'}`,
    'pdf',
  );
}

function buildQuotationPdfHtml({ report, customer, template, organization } = {}) {
  const td = template?.template_data || {};
  const pageSettings = {
    ...DEFAULT_PAGE_SETTINGS,
    ...td,
    margins: td.margins || DEFAULT_PAGE_SETTINGS.margins,
  };

  let html = buildFilledDocumentHtml({ report, customer, template, organization });
  if (!html) {
    const lines = resolveLineItems(report);
    const table = buildItemsTableHtml(lines, report?.total);
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report?.quotation_number || 'Report')}</title>
<style>
  @page { size: ${pageSettings.pageSize} ${pageSettings.orientation}; margin: 5mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Times New Roman, Arial, sans-serif; font-size: 12px; color: #000; line-height: 1.35; }
  table { border-collapse: collapse; border-spacing: 0; width: 100%; }
  td, th { border: 1px solid #000; padding: 3px 6px; vertical-align: top; }
  h2 { margin: 0 0 8px; font-size: 14px; }
  p { margin: 0.25em 0; }
</style></head><body>
  <h2>${esc(report?.quotation_number || 'Report')}</h2>
  <p><strong>Customer:</strong> ${esc(customer?.name || '—')}</p>
  <p><strong>Total:</strong> ${fmtMoney(report?.total)}</p>
  ${table}
</body></html>`;
  }

  return { html, pageSettings, filename: quotationPdfFilename(report) };
}

async function renderQuotationPdfBlob(ctx) {
  const { html, pageSettings, filename } = buildQuotationPdfHtml(ctx);
  const { api } = await import('../config/auth.js');
  const { data } = await api.post(
    '/pdf/render',
    {
      html,
      page_size: pageSettings.pageSize || 'A4',
      orientation: pageSettings.orientation || 'portrait',
      margins: pageSettings.margins || DEFAULT_PAGE_SETTINGS.margins,
      filename,
    },
    { responseType: 'blob' },
  );
  const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
  if (blob.type && blob.type.includes('json')) {
    const text = await blob.text();
    throw new Error(text || 'PDF render failed');
  }
  return blob;
}

/** Object URL for iframe PDF preview (revoke when done). */
export async function fetchQuotationPdfObjectUrl(ctx) {
  const blob = await renderQuotationPdfBlob(ctx);
  return URL.createObjectURL(blob);
}

export function revokeQuotationPdfObjectUrl(url) {
  if (url) URL.revokeObjectURL(url);
}

/**
 * Download filled quotation as PDF via backend Playwright (Chromium).
 * Falls back to browser print if the PDF service is unavailable.
 */
export async function downloadQuotationPdfViaChromium(ctx = {}) {
  const { html, pageSettings, filename } = buildQuotationPdfHtml(ctx);

  try {
    const blob = await renderQuotationPdfBlob(ctx);
    triggerBlobDownload(blob, filename);
    return;
  } catch (error) {
    const detail = error?.response?.data;
    let message = error?.message || 'PDF render failed';
    if (detail instanceof Blob) {
      try {
        const parsed = JSON.parse(await detail.text());
        message = parsed?.error?.detail || parsed?.detail || message;
      } catch {
        /* keep message */
      }
    } else if (typeof detail === 'object' && detail) {
      message = detail?.error?.detail || detail?.detail || message;
    }

    // Fallback: Chromium print dialog (same layout as Playwright)
    const w = window.open('', '_blank');
    if (!w) {
      throw new Error(message || 'Allow pop-ups to download PDF');
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = ctx.report?.quotation_number || 'Report';
    setTimeout(() => {
      w.focus();
      w.print();
    }, 400);
  }
}
