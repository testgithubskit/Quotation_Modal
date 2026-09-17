function downloadHtml(filename, html) {
  const blob = new Blob(
    [`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${filename}</title></head><body>${html}</body></html>`],
    { type: 'text/html' },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPdf({ name, headerHtml, footerHtml }) {
  downloadHtml(`${name || 'template'}.html`, `${headerHtml || ''}<hr/>${footerHtml || ''}`);
}

export async function exportToDocx(args) {
  return exportToPdf(args);
}

export async function exportToXlsx(args) {
  return exportToPdf(args);
}
