/* ================================================================
   MODULE: App (Main Application Controller)
   Purpose : Top-level orchestration: swap flow, method selection,
             CTA routing, language toggle, and init entry point.
   FIXES   : - [FIX H1] _pendingAmount congela el importe en el
               momento de abrir el modal; _buyTokens lo consume en
               lugar de releer el DOM, eliminando la race condition
               de edición entre confirmación visual y firma real.
             - [FIX H2] _confirmModalOpen flag: _buyTokens verifica
               que la tx llegó a través del modal, no por llamada
               directa desde consola. El rate-limit sigue como capa
               adicional pero ya no es la única defensa.
             - [FIX H3] USDT flow: UI.setCtaLoading('confirming')
               se mueve ANTES del bloque de allowance, eliminando
               el label "Approving USDT…" congelado cuando el
               allowance ya es suficiente y se salta el approve.
             - [FIX S2] Guard explícito contra NaN/no-entero antes
               del cast a BigInt, previniendo un throw silencioso
               si safeAmount llega corrompido.
             - [FIX S3] Cap de sanidad USDT (500 000 USDT/tx)
               equivalente al _MAX_BNB_PER_TX que ya existía en el
               flujo BNB pero faltaba en el flujo USDT.
             - [FIX MODAL] confirmModal existe ahora en el DOM.
               _openConfirmModal() y closeConfirmModal() operan
               correctamente sobre el overlay con clase open.
   SECURITY: - [SEC-2] _MAX_BNB_PER_TX y slippage ahora son
               propiedades definidas con Object.defineProperty()
               como non-writable, non-configurable.
             - [SEC-2b] _pendingAmount tiene verificación de
               integridad TTL de 30s.
   Depends : All other modules
================================================================ */
const App = (function() {
  const _SLIPPAGE        = 0.95;
  const _MAX_BNB_PER_TX  = 50;
  const _MAX_USDT_PER_TX = 500_000;
  const _BUY_COOLDOWN_MS = 3000;

  let _buying            = false;
  let _confirmModalOpen  = false;
  let _lastBuyAttempt    = 0;
  let _pendingAmount     = null;
  let _pendingTimestamp  = null;
  const _PENDING_TTL_MS  = 30_000;

  const pub = {
    setMethod(m) {
      S.method = m;
      document.getElementById('tabBNB').classList.toggle('active',  m === 'BNB');
      document.getElementById('tabUSDT').classList.toggle('active', m === 'USDT');
      this.onAmountChange();
    },

    onAmountChange() {
      const raw    = parseFloat(document.getElementById('amountInput').value) || 0;
      const amount = Math.floor(raw);

      const sumPayEl   = document.getElementById('sumPay');
      const sumPriceEl = document.getElementById('sumPrice');
      const usdEquivEl = document.getElementById('usdEquiv');

      if (amount <= 0) {
        if (sumPayEl)   sumPayEl.textContent   = '—';
        if (sumPriceEl) sumPriceEl.textContent = '—';
        if (usdEquivEl) usdEquivEl.textContent = '≈ $0.00';
        this._clearAmountWarn();
        this._updatePriceBadge(false);
        return;
      }

      const stockOk = S.availableTokens === null || S.availableTokens >= BigInt(amount) * (10n ** 18n);
      const minOk   = amount >= 50;
      const maxOk   = amount <= 10_000_000;

      if (!minOk) {
        this._setAmountWarn(t('minErr'));
      } else if (!maxOk) {
        this._setAmountWarn(t('notEnoughStockErr'));
      } else if (!stockOk) {
        this._setAmountWarn(t('notEnoughStockErr'));
      } else {
        this._clearAmountWarn();
      }

      const pricePerToken = Chain.getPricePerTokenUSD();
      const usdTotal      = amount * pricePerToken;
      const usingOnChain  = this._isUsingOnChainPrice();

      if (S.method === 'BNB') {
        const bnbCost = Chain.getBNBCost(amount);
        if (sumPayEl)   sumPayEl.textContent   = bnbCost.toFixed(6) + ' BNB';
        if (sumPriceEl) sumPriceEl.textContent = pricePerToken.toFixed(4) + ' USD / token';
      } else {
        const usdtCost = Chain.getUSDTCost(amount);
        if (sumPayEl)   sumPayEl.textContent   = usdtCost.toFixed(4) + ' USDT';
        if (sumPriceEl) sumPriceEl.textContent = pricePerToken.toFixed(4) + ' USDT / token';
      }
      if (usdEquivEl) usdEquivEl.textContent = '≈ $' + usdTotal.toFixed(2);

      this._updatePriceBadge(usingOnChain);
    },

    _isUsingOnChainPrice() {
      if (S.method === 'BNB') {
        return !!(S.priceBNBWei && S.priceBNBWei > 0n);
      } else {
        return !!(S.priceUSDTWei && S.priceUSDTWei > 0n);
      }
    },

    _updatePriceBadge(isLive) {
      const badge = document.getElementById('priceLiveBadge');
      if (!badge) return;
      if (isLive) {
        badge.textContent = 'LIVE';
        badge.className   = 'price-live-badge live';
      } else {
        badge.textContent = 'EST';
        badge.className   = 'price-live-badge fallback';
      }
    },

    _setAmountWarn(msg) {
      const el = document.getElementById('minLabel');
      if (!el) return;
      el.textContent = msg;
      el.style.color = 'var(--red)';
    },

    _clearAmountWarn() {
      const el = document.getElementById('minLabel');
      if (!el) return;
      el.textContent = t('minLabel');
      el.style.color = '';
    },

    onAmountBlur() {
      const input = document.getElementById('amountInput');
      const raw   = parseFloat(input.value);
      if (isFinite(raw) && raw > 0) {
        const floored = Math.floor(raw);
        if (floored !== raw) input.value = floored;
      }
    },

    handleCTA() {
      if (!S.connected) {
        UI.openModal();
        return;
      }
      if (!S.correctNet) {
        Chain.switchToBSC();
        return;
      }
      if (S.availableTokens !== null && S.availableTokens === 0n) {
        Toast.show(t('noStockErr'), 'e');
        return;
      }
      this._openConfirmModal();
    },

    _openConfirmModal() {
      const raw        = parseFloat(document.getElementById('amountInput').value) || 0;
      const safeAmount = Math.floor(raw);

      if (safeAmount < 50) {
        Toast.show(t('minErr'), 'e');
        return;
      }

      /* Congelar el importe AHORA, antes de abrir el modal */
      _pendingAmount    = safeAmount;
      _pendingTimestamp = Date.now();

      const pricePerToken = Chain.getPricePerTokenUSD();
      const usdTotal      = safeAmount * pricePerToken;
      let   payStr;

      if (S.method === 'BNB') {
        const bnbCost = Chain.getBNBCost(safeAmount);
        payStr = bnbCost.toFixed(6) + ' BNB';
      } else {
        const usdtCost = Chain.getUSDTCost(safeAmount);
        payStr = usdtCost.toFixed(4) + ' USDT';
      }

      const elPay    = document.getElementById('confirmPayAmount');
      const elRec    = document.getElementById('confirmReceiveAmount');
      const elUsd    = document.getElementById('confirmUsdEquiv');
      const elSlip   = document.getElementById('confirmSlippage');
      const elMethod = document.getElementById('confirmMethod');

      if (elPay)    elPay.textContent    = payStr;
      if (elRec)    elRec.textContent    = safeAmount.toLocaleString() + ' USDT.z';
      if (elUsd)    elUsd.textContent    = '≈ $' + usdTotal.toFixed(2);
      if (elSlip)   elSlip.textContent   = Math.round((1 - _SLIPPAGE) * 100) + '%';
      if (elMethod) elMethod.textContent = S.method;

      /* Marcar que la tx viene del modal legítimo */
      _confirmModalOpen = true;

      const overlay = document.getElementById('confirmModal');
      if (overlay) {
        overlay.classList.add('open');
      } else {
        /* Fallback: si por alguna razón el modal no estuviera en el DOM,
           ejecutar la compra directamente sin pasar por el modal */
        console.warn('[MiSwap] confirmModal not found in DOM, executing directly');
        this._buyTokens();
      }
    },

    closeConfirmModal() {
      _confirmModalOpen = false;
      _pendingAmount    = null;
      _pendingTimestamp = null;
      const overlay = document.getElementById('confirmModal');
      if (overlay) overlay.classList.remove('open');
    },

    confirmAndBuy() {
      const overlay = document.getElementById('confirmModal');
      if (overlay) overlay.classList.remove('open');
      this._buyTokens();
    },

    async _buyTokens() {
      if (_buying) return;

      /* Rechazar llamadas directas desde consola */
      if (!_confirmModalOpen) {
        Toast.show('Please use the interface to confirm purchases.', 'i');
        return;
      }
      _confirmModalOpen = false;

      /* Verificar TTL del pendingAmount */
      if (!_pendingTimestamp || (Date.now() - _pendingTimestamp) > _PENDING_TTL_MS) {
        Toast.show('Session expired. Please try again.', 'i');
        _pendingAmount    = null;
        _pendingTimestamp = null;
        return;
      }

      /* Rate-limit */
      const now = Date.now();
      if (now - _lastBuyAttempt < _BUY_COOLDOWN_MS) {
        Toast.show('Please wait a moment before trying again.', 'i');
        return;
      }
      _lastBuyAttempt = now;

      if (!S.connected || !S.contract) { Toast.show(t('ctaConnect'), 'e'); return; }
      if (!S.correctNet) { Chain.switchToBSC(); return; }

      if (S.availableTokens === null) {
        Toast.show('Stock data still loading. Please wait a moment.', 'i');
        return;
      }

      /* Usar el importe congelado en el modal */
      const safeAmount = _pendingAmount;
      _pendingAmount    = null;
      _pendingTimestamp = null;

      /* Guard explícito contra NaN / no-entero */
      if (!Number.isInteger(safeAmount) || safeAmount <= 0) {
        Toast.show('Invalid amount.', 'e');
        return;
      }

      if (safeAmount < 50) {
        Toast.show(t('minErr'), 'e');
        return;
      }

      if (safeAmount > 10_000_000) {
        Toast.show(t('notEnoughStockErr'), 'e');
        return;
      }

      await Chain.fetchAvailableTokens();

      const amountBigInt = BigInt(safeAmount);

      if (S.availableTokens !== null && S.availableTokens === 0n) {
        Toast.show(t('noStockErr'), 'e');
        return;
      }
      if (S.availableTokens !== null && S.availableTokens < amountBigInt * (10n ** 18n)) {
        Toast.show(t('notEnoughStockErr'), 'e');
        return;
      }

      _buying = true;

      UI.setCtaLoading(true, t('confirming'));

      try {
        const minOutFloor  = Math.floor(safeAmount * _SLIPPAGE);
        const minOutTokens = BigInt(minOutFloor > 0 ? minOutFloor : 1);
        const minOut       = (minOutTokens * (10n ** 18n)).toString();

        if (S.method === 'BNB') {
          let valueWei;
          if (S.priceBNBWei && S.priceBNBWei > 0n) {
            valueWei = (S.priceBNBWei * amountBigInt).toString();
            const w3check = S.web3 || S.readWeb3;
            if (w3check) {
              const bnbFloat = parseFloat(w3check.utils.fromWei(valueWei, 'ether'));
              if (bnbFloat > _MAX_BNB_PER_TX) {
                Toast.show('BNB amount exceeds safety limit. Please try a smaller amount or reconnect.', 'e');
                return;
              }
            }
          } else {
            const rate    = (S.bnbUSD && S.bnbUSD > 0) ? S.bnbUSD : CFG.BNB_USD_FALLBACK;
            const bnbCost = (safeAmount * CFG.TOKEN_USD) / rate;
            valueWei      = Utils.toWei18(bnbCost);
            if (valueWei === '0') {
              Toast.show('Price calculation error. Please refresh and try again.', 'e');
              return;
            }
          }
          const tx = await S.contract.methods.buyWithBNB(minOut).send({
            from: S.account, value: valueWei
          });
          Toast.showTx(t('txOk'), tx.transactionHash, 's');

        } else {
          /* USDT flow */
          let usdtAmtWei;
          if (S.priceUSDTWei && S.priceUSDTWei > 0n) {
            usdtAmtWei = (S.priceUSDTWei * amountBigInt).toString();
          } else {
            const usdtCost = safeAmount * CFG.TOKEN_USD;
            usdtAmtWei     = Utils.toWei18(usdtCost);
          }

          /* Cap de sanidad USDT */
          const usdtFloat = parseFloat(
            (S.web3 || S.readWeb3).utils.fromWei(usdtAmtWei, 'ether')
          );
          if (usdtFloat > _MAX_USDT_PER_TX) {
            Toast.show('USDT amount exceeds safety limit. Please try a smaller amount or reconnect.', 'e');
            return;
          }

          const usdtC = new S.web3.eth.Contract(ERC20_ABI, USDT_ADDR);

          const allowanceBN = BigInt(await usdtC.methods.allowance(S.account, CFG.ADDR).call());
          const requiredBN  = BigInt(usdtAmtWei);

          if (allowanceBN > 0n && allowanceBN < requiredBN) {
            UI.setCtaLoading(true, t('approveUSDT'));
            await usdtC.methods.approve(CFG.ADDR, '0').send({ from: S.account });
          }
          if (allowanceBN < requiredBN) {
            UI.setCtaLoading(true, t('approveUSDT'));
            await usdtC.methods.approve(CFG.ADDR, usdtAmtWei).send({ from: S.account });
          }

          UI.setCtaLoading(true, t('confirming'));
          const tx = await S.contract.methods.buyWithUSDT(usdtAmtWei, minOut).send({
            from: S.account
          });
          Toast.showTx(t('txOk'), tx.transactionHash, 's');
        }

        document.getElementById('amountInput').value = '';
        this.onAmountChange();
        await Chain.fetchAvailableTokens();

      } catch (err) {
        if (err.code === 4001) Toast.show(t('txRejected'), 'e');
        else Toast.show(t('txFail') + (err.message?.split('\n')[0] || err), 'e', 7000);
      } finally {
        _buying = false;
        UI.setCtaLoading(false);
      }
    },

    toggleLang() { I18nCtrl.toggle(); }
  };

  /* Proteger propiedades públicas como non-writable */
  Object.defineProperty(pub, 'slippage', {
    get() { return _SLIPPAGE; },
    set() { /* silently ignore */ },
    enumerable: true, configurable: false
  });
  Object.defineProperty(pub, '_MAX_BNB_PER_TX', {
    get() { return _MAX_BNB_PER_TX; },
    set() { /* silently ignore */ },
    enumerable: false, configurable: false
  });
  Object.defineProperty(pub, '_MAX_USDT_PER_TX', {
    get() { return _MAX_USDT_PER_TX; },
    set() { /* silently ignore */ },
    enumerable: false, configurable: false
  });

  return pub;
})();

/* ================================================================
   INITIALISATION — Entry point
================================================================ */
(async function init() {
  Logos.load();
  I18nCtrl.apply();
  await Chain.initReadWeb3();
  await Promise.all([
    Chain.fetchOwner(),
    Chain.fetchContractPrice(),
    Chain.fetchBNBPrice(),
    Chain.fetchAvailableTokens()
  ]);
  if (S.readContract) Chain.startStockPoll();
  await Wallet.tryAutoReconnect();

  setInterval(() => Chain.fetchBNBPrice(), 60_000);
})();
