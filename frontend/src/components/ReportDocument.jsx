import { Fragment, useRef } from 'react';
import { Upload, Typography } from 'antd';
import { PictureOutlined } from '@ant-design/icons';

import { fieldLabelFromKey } from '../utils/fieldSchema';
import { defaultReportTemplate } from '../utils/reportTemplate';
import { applyTemplatePlaceholders, templateHasRichLayout } from '../utils/templatePlaceholders';
import { normalizeIncluded, visibleColumns } from '../utils/reportBodyConfig';

const currency = (v) => `₹${Number(v || 0).toLocaleString('en-IN')}`;

function isAutoQuotationNumber(value) {
  return /^QT-\d{4}-\d+$/i.test(String(value || '').trim());
}

/** Prefer user-entered report no; never show duplicate from customHeader. */
export function resolveReportNo(report) {
  if (!report) return '—';
  const candidates = [
    report.customHeader?.reportNo,
    report.reportNo,
  ].filter((v) => v != null && String(v).trim() !== '');
  const manual = candidates.find((v) => !isAutoQuotationNumber(v));
  return String(manual || candidates[0] || '—');
}

function headerEntries(report) {
  const entries = [];
  if (report.customHeader && Object.keys(report.customHeader).length > 0) {
    Object.entries(report.customHeader).forEach(([key, val]) => {
      if (key === 'reportNo' || key === 'date') return;
      if (val != null && val !== '') entries.push({ key, label: fieldLabelFromKey(key), val });
    });
  } else {
    if (report.centre || report.center) entries.push({ key: 'centre', label: 'Centre', val: report.centre || report.center });
    if (report.lab) entries.push({ key: 'lab', label: 'Lab', val: report.lab });
    if (report.enquiryNo) entries.push({ key: 'enquiryNo', label: 'Enquiry No.', val: report.enquiryNo });
  }
  return entries;
}

function Editable({ editable, value, onChange, style, placeholder }) {
  const ref = useRef(null);
  if (!editable) {
    return <span style={style}>{value || placeholder}</span>;
  }
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onChange(e.currentTarget.textContent)}
      style={{
        ...style,
        outline: 'none',
        borderBottom: '1px dashed transparent',
        cursor: 'text',
      }}
      onFocus={(e) => { e.currentTarget.style.borderBottom = '1px dashed #B8863A'; }}
      className="editable-field"
    >
      {value || placeholder}
    </span>
  );
}

function BodyEditable({ editable, value, onChange, align }) {
  if (!editable) {
    return <span style={{ textAlign: align }}>{value}</span>;
  }
  return (
    <span
      contentEditable
      suppressContentEditableWarning
      className="report-body-editable"
      onBlur={(e) => onChange(e.currentTarget.textContent)}
    >
      {value ?? ''}
    </span>
  );
}

function customerNameOnly(c) {
  if (!c) return '—';
  if (c.name) return c.name;
  if (c.details) return c.details.split('\n')[0] || '—';
  return '—';
}

function customerCompany(c) {
  if (!c) return '';
  if (c.company) return c.company;
  const lines = String(c.details || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length >= 2) return lines[1];
  return '';
}

function cellRaw(activity, colKey, slLabel) {
  const rate = Number(activity.unitRate ?? activity.cost ?? 0);
  const qty = Number(activity.qty || 1);
  switch (colKey) {
    case 'slNo':
      return slLabel;
    case 'sampleActivity':
      return activity.sampleActivity || activity.code || '';
    case 'description':
      return activity.description || activity.particulars || '';
    case 'specification':
      return activity.specification || '';
    case 'qty':
      return String(activity.qty ?? 1);
    case 'unit':
      return activity.unit || '';
    case 'unitRate':
      return String(rate);
    case 'total':
      return currency(rate * qty);
    default:
      return activity.customFields?.[colKey] ?? activity[colKey] ?? '';
  }
}

function cellDisplay(activity, colKey, slLabel) {
  if (colKey === 'unitRate') {
    return currency(Number(activity.unitRate ?? activity.cost ?? 0));
  }
  if (colKey === 'total') {
    const rate = Number(activity.unitRate ?? activity.cost ?? 0);
    return currency(rate * Number(activity.qty || 1));
  }
  if (colKey === 'unit') {
    return activity.unit || '—';
  }
  const raw = cellRaw(activity, colKey, slLabel);
  return raw === '' ? '—' : raw;
}

function patchActivityField(activity, colKey, text) {
  const next = { ...activity };
  switch (colKey) {
    case 'sampleActivity':
      next.sampleActivity = text;
      break;
    case 'description':
      next.description = text;
      next.particulars = text;
      break;
    case 'specification':
      next.specification = text;
      break;
    case 'qty': {
      const n = Number(String(text).replace(/[^\d.-]/g, ''));
      next.qty = Number.isFinite(n) && n > 0 ? n : 1;
      break;
    }
    case 'unit':
      next.unit = text || 'Nos';
      break;
    case 'unitRate': {
      const n = Number(String(text).replace(/[^\d.-]/g, ''));
      next.unitRate = Number.isFinite(n) ? n : 0;
      next.cost = next.unitRate;
      break;
    }
    default:
      next.customFields = { ...(next.customFields || {}), [colKey]: text };
      break;
  }
  return next;
}

export default function ReportDocument({
  report,
  template,
  editable = false,
  editableBody = false,
  bodyConfig,
  onTemplateChange,
  onBodyChange,
}) {
  if (!report) return null;

  const t = template || defaultReportTemplate();
  const patch = (field) => (val) => onTemplateChange && onTemplateChange({ [field]: val });
  const included = normalizeIncluded(bodyConfig?.included);
  const columns = visibleColumns(bodyConfig?.columns);

  const activities = report.activities || [];
  const grandTotal = activities.reduce((sum, a) => {
    const rate = Number(a.unitRate ?? a.cost ?? 0);
    const subTotal = (a.subActivities || []).reduce(
      (s, sa) => s + Number(sa.unitRate ?? sa.cost ?? 0) * Number(sa.qty || 1),
      0,
    );
    return sum + rate * Number(a.qty || 1) + subTotal;
  }, 0);

  const headerAlign = t.align || 'left';
  const c = report.customer || {};
  const terms = report.terms || {};
  const notes = report.activityNotes || [];
  const metaFields = headerEntries(report);
  const company = customerCompany(c);
  const rich = templateHasRichLayout(t);
  const headerHtml = rich
    ? applyTemplatePlaceholders(t.headerHtml, report, t)
    : '';
  const footerHtml = rich
    ? applyTemplatePlaceholders(t.footerHtml, report, t)
    : '';

  const updateRow = (path, colKey, text) => {
    if (!onBodyChange) return;
    const next = activities.map((a) => {
      if (path.parentKey == null && a.key === path.key) {
        return patchActivityField(a, colKey, text);
      }
      if (path.parentKey != null && a.key === path.parentKey) {
        return {
          ...a,
          subActivities: (a.subActivities || []).map((sa) => (
            sa.key === path.key ? patchActivityField(sa, colKey, text) : sa
          )),
        };
      }
      return a;
    });
    onBodyChange(next);
  };

  const renderCells = (activity, slLabel, path) => columns.map((col) => {
    const locked = col.locked || col.key === 'slNo' || col.key === 'total';
    const canEdit = editableBody && !locked;
    const align = ['qty', 'unitRate', 'total'].includes(col.key) ? 'right' : undefined;
    return (
      <td key={col.key} style={{ textAlign: align }}>
        {canEdit ? (
          <BodyEditable
            editable
            value={cellRaw(activity, col.key, slLabel)}
            onChange={(text) => updateRow(path, col.key, text)}
          />
        ) : (
          cellDisplay(activity, col.key, slLabel)
        )}
      </td>
    );
  });

  const totalColSpan = Math.max(columns.length - 1, 1);

  return (
    <div className="report-page" style={{ fontFamily: t.fontFamily || 'Inter, sans-serif' }}>
      {rich ? (
        <div
          className="template-editor-content report-rich-header"
          style={{ marginBottom: 20 }}
          dangerouslySetInnerHTML={{ __html: headerHtml }}
        />
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `2px solid ${t.primaryColor}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ textAlign: headerAlign, flex: 1 }}>
              <Editable
                editable={editable}
                value={t.companyName}
                placeholder="Company Name"
                onChange={patch('companyName')}
                style={{ display: 'block', fontFamily: "'Source Serif 4', serif", fontSize: 22, fontWeight: 700, color: t.primaryColor }}
              />
              <Editable
                editable={editable}
                value={t.companyAddress}
                placeholder="Company address"
                onChange={patch('companyAddress')}
                style={{ display: 'block', fontSize: 12.5, color: '#5B6169', marginTop: 4 }}
              />
            </div>
            {t.showLogo !== false && (
              editable ? (
                <Upload
                  showUploadList={false}
                  accept="image/*"
                  beforeUpload={(file) => {
                    const reader = new FileReader();
                    reader.onload = (e) => onTemplateChange({ logo: e.target.result });
                    reader.readAsDataURL(file);
                    return false;
                  }}
                >
                  <div style={{
                    width: 84, height: 84, border: '1px dashed #C9C3B4', borderRadius: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    background: t.logo ? `url(${t.logo}) center/contain no-repeat` : '#FAF9F6', marginLeft: 16,
                  }}>
                    {!t.logo && <PictureOutlined style={{ fontSize: 20, color: '#B0A98F' }} />}
                  </div>
                </Upload>
              ) : (
                t.logo ? (
                  <img src={t.logo} alt="logo" style={{ width: 84, height: 84, objectFit: 'contain', marginLeft: 16 }} />
                ) : null
              )
            )}
          </div>

          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <Editable
              editable={editable}
              value={t.headerText}
              placeholder="QUOTATION REPORT"
              onChange={patch('headerText')}
              style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.04em', color: '#1C1E22' }}
            />
          </div>
        </>
      )}

      <table className="report-table" style={{ marginBottom: 16 }}>
        <tbody>
          <tr>
            <th style={{ width: '18%' }}>Report No.</th>
            <td style={{ width: '32%' }}>{resolveReportNo(report)}</td>
            <th style={{ width: '18%' }}>Date</th>
            <td style={{ width: '32%' }}>{report.date || report.customHeader?.date || '—'}</td>
          </tr>
          {metaFields.reduce((rows, field, i, arr) => {
            if (i % 2 === 0) {
              const next = arr[i + 1];
              rows.push(
                <tr key={field.key}>
                  <th>{field.label}</th>
                  <td>{field.val}</td>
                  {next ? (
                    <>
                      <th>{next.label}</th>
                      <td>{next.val}</td>
                    </>
                  ) : (
                    <td colSpan={2} />
                  )}
                </tr>,
              );
            }
            return rows;
          }, [])}
          {report.subject && (
            <tr>
              <th>Subject</th>
              <td colSpan={3}>{report.subject}</td>
            </tr>
          )}
          <tr>
            <th>Customer</th>
            <td colSpan={3}>{customerNameOnly(c)}</td>
          </tr>
          {company ? (
            <tr>
              <th>Company Name</th>
              <td colSpan={3}>{company}</td>
            </tr>
          ) : null}
          {included.showCustomerContact && (c.mobile || c.email) ? (
            <tr>
              <th>Mobile / Email</th>
              <td colSpan={3}>
                {[c.mobile, c.email].filter(Boolean).join(' · ')}
              </td>
            </tr>
          ) : null}
          {c.customFields && Object.entries(c.customFields).map(([key, val]) => (
            <tr key={key}>
              <th>{fieldLabelFromKey(key)}</th>
              <td colSpan={3}>{val}</td>
            </tr>
          ))}
          {included.showCustomerAddress && c.address ? (
            <tr>
              <th>Address</th>
              <td colSpan={3}>{c.address}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <table className={`report-table${editableBody ? ' report-table--editable-body' : ''}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activities.map((a, i) => (
            <Fragment key={a.key || `a-${i}`}>
              <tr>
                {renderCells(a, String(i + 1), { key: a.key })}
              </tr>
              {(a.subActivities || []).map((sa, j) => (
                <tr className="sub-activity-row" key={sa.key || `sa-${i}-${j}`}>
                  {renderCells(sa, `${i + 1}.${j + 1}`, { key: sa.key, parentKey: a.key })}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr>
            <td colSpan={totalColSpan} style={{ textAlign: 'right', fontWeight: 600 }}>Grand Total</td>
            <td style={{ fontWeight: 700 }}>{currency(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      {included.showNotes && notes.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Activity Notes</Typography.Text>
          {notes.map((note, i) => (
            <div key={i} style={{ fontSize: 12.5, color: '#5B6169', marginBottom: 4 }}>
              {i + 1}. {typeof note === 'string' ? note : note?.value}
            </div>
          ))}
        </div>
      )}

      {included.showTerms && (terms.termsAndConditions || terms.customFields) ? (
        <div style={{ marginTop: 20 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Terms &amp; Conditions</Typography.Text>
          {terms.termsAndConditions && (
            <div style={{ fontSize: 12.5, color: '#5B6169', marginBottom: 8, whiteSpace: 'pre-line' }}>
              {terms.termsAndConditions}
            </div>
          )}
          {terms.customFields && Object.keys(terms.customFields).length > 0 && (
            <table className="report-table">
              <tbody>
                {Object.entries(terms.customFields).map(([key, val]) => (
                  <tr key={key}>
                    <th style={{ width: '25%' }}>{fieldLabelFromKey(key)}</th>
                    <td>{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {included.showTerms && !terms.termsAndConditions && !terms.customFields && (terms.payment || terms.deliveryPeriod) ? (
        <div style={{ marginTop: 20 }}>
          <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>Terms &amp; Conditions</Typography.Text>
          <table className="report-table">
            <tbody>
              {Object.entries(terms).filter(([, v]) => v).map(([key, val]) => (
                <tr key={key}>
                  <th style={{ width: '25%' }}>{fieldLabelFromKey(key)}</th>
                  <td>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div style={{ marginTop: 32, paddingTop: 12, borderTop: '1px solid #E4E0D8' }}>
        {rich ? (
          <div
            className="template-editor-content report-rich-footer"
            dangerouslySetInnerHTML={{ __html: footerHtml }}
          />
        ) : (
          <Editable
            editable={editable}
            value={t.footerText}
            placeholder="Footer note"
            onChange={patch('footerText')}
            style={{ fontSize: 11.5, color: '#8A8578', display: 'block', textAlign: 'center' }}
          />
        )}
      </div>
    </div>
  );
}
