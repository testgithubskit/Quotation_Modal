export const TEMPLATE_SNAPSHOT_KEY = '_template_snapshot';

/** Use frozen template layout stored on the quotation when rendering PDFs/previews. */
export function templateForQuotation(quotation, liveTemplate) {
  const snap = quotation?.custom_data?.[TEMPLATE_SNAPSHOT_KEY];
  if (snap?.template_data) {
    return {
      id: liveTemplate?.id,
      name: snap.name || liveTemplate?.name || 'Report template',
      template_data: snap.template_data,
      custom_data: snap.custom_data || {},
    };
  }
  return liveTemplate;
}
