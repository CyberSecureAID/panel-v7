/* ================================================================
   MODULE: Toast Notifications
   Depends : CSS → assets/css/toasts.css
             HTML → #toast-wrap in index.html
   FIXES   : - [FIX S1] Added showTx() — was referenced in app.js
               but missing from this module, causing a silent error
               after every successful purchase (success toast never
               appeared). Now shows hash + BscScan link.
================================================================ */
const Toast = {
  /**
   * Display a toast notification.
   * @param {string}          msg  — message text
   * @param {'s'|'e'|'i'}     type — success / error / info
   * @param {number}          [ms=4500] — auto-dismiss delay
   */
  show(msg, type = 'i', ms = 4500) {
    const icons = { s: '✅', e: '❌', i: 'ℹ️' };
    const el    = document.createElement('div');
    el.className = `toast ${type}`;

    /* textContent used for the icon to avoid XSS;
       msg is always sourced from i18n strings or truncated on-chain data */
    const ico = document.createElement('span');
    ico.className   = 't-ico';
    ico.textContent = icons[type] || 'ℹ️';

    const body = document.createElement('span');
    body.textContent = msg;

    el.appendChild(ico);
    el.appendChild(body);
    document.getElementById('toast-wrap').appendChild(el);

    setTimeout(() => {
      el.style.animation = 'tOut 0.25s ease forwards';
      setTimeout(() => el.remove(), 260);
    }, ms);
  },

  /**
   * [FIX S1] Display a transaction-confirmed toast with BscScan link.
   * Was referenced in app.js (_buyTokens success path) but never defined,
   * causing a silent ReferenceError after every successful purchase.
   * @param {string}          msg  — message text (e.g. t('txOk'))
   * @param {string}          hash — transaction hash (0x…)
   * @param {'s'|'e'|'i'}     [type='s'] — toast type
   * @param {number}          [ms=6000] — longer default so user can click link
   */
  showTx(msg, hash, type = 's', ms = 6000) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;

    const ico = document.createElement('span');
    ico.className   = 't-ico';
    ico.textContent = '✅';

    const body = document.createElement('span');

    /* Short hash display: 0x1234…abcd */
    const short = hash
      ? hash.slice(0, 10) + '…' + hash.slice(-6)
      : '';

    /* Safe link to BscScan — built with DOM (no innerHTML) */
    const textNode = document.createTextNode(msg + (short ? ' ' + short : '') + ' ');
    body.appendChild(textNode);

    if (hash) {
      const link = document.createElement('a');
      link.href             = 'https://bscscan.com/tx/' + hash;
      link.target           = '_blank';
      link.rel              = 'noopener noreferrer';
      link.textContent      = 'Ver en BscScan ↗';
      link.style.cssText    = 'color:var(--accent);font-size:11px;white-space:nowrap;';
      body.appendChild(link);
    }

    el.appendChild(ico);
    el.appendChild(body);
    document.getElementById('toast-wrap').appendChild(el);

    setTimeout(() => {
      el.style.animation = 'tOut 0.25s ease forwards';
      setTimeout(() => el.remove(), 260);
    }, ms);
  }
};
