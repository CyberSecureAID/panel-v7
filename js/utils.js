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
   SECURITY: - [SEC-5] fetchWithTimeout valida el origen de la URL
               contra CFG.ALLOWED_FETCH_ORIGINS antes de hacer fetch.
               Previene SSRF y fetches a dominios inyectados por XSS.
               CoinGecko está en la allowlist → favicon y logos siguen
               funcionando con normalidad.
             - [SEC-5b] validateRpcResponse() verifica estructura
               mínima de respuestas JSON-RPC para detectar respuestas
               maliciosas de RPCs comprometidos.
             - [SEC-9] validateImgUrl() verifica URLs de imágenes
               contra CFG.ALLOWED_IMG_ORIGINS antes de asignarlas
               al DOM, previniendo data: URIs o dominios arbitrarios.
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
   * [SEC-5] Validate that a URL's hostname is in the fetch allowlist.
   * Prevents fetches to arbitrary domains injected via XSS or prototype
   * pollution. CoinGecko and all BSC RPCs are in the allowlist.
   * @param {string} url
   * @returns {boolean}
   */
  _isFetchOriginAllowed(url) {
    try {
      const { hostname, protocol } = new URL(url);
      if (protocol !== 'https:') return false;
      return CFG.ALLOWED_FETCH_ORIGINS.some(
        allowed => hostname === allowed || hostname.endsWith('.' + allowed)
      );
    } catch {
      return false;
    }
  },

  /**
   * [SEC-9] Validate that an image URL's hostname is in the img allowlist.
   * Prevents data: URIs and arbitrary domains from being injected into img.src.
   * @param {string} url
   * @returns {boolean}
   */
  validateImgUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const { hostname, protocol } = new URL(url);
      if (protocol !== 'https:') return false;
      return CFG.ALLOWED_IMG_ORIGINS.some(
        allowed => hostname === allowed || hostname.endsWith('.' + allowed)
      );
    } catch {
      return false;
    }
  },

  /**
   * [SEC-5b] Minimal validation of a JSON-RPC response object.
   * A legitimate BSC RPC response always has an 'id' and either
   * 'result' or 'error'. Rejects responses missing both, which
   * could indicate a MITM/compromised RPC returning garbage.
   * Note: Web3.js handles its own RPC parsing internally; this
   * validator is only used for raw fetch() calls (e.g. price feeds).
   * @param {*} data
   * @returns {boolean}
   */
  validateJsonRpcResponse(data) {
    if (!data || typeof data !== 'object') return false;
    return 'result' in data || 'error' in data;
  },

  /**
   * [SEC-5] Timed fetch wrapper with origin validation.
   * Only allows fetches to domains in CFG.ALLOWED_FETCH_ORIGINS.
   * Validates Content-Type before parsing JSON.
   * @param {string} url
   * @param {number} [ms=8000] — timeout in milliseconds
   */
  async fetchWithTimeout(url, ms = 8000) {
    /* [SEC-5] Block fetches to non-allowlisted domains */
    if (!this._isFetchOriginAllowed(url)) {
      throw new Error(`[MiSwap] Fetch blocked: origin not in allowlist → ${url}`);
    }

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
