/* ================================================================
   MODULE: Chain (Web3 / Blockchain Layer)
   Purpose : RPC connections, on-chain reads, price feeds.
   FIXES   : - [FIX H4] visibilitychange listener: al volver al tab
               se dispara fetchAvailableTokens() inmediatamente,
               evitando que el stock quede desactualizado hasta 30s
               cuando el usuario regresa de otra pestaña.
   Depends : CFG, S, Utils, App, AdminPanel
================================================================ */
const Chain = {
  _stockPollTimer:    null,
  _bnbPriceFetching:  false,

  async initReadWeb3() {
    for (const rpc of CFG.BSC_RPCS) {
      try {
        const w3 = new Web3(new Web3.providers.HttpProvider(rpc, { timeout: 7000 }));
        const id = await Promise.race([
          w3.eth.getChainId(),
          new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 7000))
        ]);
        if (Number(id) === CFG.BSC_ID) {
          S.readWeb3     = w3;
          S.readContract = new w3.eth.Contract(ABI, CFG.ADDR);
          return;
        }
      } catch { /* try next RPC */ }
    }
  },

  async fetchContractPrice() {
    const c = S.contract || S.readContract;
    if (!c) return;
    try {
      const [rawBNB, rawUSDT] = await Promise.all([
        c.methods.pricePerTokenBNB().call(),
        c.methods.pricePerTokenUSDT().call()
      ]);
      S.priceBNBWei  = Utils.safeBigInt(rawBNB);
      S.priceUSDTWei = Utils.safeBigInt(rawUSDT);
      if (typeof App !== 'undefined') App.onAmountChange();
      if (typeof AdminPanel !== 'undefined') AdminPanel.onRatioChange();
    } catch (e) {
      console.warn('[MiSwap] fetchContractPrice:', e.message);
    }
  },

  async fetchAvailableTokens() {
    const c = S.contract || S.readContract;
    if (!c) return;
    try {
      const raw = await c.methods.getAvailableTokens().call();
      S.availableTokens = Utils.safeBigInt(raw);
    } catch (e) {
      console.warn('[MiSwap] fetchAvailableTokens:', e.message);
      S.availableTokens = null;
    }
    UI.updateCTA();
    if (typeof App !== 'undefined') App.onAmountChange();
  },

  /* [FIX H4] startStockPoll añade listener de visibilitychange para
     refrescar el stock inmediatamente al volver al tab, sin esperar
     al siguiente tick del intervalo de 30s. */
  startStockPoll() {
    this.stopStockPoll();
    this._stockPollTimer = setInterval(() => {
      if (document.hidden) return;
      this.fetchAvailableTokens();
    }, 30_000);

    /* Listener de visibilidad — se registra una sola vez */
    if (!this._visibilityBound) {
      this._onVisibilityChange = () => {
        if (!document.hidden) this.fetchAvailableTokens();
      };
      document.addEventListener('visibilitychange', this._onVisibilityChange);
      this._visibilityBound = true;
    }
  },

  stopStockPoll() {
    if (this._stockPollTimer) {
      clearInterval(this._stockPollTimer);
      this._stockPollTimer = null;
    }
    /* Limpiar listener al parar el poll */
    if (this._visibilityBound && this._onVisibilityChange) {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
      this._visibilityBound = false;
    }
  },

  async fetchBNBPrice() {
    if (this._bnbPriceFetching) return;
    this._bnbPriceFetching = true;

    let rate = CFG.BNB_USD_FALLBACK;

    try {
      const d = await Utils.fetchWithTimeout(
        'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd'
      );
      const fetched = d?.binancecoin?.usd;
      if (fetched && isFinite(fetched) && fetched > 100 && fetched < 100_000) {
        rate = fetched;
      }
    } catch { /* fallback */ }
    finally {
      this._bnbPriceFetching = false;
    }

    S.bnbUSD = rate;

    const tagEl = document.getElementById('bnbPriceTag');
    if (tagEl) {
      tagEl.textContent = '$' + rate.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }

    if (typeof App !== 'undefined') App.onAmountChange();
    if (typeof AdminPanel !== 'undefined') AdminPanel.onRatioChange();

    const rateEl = document.getElementById('bnbRateNote');
    if (rateEl) rateEl.textContent = `@ $${rate.toLocaleString()} / BNB`;
  },

  async fetchOwner() {
    const c = S.contract || S.readContract;
    if (!c) return;
    for (let i = 0; i < 3; i++) {
      try {
        S.ownerAddress = await c.methods.owner().call();
        return;
      } catch (e) {
        if (i === 2) console.warn('[MiSwap] fetchOwner failed after 3 attempts:', e.message);
        else await new Promise(r => setTimeout(r, 1200 * (i + 1)));
      }
    }
  },

  async checkNetwork() {
    if (!S.provider) return;
    try {
      const chainId = await S.provider.request({ method: 'eth_chainId' });
      S.correctNet = (
        chainId === CFG.BSC_HEX ||
        chainId === String(CFG.BSC_ID) ||
        Number(chainId) === CFG.BSC_ID
      );
    } catch {
      S.correctNet = false;
    }
    UI.updateNetBadge();
  },

  async switchToBSC() {
    if (!S.provider) return;
    UI.setCtaLoading(true, 'Switching network…');
    try {
      await Wallet._switchToBSCNow(S.provider);
      await this.checkNetwork();
      UI.updateCTA();
      if (S.correctNet) {
        Toast.show('Switched to BSC Mainnet ✓', 's');
        await this.fetchContractPrice();
        await this.fetchAvailableTokens();
      }
    } finally {
      UI.setCtaLoading(false);
    }
  },

  getBNBCost(amount) {
    const w3 = S.web3 || S.readWeb3;
    if (S.priceBNBWei && S.priceBNBWei > 0n && w3) {
      const totalWei = S.priceBNBWei * BigInt(Math.max(1, Math.round(amount)));
      return parseFloat(w3.utils.fromWei(totalWei.toString(), 'ether'));
    }
    const rate = (S.bnbUSD && S.bnbUSD > 0) ? S.bnbUSD : CFG.BNB_USD_FALLBACK;
    return (amount * CFG.TOKEN_USD) / rate;
  },

  getUSDTCost(amount) {
    const w3 = S.web3 || S.readWeb3;
    if (S.priceUSDTWei && S.priceUSDTWei > 0n && w3) {
      const totalWei = S.priceUSDTWei * BigInt(Math.max(1, Math.round(amount)));
      return parseFloat(w3.utils.fromWei(totalWei.toString(), 'ether'));
    }
    return amount * CFG.TOKEN_USD;
  },

  getPricePerTokenUSD() {
    const w3 = S.web3 || S.readWeb3;
    if (S.method === 'BNB') {
      if (S.priceBNBWei && S.priceBNBWei > 0n && w3) {
        const bnbPerTok = parseFloat(w3.utils.fromWei(S.priceBNBWei.toString(), 'ether'));
        const rate      = (S.bnbUSD && S.bnbUSD > 0) ? S.bnbUSD : CFG.BNB_USD_FALLBACK;
        return bnbPerTok * rate;
      }
      return CFG.TOKEN_USD;
    } else {
      if (S.priceUSDTWei && S.priceUSDTWei > 0n && w3) {
        return parseFloat(w3.utils.fromWei(S.priceUSDTWei.toString(), 'ether'));
      }
      return CFG.TOKEN_USD;
    }
  }
};
