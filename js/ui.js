/* ================================================================
   MODULE: UI Controller
   Purpose : DOM manipulation, state → view synchronisation.
   FIXES   : - updateCTA now shows a disabled loading state while
               S.availableTokens === null (not yet loaded from chain)
               when the user is connected on the correct network.
               This prevents users clicking Buy before stock data
               arrives, which would cause unnecessary failed txs.
             - [AUDIT v5.13] setCtaLoading(false) now also calls
               updateNetBadge() after updateCTA() — previously if
               the network changed during a tx, the badge could
               show a stale "Not connected" label after the tx
               completed because only updateCTA() was called.
   Depends : S, I18nCtrl (i18n.js), Utils (utils.js), WALLETS (wallets.js)
================================================================ */
const UI = {
  updateNetBadge() {
    const dot  = document.getElementById('netDot');
    const lbl  = document.getElementById('netLabel');
    const warn = document.getElementById('warnBanner');
    dot.className = 'net-dot';
    warn.classList.remove('show');

    if (!S.connected) {
      dot.classList.add('nd-idle');
      lbl.textContent = t('netIdle');
    } else if (S.correctNet) {
      dot.classList.add('nd-ok');
      lbl.textContent = t('netOk');
    } else {
      dot.classList.add('nd-err');
      lbl.textContent = t('netBad');
      const warnTxtEl = document.getElementById('warnTxt');
      if (warnTxtEl) warnTxtEl.textContent = t('warnTxt');
      warn.classList.add('show');
    }
  },

  updateCTA() {
    const btn = document.getElementById('ctaBtn');
    const txt = document.getElementById('ctaText');
    if (!btn || !txt) return;

    if (!S.connected) {
      btn.className   = 'cta-btn btn-connect';
      btn.disabled    = false;
      txt.textContent = t('ctaConnect');
      return;
    }
    if (!S.correctNet) {
      btn.className   = 'cta-btn btn-switch';
      btn.disabled    = false;
      txt.textContent = t('ctaSwitch');
      return;
    }
    if (S.availableTokens === null) {
      btn.className   = 'cta-btn btn-buy';
      btn.disabled    = true;
      txt.textContent = '…';
      return;
    }
    if (S.availableTokens === 0n) {
      btn.className   = 'cta-btn btn-no-stock';
      btn.disabled    = true;
      txt.textContent = t('ctaNoStock');
      return;
    }
    btn.className   = 'cta-btn btn-buy';
    btn.disabled    = false;
    txt.textContent = t('ctaBuy');
  },

  setCtaLoading(on, label) {
    const btn = document.getElementById('ctaBtn');
    const txt = document.getElementById('ctaText');
    btn.disabled = on;
    let spinner = btn.querySelector('.cta-spinner');
    if (on) {
      if (!spinner) {
        spinner = document.createElement('span');
        spinner.className = 'spin cta-spinner';
        btn.insertBefore(spinner, btn.firstChild);
      }
      if (txt) txt.textContent = label || t('connecting');
    } else {
      spinner?.remove();
      this.updateCTA();
      /* [AUDIT v5.13] Sync network badge after tx — prevents stale "Not connected"
         label if network state changed while the tx was in-flight. */
      this.updateNetBadge();
    }
  },

  updateWalletBadge() {
    const nr = document.getElementById('navRight');
    let b    = document.getElementById('walletBadge');
    if (S.connected && S.account) {
      if (!b) {
        b = document.createElement('div');
        b.id        = 'walletBadge';
        b.className = 'wallet-badge';
        const dot   = document.createElement('div');
        dot.className = 'wbadge-dot';
        const addr  = document.createElement('span');
        addr.id = 'walletAddrTxt';
        addr.textContent = Utils.shorten(S.account);
        b.appendChild(dot);
        b.appendChild(addr);
        nr.appendChild(b);
      } else {
        const addrEl = document.getElementById('walletAddrTxt');
        if (addrEl) addrEl.textContent = Utils.shorten(S.account);
      }
    } else {
      b?.remove();
    }
  },

  buildWalletList() {
    const list = document.getElementById('walletList');
    if (!list) return;
    list.innerHTML = '';
    WALLETS.forEach(w => {
      const ok  = w.detect();
      const div = document.createElement('div');
      div.className = 'wallet-opt' + (ok ? '' : ' na');

      const iconWrap = document.createElement('div');
      iconWrap.className = 'w-icon';
      iconWrap.style.background = w.bg;
      const img = document.createElement('img');
      img.src = w.icon; img.alt = w.name;
      img.onerror = () => { img.style.display = 'none'; };
      iconWrap.appendChild(img);

      const info = document.createElement('div');
      info.className = 'w-info';
      const nameEl = document.createElement('div');
      nameEl.className = 'w-name'; nameEl.textContent = w.name;
      const descEl = document.createElement('div');
      descEl.className = 'w-desc';
      descEl.textContent = S.lang === 'en' ? w.desc : w.descEs;
      info.appendChild(nameEl); info.appendChild(descEl);

      const tag = document.createElement('span');
      tag.className = 'w-tag ' + (ok ? 'tag-ok' : 'tag-get');
      tag.textContent = ok ? t('detected') : t('install');

      div.appendChild(iconWrap); div.appendChild(info); div.appendChild(tag);
      div.onclick = ok
        ? () => Wallet.connectWith(w)
        : () => window.open(w.url, '_blank', 'noopener noreferrer');

      list.appendChild(div);
    });
    const modalTitle = document.getElementById('modalTitle');
    const modalNote  = document.getElementById('modalNote');
    if (modalTitle) modalTitle.textContent = t('modalTitle');
    if (modalNote)  modalNote.textContent  = t('modalNote');
  },

  openModal()  { this.buildWalletList(); document.getElementById('walletModal').classList.add('open'); },
  closeModal() { document.getElementById('walletModal').classList.remove('open'); },
  onOverlayClick(e) { if (e.target.id === 'walletModal') this.closeModal(); }
};
