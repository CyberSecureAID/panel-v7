/* ============================================================
   MODULE: Admin Panel Controller
   Purpose : Panel open/close/minimize state, data loading,
             and all owner-only transaction functions.
   FIXES   : - [FIX H7] loadData() aplica .replace(/\.?0+$/, '')
               al valor USDT en AMBOS branches del ratio restore,
               eliminando trailing zeros que confundían al admin
               (ej: "1.000000" en lugar de "1").
   Depends : S, UI, Chain, Toast, Utils, ERC20_ABI, USDT_ADDR, CFG, ABI
================================================================ */
const AdminPanel = {
  _visible:   false,
  _minimized: false,
  _loading:   false,

  show() {
    const panel = document.getElementById('adminPanel');
    const fab   = document.getElementById('adminFab');
    panel.classList.add('visible');
    panel.classList.remove('minimized');
    fab.classList.add('panel-open');
    this._visible   = true;
    this._minimized = false;
    this._updateMinimizeIcon(false);
  },

  hide() {
    const panel = document.getElementById('adminPanel');
    const fab   = document.getElementById('adminFab');
    panel.classList.remove('visible', 'minimized');
    fab.classList.remove('panel-open');
    this._visible   = false;
    this._minimized = false;
  },

  close() { this.hide(); },

  toggle() {
    if (this._visible) this.hide();
    else { this.show(); this.loadData(); }
  },

  toggleMinimize() {
    const panel = document.getElementById('adminPanel');
    this._minimized = !this._minimized;
    panel.classList.toggle('minimized', this._minimized);
    this._updateMinimizeIcon(this._minimized);
  },

  _updateMinimizeIcon(isMin) {
    const btn = document.getElementById('adminMinimizeBtn');
    if (!btn) return;
    if (isMin) {
      btn.title = 'Expand';
      btn.setAttribute('aria-label', 'Expand panel');
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <polyline points="2,8 6,4 10,8"/>
        </svg>`;
    } else {
      btn.title = 'Minimize';
      btn.setAttribute('aria-label', 'Minimize panel');
      btn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <line x1="2" y1="6" x2="10" y2="6"/>
        </svg>`;
    }
  },

  _showSkeletons() {
    const ids = ['adminSupply', 'adminBNBBal', 'adminUSDTBal'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '<span class="admin-skeleton"></span>';
    });
  },

  _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  },

  async loadData() {
    if (this._loading) return;
    this._loading = true;

    this._showSkeletons();

    try {
      const c  = S.contract || S.readContract;
      const w3 = S.web3     || S.readWeb3;
      if (!c || !w3) return;

      try {
        const [tokRaw, bnbRaw] = await Promise.all([
          c.methods.getAvailableTokens().call(),
          w3.eth.getBalance(CFG.ADDR)
        ]);
        S.availableTokens = Utils.safeBigInt(tokRaw);
        UI.updateCTA();

        const tok    = (Number(tokRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
        const bnbBal = parseFloat(w3.utils.fromWei(String(bnbRaw), 'ether')).toFixed(6);
        this._set('adminSupply',  tok + ' USDT.z');
        this._set('adminBNBBal',  bnbBal + ' BNB');
      } catch (e) { console.warn('[MiSwap] adminLoadData tokens/BNB:', e.message); }

      try {
        const usdtC   = new w3.eth.Contract(ERC20_ABI, USDT_ADDR);
        const usdtRaw = await usdtC.methods.balanceOf(CFG.ADDR).call();
        const usdtBal = (Number(usdtRaw) / 1e18).toFixed(4);
        this._set('adminUSDTBal', usdtBal + ' USDT');
      } catch (e) { console.warn('[MiSwap] adminLoadData USDT:', e.message); }

      try {
        const [pBNB, pUSDT] = await Promise.all([
          c.methods.pricePerTokenBNB().call(),
          c.methods.pricePerTokenUSDT().call()
        ]);
        S.priceBNBWei  = Utils.safeBigInt(pBNB);
        S.priceUSDTWei = Utils.safeBigInt(pUSDT);

        if (S.priceUSDTWei > 0n) {
          const w3l = S.web3 || S.readWeb3;
          if (w3l) {
            const usdtPerToken = parseFloat(w3l.utils.fromWei(S.priceUSDTWei.toString(), 'ether'));
            const tokensEl = document.getElementById('inputRatioTokens');
            const usdtEl   = document.getElementById('inputRatioUSDT');

            if (tokensEl && usdtEl && usdtPerToken > 0) {
              if (usdtPerToken < 1) {
                const tokensPerUSDT = Math.round(1 / usdtPerToken);
                tokensEl.value = tokensPerUSDT;
                /* [FIX H7] strip trailing zeros en branch < 1 */
                usdtEl.value   = '1';
              } else {
                tokensEl.value = '1';
                /* [FIX H7] strip trailing zeros en branch >= 1
                   (antes faltaba en este branch, mostrando ej: "1.000000") */
                usdtEl.value   = usdtPerToken.toFixed(6).replace(/\.?0+$/, '');
              }
            }
          }
        }
        this.onRatioChange();
      } catch (e) { console.warn('[MiSwap] adminLoadData prices:', e.message); }

    } finally {
      this._loading = false;
    }
  },

  _computeWeiStrings(usdtPerToken) {
    const rate = (S.bnbUSD && S.bnbUSD > 0) ? S.bnbUSD : CFG.BNB_USD_FALLBACK;
    const bnbPerToken = usdtPerToken / rate;

    const usdtWei = Utils.toWei18(usdtPerToken);
    const bnbWei  = Utils.toWei18(bnbPerToken);

    return { usdtWei, bnbWei, bnbPerToken, rate };
  },

  onRatioChange() {
    const tokensRaw = document.getElementById('inputRatioTokens')?.value;
    const usdtRaw   = document.getElementById('inputRatioUSDT')?.value;
    const tokens = parseFloat(tokensRaw);
    const usdt   = parseFloat(usdtRaw);

    if (!isFinite(tokens) || tokens <= 0 || !isFinite(usdt) || usdt <= 0) {
      this._set('bnbEquivValue', '—');
      this._set('weiUSDTValue',  '—');
      this._set('weiBNBValue',   '—');
      return;
    }

    const usdtPerToken = usdt / tokens;
    const { usdtWei, bnbWei, bnbPerToken, rate } = this._computeWeiStrings(usdtPerToken);

    this._set('bnbEquivValue', bnbPerToken.toFixed(8) + ' BNB');
    this._set('weiUSDTValue',  usdtWei);
    this._set('weiBNBValue',   bnbWei);

    const rateEl = document.getElementById('bnbRateNote');
    if (rateEl) rateEl.textContent = `@ $${rate.toLocaleString()} / BNB`;
  },

  _btnLoading(btnId, textId) {
    const btn = document.getElementById(btnId);
    const txt = document.getElementById(textId);
    if (!btn) return () => {};
    const origTxt = txt ? txt.textContent : '';
    btn.disabled  = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;"></span><span>${t('confirming')}</span>`;
    return () => {
      btn.disabled  = false;
      btn.innerHTML = '';
      const span = document.createElement('span');
      span.id = textId;
      span.textContent = origTxt;
      btn.appendChild(span);
    };
  },

  _guard() {
    if (!S.isOwner || !S.contract) { Toast.show('Unauthorized.', 'e'); return false; }
    if (!S.account) { Toast.show(t('ctaConnect'), 'e'); return false; }
    return true;
  },

  async setPrice() {
    if (!this._guard()) return;
    const tokens = parseFloat(document.getElementById('inputRatioTokens')?.value);
    const usdt   = parseFloat(document.getElementById('inputRatioUSDT')?.value);
    if (!isFinite(tokens) || tokens <= 0 || !isFinite(usdt) || usdt <= 0) {
      Toast.show('Enter valid Tokens and USDT values.', 'e'); return;
    }

    const usdtPerToken = usdt / tokens;

    if (usdtPerToken < 0.000001) {
      Toast.show('Price too low (< 0.000001 USDT/token). Check values.', 'e');
      return;
    }
    if (usdtPerToken > 100_000) {
      Toast.show('Price too high (> 100,000 USDT/token). Check values.', 'e');
      return;
    }

    const { usdtWei, bnbWei } = this._computeWeiStrings(usdtPerToken);

    if (usdtWei === '0' || bnbWei === '0') {
      Toast.show('Price calculation error. Check values.', 'e');
      return;
    }

    const restore = this._btnLoading('btnSetPrice', 'btnSetPriceText');
    try {
      await S.contract.methods.setPrice(bnbWei, usdtWei).send({ from: S.account });
      Toast.show('Price updated on-chain!', 's');
      await Chain.fetchContractPrice();
      await this.loadData();
    } catch (e) {
      if (e.code === 4001) Toast.show(t('txRejected'), 'e');
      else Toast.show('setPrice failed: ' + (e.message?.split('\n')[0] || e), 'e', 7000);
    } finally { restore(); }
  },

  async withdrawTokens() {
    if (!this._guard()) return;
    const restore = this._btnLoading('btnWithdrawTokens', 'btnWithdrawText');
    try {
      await S.contract.methods.withdrawRemainingTokens().send({ from: S.account });
      Toast.show('Tokens withdrawn to owner wallet!', 's');
      await this.loadData();
    } catch (e) {
      if (e.code === 4001) Toast.show(t('txRejected'), 'e');
      else Toast.show('withdraw failed: ' + (e.message?.split('\n')[0] || e), 'e', 7000);
    } finally { restore(); }
  },

  async rescueBNB() {
    if (!this._guard()) return;
    const restore = this._btnLoading('btnRescueBNB', 'btnRescueBNBText');
    try {
      await S.contract.methods.rescueBNB().send({ from: S.account });
      Toast.show('BNB rescued to owner wallet!', 's');
      await this.loadData();
    } catch (e) {
      if (e.code === 4001) Toast.show(t('txRejected'), 'e');
      else Toast.show('rescueBNB failed: ' + (e.message?.split('\n')[0] || e), 'e', 7000);
    } finally { restore(); }
  },

  async rescueUSDT() {
    if (!this._guard()) return;
    const restore = this._btnLoading('btnRescueUSDT', 'btnRescueUSDTText');
    try {
      await S.contract.methods.rescueUSDT().send({ from: S.account });
      Toast.show('USDT rescued to owner wallet!', 's');
      await this.loadData();
    } catch (e) {
      if (e.code === 4001) Toast.show(t('txRejected'), 'e');
      else Toast.show('rescueUSDT failed: ' + (e.message?.split('\n')[0] || e), 'e', 7000);
    } finally { restore(); }
  }
};
