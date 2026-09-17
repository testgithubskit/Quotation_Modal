import { api } from '../../../config/auth.js';

const FALLBACK_FONTS = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Georgia',
  'Tahoma',
  'Inter',
  'Source Serif 4',
];

function parsePageSettings(description, templateData = {}) {
  if (templateData.pageSettings && typeof templateData.pageSettings === 'object') {
    return templateData.pageSettings;
  }
  if (description && String(description).trim().startsWith('{')) {
    try {
      return JSON.parse(description);
    } catch {
      return null;
    }
  }
  return null;
}

export function toDesignerTemplate(t) {
  if (!t) return null;
  const data = t.template_data || {};
  const pageSettings = parsePageSettings(t.description, data);
  return {
    id: t.id,
    name: t.name,
    description: pageSettings ? JSON.stringify(pageSettings) : (t.description || null),
    header_html: data.headerHtml || data.header_html || '',
    footer_html: data.footerHtml || data.footer_html || '',
    is_default: Boolean(t.is_default),
    created_at: t.created_at,
    updated_at: t.updated_at,
    template_data: data,
  };
}

function buildTemplateData(existingData, payload) {
  const next = { ...(existingData || {}) };
  if (payload.header_html !== undefined) next.headerHtml = payload.header_html || '';
  if (payload.footer_html !== undefined) next.footerHtml = payload.footer_html || '';
  if (payload.description !== undefined) {
    const parsed = parsePageSettings(payload.description, {});
    if (parsed) next.pageSettings = parsed;
  }
  if (next.primaryColor == null) next.primaryColor = '#16324F';
  if (next.headerText == null) next.headerText = 'QUOTATION REPORT';
  if (next.footerText == null) next.footerText = '';
  if (next.showLogo == null) next.showLogo = true;
  if (next.companyName == null) next.companyName = '';
  if (next.companyAddress == null) next.companyAddress = '';
  if (next.logo === undefined) next.logo = null;
  return next;
}

export async function getReportTemplates() {
  const data = await api.get('/quotation-templates', {
    params: { page: 1, page_size: 100, sort_by: 'updated_at', sort_order: 'desc' },
  }).then((r) => r.data);
  return (data.items || []).map(toDesignerTemplate);
}

export async function getReportTemplate(id) {
  const t = await api.get(`/quotation-templates/${id}`).then((r) => r.data);
  return toDesignerTemplate(t);
}

export async function createReportTemplate(payload) {
  const body = {
    name: payload.name,
    description: payload.description || null,
    is_default: Boolean(payload.is_default),
    is_standard: false,
    template_data: buildTemplateData({}, payload),
    custom_data: {},
  };
  const created = await api.post('/quotation-templates', body).then((r) => r.data);
  return toDesignerTemplate(created);
}

export async function updateReportTemplate(id, payload) {
  const existing = await api.get(`/quotation-templates/${id}`).then((r) => r.data);
  const body = {
    name: payload.name ?? existing.name,
    description: payload.description !== undefined ? payload.description : existing.description,
    is_default: payload.is_default !== undefined ? Boolean(payload.is_default) : existing.is_default,
    is_standard: existing.is_standard,
    template_data: buildTemplateData(existing.template_data || {}, payload),
    custom_data: existing.custom_data || {},
  };
  const updated = await api.put(`/quotation-templates/${id}`, body).then((r) => r.data);
  return toDesignerTemplate(updated);
}

export async function deleteReportTemplate(id) {
  await api.delete(`/quotation-templates/${id}`);
}

export async function getAvailableFonts() {
  return FALLBACK_FONTS;
}
