import dayjs from 'dayjs';
import { DEFAULT_PAGE_SETTINGS, pagePixelSize } from './reportPlaceholders.js';
import { datedFilename, downloadReportExcel } from './spreadsheet.js';

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

function buildItemsTableHtml(items = []) {
  const rows = items.map((item) => {
    const qty = `${item.quantity} ${item.unit || ''}`.trim();
    const nameStyle = item.isSub ? 'padding-left:16px;' : '';
    return `<tr>
      <td style="border:1px solid #64748b;padding:6px 8px;text-align:center">${item.slNo}</td>
      <td style="border:1px solid #64748b;padding:6px 8px;${nameStyle}">${esc(item.activityName)}</td>
      <td style="border:1px solid #64748b;padding:6px 8px">${esc(item.description)}</td>
      <td style="border:1px solid #64748b;padding:6px 8px;text-align:center">${esc(qty)}</td>
      <td style="border:1px solid #64748b;padding:6px 8px;text-align:right">${fmtMoney(item.unit_price)}</td>
      <td style="border:1px solid #64748b;padding:6px 8px;text-align:right">${fmtMoney(item.total)}</td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:inherit">
    <thead>
      <tr style="background:#f1f5f9">
        <th style="border:1px solid #64748b;padding:6px 8px;text-align:center;width:48px">Sl No</th>
        <th style="border:1px solid #64748b;padding:6px 8px;text-align:left">Activity Name</th>
        <th style="border:1px solid #64748b;padding:6px 8px;text-align:left">Description</th>
        <th style="border:1px solid #64748b;padding:6px 8px">Qty</th>
        <th style="border:1px solid #64748b;padding:6px 8px;text-align:right">Rate</th>
        <th style="border:1px solid #64748b;padding:6px 8px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="6" style="border:1px solid #64748b;padding:8px">No items</td></tr>'}
    </tbody>
  </table>`;
}

function fillPlaceholders(html, map) {
  if (!html) return '';
  return String(html).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const v = map[key];
      return v == null ? '' : String(v);
    }
    return '';
  });
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
    items_table: buildItemsTableHtml(lineItems),
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
  td, th { border: 1px solid #cbd5e1; padding: 4px 6px; vertical-align: top; }
  th { background: #f1f5f9; }
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

export function downloadQuotationExcel(report, {
  organizationName = 'Organization',
  filename,
} = {}) {
  const name = filename || datedFilename(
    `quotation-${report?.quotation_number || 'report'}`,
    'xls',
  );
  downloadReportExcel(quotationExcelRows(report), name, {
    organizationName,
    title: `Quotation ${report?.quotation_number || ''}`.trim(),
  });
}

/**
 * Open the filled template in a Chromium print window so the user can Save as PDF.
 * Matches the designed layout (not a flat data table).
 */
export function downloadQuotationPdfViaChromium({
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
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body>
  <h2>${esc(report?.quotation_number || 'Report')}</h2>
  <p><strong>Customer:</strong> ${esc(customer?.name || '—')}</p>
  <p><strong>Total:</strong> ${fmtMoney(report?.total)}</p>
  ${table}
</body></html>`;
  }

  const w = window.open('', '_blank');
  if (!w) {
    throw new Error('Allow pop-ups to download PDF');
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = report?.quotation_number || 'Report';
  setTimeout(() => {
    w.focus();
    w.print();
  }, 400);
}
