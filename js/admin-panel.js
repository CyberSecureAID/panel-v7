/* ============================================================
   MODULE: Admin Panel Controller
   Purpose : Panel open/close/minimize state, data loading,
             and all owner-only transaction functions.
   ADDITIONS: - fundContract() — nueva función para depositar
                USDT.z desde la wallet owner al contrato de venta.
              - loadFundBalances() — carga el balance de USDT.z
                en la wallet owner y el disponible en contrato.
              - onFundAmountChange() — actualiza el preview del
                monto a depositar en tiempo real.
              - setFundMax() — rellena el campo con el balance
                máximo disponible en la wallet owner.
   FIXES   : - [FIX H7] loadData() aplica .replace(/\.?0+$/, '')
               al valor USDT en AMBOS branches del ratio restore.
   Depends : S, UI, Chain, Toast, Utils, ERC20_ABI, USDT_ADDR, CFG, ABI
================================================================ */

/* USDT.z token address (sale token) — leída del contrato en loadData()
   pero también cacheada aquí para el flujo de fondeo */
let _saleTokenAddr = null;

const AdminPanel = {
  _visible:   false,
  _minimized: false,
  _loading:   false,

  /* Cached owner wallet balance of USDT.z (BigInt wei) */
  _ownerSaleTokenBal: 0n,

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

      /* Obtener dirección del token de venta si aún no la tenemos */
      if (!_saleTokenAddr) {
        try {
          _saleTokenAddr = await c.methods.SALE_TOKEN().call();
        } catch (e) {
          console.warn('[MiSwap] SALE_TOKEN read failed:', e.message);
        }
      }

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
                usdtEl.value   = '1';
              } else {
                tokensEl.value = '1';
                usdtEl.value   = usdtPerToken.toFixed(6).replace(/\.?0+$/, '');
              }
            }
          }
        }
        this.onRatioChange();
      } catch (e) { console.warn('[MiSwap] adminLoadData prices:', e.message); }

      /* Cargar balances para la sección de fondeo */
      await this.loadFundBalances();

    } finally {
      this._loading = false;
    }
  },

  /* ── Fund Contract: load balances ── */
  async loadFundBalances() {
    if (!S.account) return;
    const w3 = S.web3 || S.readWeb3;
    if (!w3 || !_saleTokenAddr) return;

    try {
      const tokenC = new w3.eth.Contract(ERC20_ABI, _saleTokenAddr);
      const [ownerRaw, contractRaw] = await Promise.all([
        tokenC.methods.balanceOf(S.account).call(),
        tokenC.methods.balanceOf(CFG.ADDR).call()
      ]);

      this._ownerSaleTokenBal = Utils.safeBigInt(ownerRaw);

      const ownerAmt    = (Number(ownerRaw)    / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });
      const contractAmt = (Number(contractRaw) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 2 });

      this._set('adminFundWalletBal',   ownerAmt    + ' USDT.z');
      this._set('adminFundContractBal', contractAmt + ' USDT.z');
    } catch (e) {
      console.warn('[MiSwap] loadFundBalances:', e.message);
      this._set('adminFundWalletBal',   'Error');
      this._set('adminFundContractBal', 'Error');
    }
  },

  /* ── Fund Contract: amount input change ── */
  onFundAmountChange() {
    const raw     = document.getElementById('inputFundAmount')?.value;
    const amount  = parseFloat(raw);
    const preview = document.getElementById('adminFundPreview');
    const preAmt  = document.getElementById('adminFundPreviewAmt');

    if (!isFinite(amount) || amount <= 0) {
      if (preview) preview.style.display = 'none';
      return;
    }

    if (preview) preview.style.display = 'flex';
    if (preAmt)  preAmt.textContent = amount.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' USDT.z';

    /* Warn if exceeds balance */
    const w3 = S.web3 || S.readWeb3;
    if (w3 && this._ownerSaleTokenBal > 0n) {
      const amountWei = Utils.toWei18(amount);
      const amountBN  = Utils.safeBigInt(amountWei);
      const sub       = document.getElementById('adminFundPreviewSub');
      if (sub) {
        if (amountBN > this._ownerSaleTokenBal) {
          sub.textContent = '⚠️ Exceeds wallet balance';
          sub.style.color = 'var(--red)';
        } else {
          sub.textContent = 'USDT.z → Sale Contract';
          sub.style.color = '';
        }
      }
    }
  },

  /* ── Fund Contract: set MAX ── */
  setFundMax() {
    if (this._ownerSaleTokenBal === 0n) {
      Toast.show('No USDT.z balance in your wallet.', 'i');
      return;
    }
    const w3 = S.web3 || S.readWeb3;
    if (!w3) return;
    const maxFloat = parseFloat(w3.utils.fromWei(this._ownerSaleTokenBal.toString(), 'ether'));
    const input = document.getElementById('inputFundAmount');
    if (input) {
      input.value = Math.floor(maxFloat);
      this.onFundAmountChange();
    }
  },

  /* ── Fund Contract: execute deposit ── */
  async fundContract() {
    if (!this._guard()) return;

    if (!_saleTokenAddr) {
      Toast.show('Sale token address not loaded. Please wait and retry.', 'e');
      return;
    }

    const raw    = document.getElementById('inputFundAmount')?.value;
    const amount = parseFloat(raw);

    if (!isFinite(amount) || amount <= 0) {
      Toast.show('Enter a valid amount to deposit.', 'e');
      return;
    }

    if (!Number.isInteger(amount) && Math.floor(amount) <= 0) {
      Toast.show('Amount must be a positive number.', 'e');
      return;
    }

    const depositAmount = Math.floor(amount);
    const amountWei     = Utils.toWei18(depositAmount);
    const amountBN      = Utils.safeBigInt(amountWei);

    if (amountBN === 0n) {
      Toast.show('Amount calculation error.', 'e');
      return;
    }

    if (amountBN > this._ownerSaleTokenBal) {
      Toast.show('Insufficient USDT.z balance in your wallet.', 'e');
      return;
    }

    const restore = this._btnLoading('btnFundContract', 'btnFundContractText');
    const w3 = S.web3;

    try {
      const tokenC = new w3.eth.Contract(ERC20_ABI, _saleTokenAddr);

      /* Check allowance */
      const allowanceBN = Utils.safeBigInt(
        await tokenC.methods.allowance(S.account, CFG.ADDR).call()
      );

      /* Reset + re-approve pattern if allowance is non-zero but insufficient */
      if (allowanceBN > 0n && allowanceBN < amountBN) {
        const restoreInner = this._btnLoading('btnFundContract', 'btnFundContractText');
        const btn = document.getElementById('btnFundContract');
        if (btn) btn.innerHTML = '<span class="spin" style="width:14px;height:14px;"></span><span>Resetting allowance…</span>';
        await tokenC.methods.approve(CFG.ADDR, '0').send({ from: S.account });
        restoreInner();
      }

      /* Approve if needed */
      if (allowanceBN < amountBN) {
        const btn = document.getElementById('btnFundContract');
        if (btn) btn.innerHTML = '<span class="spin" style="width:14px;height:14px;"></span><span>Approving…</span>';
        await tokenC.methods.approve(CFG.ADDR, amountWei).send({ from: S.account });
      }

      /* Execute transfer using ERC20 transfer to contract */
      const btn2 = document.getElementById('btnFundContract');
      if (btn2) btn2.innerHTML = '<span class="spin" style="width:14px;height:14px;"></span><span>Depositing…</span>';

      /* Use transferFrom approach: owner approves, then we call transfer directly */
      await tokenC.methods.transfer(CFG.ADDR, amountWei).send({ from: S.account });

      Toast.show(`✅ Deposited ${depositAmount.toLocaleString()} USDT.z to contract!`, 's', 6000);

      /* Clear input & refresh */
      const input = document.getElementById('inputFundAmount');
      if (input) input.value = '';
      const preview = document.getElementById('adminFundPreview');
      if (preview) preview.style.display = 'none';

      await this.loadData();

    } catch (e) {
      if (e.code === 4001) Toast.show(t('txRejected'), 'e');
      else Toast.show('Deposit failed: ' + (e.message?.split('\n')[0] || e), 'e', 7000);
    } finally {
      restore();
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
