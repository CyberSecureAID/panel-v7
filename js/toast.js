/* ================================================================
   MODULE: Toast Notifications
   Depends : CSS → assets/css/toasts.css
             HTML → #toast-wrap in index.html
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
  }
};
