/**
 * Print only the quotation document in a clean window
 * so the browser footer does not show the app URL / route.
 */
export function printReportElement(element, title = 'Quotation') {
  if (!element) {
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n');

  const markup = element.innerHTML;
  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1200');
  if (!win) {
    window.print();
    return;
  }

  win.document.open();
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${String(title).replace(/</g, '')}</title>
  ${styles}
  <style>
    @page { margin: 12mm; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
    }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-view-canvas, .print-root {
      background: #fff !important;
      padding: 0 !important;
      overflow: visible !important;
      height: auto !important;
    }
    .report-page {
      box-shadow: none !important;
      margin: 0 auto !important;
    }
  </style>
</head>
<body>
  <div class="print-root">${markup}</div>
</body>
</html>`);
  win.document.close();

  const trigger = () => {
    win.focus();
    win.print();
    win.close();
  };

  // Wait for styles/images to settle
  if (win.document.readyState === 'complete') {
    setTimeout(trigger, 250);
  } else {
    win.onload = () => setTimeout(trigger, 250);
  }
}
