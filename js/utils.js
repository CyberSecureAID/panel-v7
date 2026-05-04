/* ================================================================
   MODULE: Utility Helpers
   FIXES   : - [AUDIT] fetchWithTimeout validates Content-Type
               before calling .json() — prevents unhandled
               SyntaxError when Cloudflare or CDN returns an HTML
               error page (503/504) instead of JSON.
             - [AUDIT v5.12] toWei18() extracted here as shared
               utility — previously duplicated in app.js and
               admin-panel.js, risking silent divergence if one
               copy was patched and the other was not.
================================================================ */
const Utils = {
  /** Shorten an Ethereum address: 0x1234…5678 */
  shorten(a) {
    if (!a) return '';
    return a.slice(0, 6) + '…' + a.slice(-4);
  },

  /**
   * Sanitize a numeric string input.
   * Returns a finite positive number or null.
   * Prevents XSS by rejecting anything that isn't a plain number.
   */
  sanitizeNum(raw) {
    const s = String(raw).trim();
    if (!/^-?\d*\.?\d*$/.test(s)) return null;
    const n = parseFloat(s);
    return isFinite(n) && n > 0 ? n : null;
  },

  /**
   * Safe BigInt conversion from a wei string.
   * Returns 0n on failure to prevent downstream NaN.
   */
  safeBigInt(raw) {
    try { return BigInt(raw); } catch { return 0n; }
  },

  /**
   * Convert a floating-point per-token price to an 18-decimal wei string.
   * Uses toFixed(18) → BigInt conversion to avoid float precision loss.
   * Shared between App._buyTokens() and AdminPanel.setPrice() to ensure
   * both always use identical conversion logic.
   * [AUDIT v5.12] Extracted from app.js/_bnbCostToWei and admin-panel.js/_toWei18
   * which were duplicate implementations of the same function.
   * @param {number} n — floating-point price (e.g. 0.0000034)
   * @returns {string} — wei amount as decimal string, '0' on invalid input
   */
  toWei18(n) {
    if (!isFinite(n) || n <= 0) return '0';
    const fixed = n.toFixed(18);
    const [intPart, decPart = ''] = fixed.split('.');
    const padded = (decPart + '0'.repeat(18)).slice(0, 18);
    const raw = BigInt(intPart) * (10n ** 18n) + BigInt(padded);
    return raw.toString();
  },

  /**
   * Timed fetch wrapper (replaces AbortSignal.timeout which is
   * not universally supported in iframes / older browsers).
   * [AUDIT] Validates Content-Type before parsing JSON to avoid
   * unhandled SyntaxError on HTML error responses (e.g. Cloudflare
   * 503 pages returned instead of API JSON).
   * @param {string} url
   * @param {number} [ms=8000] — timeout in milliseconds
   */
  async fetchWithTimeout(url, ms = 8000) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      /* [AUDIT] Reject non-JSON responses before attempting to parse */
      const ct = r.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        throw new Error('non-json response');
      }
      return await r.json();
    } finally {
      clearTimeout(id);
    }
  }
};
