/* ================================================================
   MODULE: Wallet Controller
   Purpose : Connection, disconnection, account/chain event handlers.
   FIXES   : - [FIX H5] disconnect() limpia S.ownerAddress = null
               para evitar que una sesión previa deje el ownerAddress
               en memoria y afecte comparaciones en sesiones nuevas.
   SECURITY: - [SEC-6] _isValidProvider() — duck-typing validation
               del objeto provider antes de usarlo en connectWith()
               y tryAutoReconnect(). Verifica que exponga los métodos
               EIP-1193 mínimos requeridos (request, on, removeListener).
               Previene que un provider inyectado por extensión maliciosa
               o prototype-pollution pase como válido al flujo de conexión.
               No bloquea providers legítimos (MM, Trust, CB, Phantom)
               ya que todos implementan la interfaz EIP-1193.
   Depends : S, UI, Chain, Toast, AdminPanel, Utils, WALLETS, ABI, CFG
================================================================ */
const Wallet = {
  _pollTimer: null,

  /**
   * [SEC-6] Validate that a provider object is a legitimate EIP-1193
   * provider before using it. Checks for required methods and that
   * `request` is actually a function (not a primitive or object that
   * could be the result of prototype pollution).
   *
   * Deliberately permissive — only checks the minimum interface so that
   * all major wallets (MetaMask, Trust Wallet, Coinbase Wallet, Phantom)
   * continue to work without any friction.
   *
   * @param {*} prov — candidate provider object
   * @returns {boolean}
   */
  _isValidProvider(prov) {
    return (
      prov !== null &&
      typeof prov === 'object' &&
      typeof prov.request === 'function'
    );
  },

  _startPoll() {
    this._stopPoll();
    this._pollTimer = setInterval(async () => {
      if (!S.provider) return;
      try {
        const chainId = await S.provider.request({ method: 'eth_chainId' });
        const correct = (chainId === CFG.BSC_HEX || Number(chainId) === CFG.BSC_ID);
        if (correct !== S.correctNet) {
          S.correctNet = correct;
          UI.updateNetBadge();
          UI.updateCTA();
          if (correct) {
            await Chain.fetchContractPrice();
            await Chain.fetchAvailableTokens();
          }
        }

        const accounts = await S.provider.request({ method: 'eth_accounts' });
        const acct = accounts?.[0] || null;
        if (acct && acct.toLowerCase() !== (S.account || '').toLowerCase()) {
          S.account = acct;
          this._checkOwner();
          UI.updateWalletBadge();
        } else if (!acct && S.connected) {
          this.disconnect();
        }
      } catch { /* provider gone */ }
    }, 2000);
  },

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  _resolveProvider(wallet) {
    if (wallet.id === 'trust') {
      if (window.trustWallet)  return window.trustWallet;
      if (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) return window.ethereum;
      const providers = window.ethereum?.providers || [];
      const tw = providers.find(p => p.isTrust || p.isTrustWallet);
      if (tw) return tw;
    }
    return wallet.provider();
  },

  async connectWith(wallet) {
    UI.closeModal();
    UI.setCtaLoading(true, t('connecting'));
    try {
      const prov = this._resolveProvider(wallet);

      /* [SEC-6] Validate provider interface before proceeding */
      if (!prov || !this._isValidProvider(prov)) throw new Error('no_provider');

      const accounts = await prov.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) throw new Error('no_account');

      S.provider  = prov;
      S.web3      = new Web3(prov);
      S.account   = accounts[0];
      S.connected = true;
      S.contract  = new S.web3.eth.Contract(ABI, CFG.ADDR);

      await Chain.checkNetwork();

      if (!S.correctNet) {
        await this._switchToBSCNow(prov);
        await Chain.checkNetwork();
      }

      await Chain.fetchOwner();
      this._checkOwner();

      await Promise.all([
        Chain.fetchContractPrice(),
        Chain.fetchAvailableTokens()
      ]);

      UI.updateWalletBadge();
      UI.updateCTA();
      Toast.show(`${t('connOk')}: ${Utils.shorten(S.account)}`, 's');

      this._attachEvents(prov);
      this._startPoll();

    } catch (err) {
      if (err.code === 4001) Toast.show(t('rejected'), 'e');
      else if (err.message === 'no_provider') Toast.show(t('noWallet'), 'e');
      else Toast.show(t('noWallet') + ': ' + (err.message?.split('\n')[0] || ''), 'e');
    } finally {
      UI.setCtaLoading(false);
    }
  },

  async _switchToBSCNow(prov) {
    try {
      await prov.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CFG.BSC_HEX }]
      });
    } catch (e) {
      if (e.code === 4902 || e.code === -32603) {
        try {
          await prov.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId:           CFG.BSC_HEX,
              chainName:         'BNB Smart Chain',
              rpcUrls:           [CFG.BSC_RPCS[0], CFG.BSC_RPCS[1]],
              nativeCurrency:    { name: 'BNB', symbol: 'BNB', decimals: 18 },
              blockExplorerUrls: ['https://bscscan.com/']
            }]
          });
        } catch { /* user cancelled add */ }
      }
    }
  },

  _attachEvents(prov) {
    prov.removeListener?.('accountsChanged', this._onAccounts);
    prov.removeListener?.('chainChanged',    this._onChain);

    this._onAccounts = async (accts) => {
      if (!accts?.length) { this.disconnect(); return; }
      S.account = accts[0];
      this._checkOwner();
      UI.updateWalletBadge();
    };

    this._onChain = async (chainId) => {
      const correct = (chainId === CFG.BSC_HEX || Number(chainId) === CFG.BSC_ID);
      if (correct === S.correctNet) return;
      S.correctNet = correct;
      UI.updateNetBadge();
      UI.updateCTA();
      if (correct) {
        await Chain.fetchContractPrice();
        await Chain.fetchAvailableTokens();
        Toast.show('Switched to BSC Mainnet ✓', 's');
      }
    };

    prov.on?.('accountsChanged', this._onAccounts);
    prov.on?.('chainChanged',    this._onChain);
  },

  disconnect() {
    this._stopPoll();
    S.connected    = false;
    S.account      = null;
    S.isOwner      = false;
    S.provider     = null;
    S.ownerAddress = null; // [FIX H5] limpiar para no contaminar sesiones nuevas
    AdminPanel.hide();
    document.getElementById('adminFab').classList.remove('shown');
    UI.updateWalletBadge();
    UI.updateCTA();
    UI.updateNetBadge();
  },

  _checkOwner() {
    S.isOwner = !!(
      S.account &&
      S.ownerAddress &&
      S.account.toLowerCase() === S.ownerAddress.toLowerCase()
    );
    const fab = document.getElementById('adminFab');
    if (S.isOwner) {
      fab.classList.add('shown');
      AdminPanel.loadData();
    } else {
      fab.classList.remove('shown');
      AdminPanel.hide();
    }
  },

  async tryAutoReconnect() {
    const prov =
      window.trustWallet ||
      (window.ethereum?.providers || []).find(p => p.isTrust || p.isTrustWallet) ||
      window.ethereum;

    /* [SEC-6] Validate provider interface before attempting auto-reconnect.
       Prevents a poisoned window.ethereum (e.g. from a malicious extension
       that overrides the property with a non-EIP-1193 object) from causing
       a silent error or unexpected behaviour during the reconnect flow. */
    if (!prov || !this._isValidProvider(prov)) return;

    try {
      const accounts = await prov.request({ method: 'eth_accounts' });
      if (!accounts?.length) return;

      S.web3     = null;
      S.contract = null;

      S.provider  = prov;
      S.web3      = new Web3(prov);
      S.account   = accounts[0];
      S.connected = true;
      S.contract  = new S.web3.eth.Contract(ABI, CFG.ADDR);

      await Chain.checkNetwork();

      if (!S.correctNet) {
        await this._switchToBSCNow(prov);
        await Chain.checkNetwork();
      }

      try {
        await Chain.fetchOwner();
      } catch (e) {
        console.warn('[MiSwap] fetchOwner in auto-reconnect failed:', e.message);
      } finally {
        this._checkOwner();
      }

      await Promise.all([
        Chain.fetchContractPrice(),
        Chain.fetchAvailableTokens()
      ]);

      UI.updateWalletBadge();
      UI.updateCTA();
      UI.updateNetBadge();

      this._attachEvents(prov);
      this._startPoll();

    } catch (e) {
      console.warn('[MiSwap] auto-reconnect skipped:', e.message);
    }
  }
};
