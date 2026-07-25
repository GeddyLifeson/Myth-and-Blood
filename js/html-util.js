/**
 * Shared HTML escaping for innerHTML interpolation of user-controlled text.
 * Load before any module that builds markup from save labels, seeds or defs.
 */
const HtmlUtil = (() => {
  /** Escape text for both element content and quoted attribute values. */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { escapeHtml };
})();
