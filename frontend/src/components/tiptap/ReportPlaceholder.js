import { Node } from '@tiptap/core';

/**
 * Visual placeholder chip (replaces raw {{token}} text in the designer).
 * Stored as <span data-placeholder="key" data-label="Label">Label</span>
 */
export const ReportPlaceholder = Node.create({
  name: 'reportPlaceholder',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      key: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-placeholder'),
        renderHTML: (attrs) => (attrs.key ? { 'data-placeholder': attrs.key } : {}),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-label') || el.textContent,
        renderHTML: (attrs) => (attrs.label ? { 'data-label': attrs.label } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-placeholder]' }];
  },

  renderHTML({ node }) {
    const label = node.attrs.label || node.attrs.key || 'field';
    return [
      'span',
      {
        'data-placeholder': node.attrs.key,
        'data-label': label,
        class: 'report-placeholder-chip',
        contenteditable: 'false',
      },
      label,
    ];
  },
});

/** Convert legacy {{token}} plain text in HTML into chip spans. */
export function hydratePlaceholderChips(html, placeholders = []) {
  if (!html) return html;
  return String(html).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const token = `{{${key}}}`;
    const ph = placeholders.find(
      (p) => p.token === token || p.token === key || String(p.token).replace(/[{}]/g, '') === key,
    );
    const label = ph?.label || key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const safeLabel = String(label)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
    return `<span data-placeholder="${key}" data-label="${safeLabel}" class="report-placeholder-chip">${safeLabel}</span>`;
  });
}
