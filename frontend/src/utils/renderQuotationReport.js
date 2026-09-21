import dayjs from 'dayjs';
import { DEFAULT_PAGE_SETTINGS, pagePixelSize } from './reportPlaceholders.js';
import { datedFilename } from './spreadsheet.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  const border = '1px solid #cbd5e1';
  const headBg = '#f1f5f9';
  const footBg = '#f1f5f9';
  const rows = items.map((item) => {
    const qty = `${item.quantity} ${item.unit || ''}`.trim();
    const nameStyle = item.isSub ? 'padding-left:16px;' : '';
    return `<tr>
      <td style="border:${border};padding:6px 8px;text-align:center;background:#fff">${item.slNo}</td>
      <td style="border:${border};padding:6px 8px;background:#fff;${nameStyle}">${esc(item.activityName)}</td>
      <td style="border:${border};padding:6px 8px;background:#fff">${esc(item.description)}</td>
      <td style="border:${border};padding:6px 8px;text-align:center;background:#fff">${esc(qty)}</td>
      <td style="border:${border};padding:6px 8px;text-align:right;background:#fff">${fmtMoney(item.unit_price)}</td>
      <td style="border:${border};padding:6px 8px;text-align:right;background:#fff;font-weight:600">${fmtMoney(item.total)}</td>
    </tr>`;
  }).join('');

  const sumQty = items.reduce((acc, i) => acc + Number(i.quantity || 0), 0);
  const sum = items.reduce((acc, i) => acc + Number(i.total || 0), 0);
  const totalVal = grandTotal != null && grandTotal !== '' ? Number(grandTotal) : sum;

  return `<table style="width:100%;border-collapse:collapse;font-size:inherit">
    <thead>
      <tr>
        <th style="border:${border};padding:7px 8px;text-align:center;width:48px;background:${headBg};color:#0f172a;font-weight:600">Sl No</th>
        <th style="border:${border};padding:7px 8px;text-align:left;background:${headBg};color:#0f172a;font-weight:600">Activity Name</th>
        <th style="border:${border};padding:7px 8px;text-align:left;background:${headBg};color:#0f172a;font-weight:600">Description</th>
        <th style="border:${border};padding:7px 8px;background:${headBg};color:#0f172a;font-weight:600">Qty</th>
        <th style="border:${border};padding:7px 8px;text-align:right;background:${headBg};color:#0f172a;font-weight:600">Rate</th>
        <th style="border:${border};padding:7px 8px;text-align:right;background:${headBg};color:#0f172a;font-weight:600">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="border:${border};padding:8px;background:#fff">No items</td></tr>`}
      <tr>
        <td colspan="3" style="border:${border};padding:8px;background:${footBg};color:#0f172a;font-weight:700">Total</td>
        <td style="border:${border};padding:8px;background:${footBg};color:#0f172a;font-weight:700;text-align:center">${sumQty}</td>
        <td style="border:${border};padding:8px;background:${footBg}"></td>
        <td style="border:${border};padding:8px;background:${footBg};color:#0f172a;font-weight:700;text-align:right">${fmtMoney(totalVal)}</td>
      </tr>
    </tbody>
  </table>`;
}

function fillPlaceholders(html, map) {
  if (!html) return '';
  let out = String(html);
  // Chip spans from designer
  out = out.replace(
    /<span[^>]*\bdata-placeholder=["']([^"']+)["'][^>]*>[\s\S]*?<\/span>/gi,
    (_, key) => {
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        const v = map[key];
        return v == null ? '' : String(v);
      }
      return '';
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
    customer_name: customer?.name || '',
    company_name: cd.companyName || customer?.notes || '',
    contact_person: cd.contactPerson || '',
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
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report?.quotation_number || 'Report')}</title>
<style>
  @page { size: ${pageSettings.pageSize} ${pageSettings.orientation}; margin: ${m.top || 5}mm ${m.right || 5}mm ${m.bottom || 5}mm ${m.left || 5}mm; }
  body { margin: 0; font-family: ${pageSettings.fontFamily || 'Times New Roman'}, Arial, sans-serif; font-size: ${pageSettings.fontSize || '12px'}; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; background: #fff; }
  th { background: #fff; font-weight: 600; }
  img { max-width: 100%; height: auto; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  <div>${headerHtml}</div>
  <div style="margin:${pageSettings.headerSpacing || 0}mm 0">${bodyHtml}</div>
  <div>${footerHtml}</div>
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

function escapeExcelHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadQuotationExcel(report, {
  customer,
  organizationName = 'Organization',
  filename,
} = {}) {
  const name = filename || datedFilename(
    `quotation-${report?.quotation_number || 'report'}`,
    'xls',
  );
  const cd = report?.custom_data || {};
  const lines = resolveLineItems(report);
  const columns = [
    'Sl No', 'Activity Name', 'Description', 'Specification',
    'Qty', 'Unit', 'Unit Rate (₹)', 'Total Cost (₹)',
  ];
  const colCount = columns.length;
  const border = 'border:1px solid #94a3b8;';
  const cell = `${border}padding:6px 8px;font-family:Arial,sans-serif;font-size:11px;color:#0f172a;`;
  const headCell = `${border}padding:7px 8px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#ffffff;background:#64748b;text-transform:uppercase;`;
  const labelCell = `${border}padding:6px 8px;font-family:Arial,sans-serif;font-size:11px;font-weight:bold;color:#0f172a;background:#f1f5f9;width:160px;`;
  const metaRow = (label, value) => (
    `<tr><td style="${labelCell}">${escapeExcelHtml(label)}</td>`
    + `<td colspan="${colCount - 1}" style="${cell}">${escapeExcelHtml(value ?? '—')}</td></tr>`
  );

  const notes = Array.isArray(cd.activityNotes)
    ? cd.activityNotes.filter(Boolean).join('\n')
    : (cd.activityNotes || '');
  const terms = cd.termsAndConditions || report?.notes || '';

  const headerRow = columns.map((c) => `<th style="${headCell}">${escapeExcelHtml(c)}</th>`).join('');
  const dataRows = lines.map((row, idx) => {
    const bg = idx % 2 === 1 ? 'background:#f8fafc;' : 'background:#ffffff;';
    const vals = [
      row.slNo,
      row.activityName,
      row.description,
      row.specification,
      row.quantity,
      row.unit,
      row.unit_price,
      row.total,
    ];
    return `<tr>${vals.map((v) => `<td style="${cell}${bg}">${escapeExcelHtml(v)}</td>`).join('')}</tr>`;
  }).join('');

  const totalRow = (
    `<tr>`
    + `<td colspan="${colCount - 1}" style="${cell}text-align:right;font-weight:bold;background:#f1f5f9;">Total</td>`
    + `<td style="${cell}font-weight:bold;background:#f1f5f9;">${escapeExcelHtml(fmtMoney(report?.total))}</td>`
    + `</tr>`
  );

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="UTF-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>Quotation</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">
  <tr><td colspan="${colCount}" style="text-align:center;font-family:Arial,sans-serif;font-size:18px;font-weight:700;color:#0f172a;padding:8px 4px">${escapeExcelHtml(organizationName)}</td></tr>
  <tr><td colspan="${colCount}" style="text-align:center;font-family:Arial,sans-serif;font-size:13px;font-weight:600;color:#475569;padding:2px 4px 10px">${escapeExcelHtml(`Quotation ${report?.quotation_number || ''}`.trim())}</td></tr>
  <tr><td colspan="${colCount}" style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#0f172a;padding:10px 4px 4px;background:#e2e8f0;">Customer Details</td></tr>
  ${metaRow('Customer', customer?.name)}
  ${metaRow('Contact Person', cd.contactPerson || customer?.name)}
  ${metaRow('Company', cd.companyName || customer?.notes)}
  ${metaRow('Mobile', cd.mobileNumber || customer?.phone)}
  ${metaRow('Email', cd.emailId || customer?.email)}
  ${metaRow('Subject', cd.subject)}
  ${metaRow('Report No', report?.quotation_number)}
  ${metaRow('Date', report?.quotation_date ? dayjs(report.quotation_date).format('DD/MM/YYYY') : '')}
  <tr><td colspan="${colCount}" style="padding:8px 0 0"></td></tr>
  <tr>${headerRow}</tr>
  ${dataRows || `<tr><td colspan="${colCount}" style="${cell}">No items</td></tr>`}
  ${totalRow}
  <tr><td colspan="${colCount}" style="padding:12px 0 0"></td></tr>
  <tr><td colspan="${colCount}" style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#0f172a;padding:8px 4px 4px;background:#e2e8f0;">Notes</td></tr>
  <tr><td colspan="${colCount}" style="${cell}white-space:pre-wrap;">${escapeExcelHtml(notes || '—')}</td></tr>
  <tr><td colspan="${colCount}" style="padding:12px 0 0"></td></tr>
  <tr><td colspan="${colCount}" style="font-family:Arial,sans-serif;font-size:12px;font-weight:700;color:#0f172a;padding:8px 4px 4px;background:#e2e8f0;">Terms &amp; Conditions</td></tr>
  <tr><td colspan="${colCount}" style="${cell}white-space:pre-wrap;">${escapeExcelHtml(terms || '—')}</td></tr>
</table>
</body></html>`;

  const safeName = name.toLowerCase().endsWith('.xlsx')
    ? `${name.slice(0, -5)}.xls`
    : (name.toLowerCase().endsWith('.xls') ? name : `${name}.xls`);
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function pageFormatForJsPdf(pageSettings = {}) {
  const size = String(pageSettings.pageSize || 'A4').toUpperCase();
  const orientation = pageSettings.orientation === 'landscape' ? 'landscape' : 'portrait';
  const format = ['A3', 'A4', 'A5', 'LETTER', 'LEGAL'].includes(size) ? size : 'A4';
  return { orientation, format: format.toLowerCase() === 'letter' ? 'letter' : format };
}

/**
 * Download filled quotation as PDF in-place (no new tab).
 */
export async function downloadQuotationPdfViaChromium({
  report,
  customer,
  template,
  organization,
} = {}) {
  let html = buildFilledDocumentHtml({ report, customer, template, organization });
  if (!html) {
    const lines = resolveLineItems(report);
    const table = buildItemsTableHtml(lines);
    html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(report?.quotation_number || 'Report')}</title>
<style>
  body { font-family: Times New Roman, Arial, sans-serif; font-size: 12px; color: #0f172a; padding: 24px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; padding: 4px 6px; }
</style></head><body>
  <h2>${esc(report?.quotation_number || 'Report')}</h2>
  <p><strong>Customer:</strong> ${esc(customer?.name || '—')}</p>
  <p><strong>Total:</strong> ${fmtMoney(report?.total)}</p>
  ${table}
</body></html>`;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;';
  document.body.appendChild(iframe);

  try {
    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(html);
    idoc.close();

    await new Promise((resolve) => {
      const done = () => resolve();
      if (idoc.readyState === 'complete') setTimeout(done, 350);
      else iframe.onload = () => setTimeout(done, 350);
    });

    const { default: html2canvas } = await import('html2canvas');
    const { jsPDF } = await import('jspdf');
    const td = template?.template_data || {};
    const pageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      ...td,
      margins: td.margins || DEFAULT_PAGE_SETTINGS.margins,
    };
    const { orientation, format } = pageFormatForJsPdf(pageSettings);
    const canvas = await html2canvas(idoc.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      windowWidth: idoc.documentElement.scrollWidth,
      windowHeight: idoc.documentElement.scrollHeight,
    });

    const pdf = new jsPDF({ orientation, unit: 'pt', format });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.92);

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
      heightLeft -= pageH;
    }

    const filename = datedFilename(
      `quotation-${report?.quotation_number || 'report'}`,
      'pdf',
    );
    pdf.save(filename);
  } finally {
    iframe.remove();
  }
}
