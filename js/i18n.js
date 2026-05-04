/* ============================================================
   MODULE: i18n (Internationalisation)
   Purpose : English/Spanish string table.
   FIXES   : - adminPriceHint now uses innerHTML so <strong> tags
               render correctly after language toggle.
             - I18nCtrl.apply() separates textContent keys from
               htmlKeys to avoid XSS while preserving markup.
             - slipNote corrected to show the real 5% slippage.
   Future  : Split into /js/locales/en.json + es.json
================================================================ */
const I18N = {
  en: {
    cardTitle:'Buy USDT.z', cardSub:'BNB Smart Chain',
    inputLbl:'You receive', minLabel:'Min. 50 tokens',
    youPayLbl:'You pay', priceLbl:'Price per token',
    slipLbl:'Slippage tolerance', minNote:'Minimum purchase: 50 USDT.z',
    ctaConnect:'Connect Wallet', ctaBuy:'Buy USDT.z', ctaSwitch:'Switch to BSC',
    ctaNoStock:'Awaiting Token Restock',
    warnTxt:'Switch to BNB Smart Chain (BSC Mainnet)',
    netOk:'BSC Mainnet', netBad:'Wrong network', netIdle:'Not connected',
    modalTitle:'Connect Wallet',
    modalNote:'By connecting you agree to interact with the MiSwap contract on BNB Smart Chain.',
    detected:'Detected', install:'Install',
    connecting:'Connecting…', confirming:'Confirm in wallet…',
    connOk:'Wallet connected', rejected:'Connection rejected.',
    noWallet:'Wallet not found. Install the extension or open in its mobile app.',
    txOk:'Transaction confirmed!', txFail:'Transaction failed: ', txRejected:'Transaction rejected.',
    minErr:'Minimum purchase is 50 tokens.',
    noStockErr:'No tokens available. Please check back soon.',
    notEnoughStockErr:'Not enough tokens available for this purchase.',
    approveUSDT:'Approving USDT…',
    footerNote:'Always verify transactions before signing.',
    adminTitle:'Admin Panel', adminSub:'Owner access only',
    adminInfoTitle:'Contract Info',
    adminSupplyLbl:'Tokens available', adminBNBLbl:'Contract BNB', adminUSDTLbl:'Contract USDT',
    adminPriceTitle:'Token Price',
    adminPriceLbl:'Set exchange rate',
    /* HTML allowed — rendered via innerHTML in I18nCtrl.apply() */
    adminPriceHint:'Define how many <strong>USDT</strong> buyers pay per <strong>tokens</strong>. BNB equivalent is calculated automatically.',
    ratioTokensLbl:'Tokens', ratioUSDTLbl:'USDT', ratioSep:'for →',
    bnbEquivLbl:'BNB equivalent per token',
    weiUSDTLbl:'USDT wei (18 dec.)', weiBNBLbl:'BNB wei (18 dec.)',
    adminWithdrawTitle:'Withdraw',
    btnSetPriceText:'Update Price',
    btnWithdrawText:'Withdraw All USDT.z Tokens',
    btnRescueBNBText:'Rescue Stuck BNB', btnRescueUSDTText:'Rescue Stuck USDT'
  },
  es: {
    cardTitle:'Comprar USDT.z', cardSub:'BNB Smart Chain',
    inputLbl:'Recibes', minLabel:'Mín. 50 tokens',
    youPayLbl:'Pagas', priceLbl:'Precio por token',
    slipLbl:'Tolerancia slippage', minNote:'Compra mínima: 50 USDT.z',
    ctaConnect:'Conectar Wallet', ctaBuy:'Comprar USDT.z', ctaSwitch:'Cambiar a BSC',
    ctaNoStock:'Esperando Reabastecimiento',
    warnTxt:'Cambia a BNB Smart Chain (BSC Mainnet)',
    netOk:'BSC Mainnet', netBad:'Red incorrecta', netIdle:'Sin conexión',
    modalTitle:'Conectar Wallet',
    modalNote:'Al conectar, aceptas interactuar con el contrato MiSwap en BNB Smart Chain.',
    detected:'Detectada', install:'Instalar',
    connecting:'Conectando…', confirming:'Confirma en wallet…',
    connOk:'Wallet conectada', rejected:'Conexión rechazada.',
    noWallet:'Wallet no detectada. Instala la extensión o abre en su app.',
    txOk:'¡Transacción confirmada!', txFail:'Falló la transacción: ', txRejected:'Transacción rechazada.',
    minErr:'La compra mínima es 50 tokens.',
    noStockErr:'Sin tokens disponibles. Vuelve pronto.',
    notEnoughStockErr:'No hay suficientes tokens para esta compra.',
    approveUSDT:'Aprobando USDT…',
    footerNote:'Verifica siempre las transacciones antes de firmar.',
    adminTitle:'Panel Admin', adminSub:'Solo acceso del owner',
    adminInfoTitle:'Info del Contrato',
    adminSupplyLbl:'Tokens disponibles', adminBNBLbl:'BNB en contrato', adminUSDTLbl:'USDT en contrato',
    adminPriceTitle:'Precio del Token',
    adminPriceLbl:'Definir tasa de cambio',
    /* HTML allowed — rendered via innerHTML in I18nCtrl.apply() */
    adminPriceHint:'Define cuántos <strong>USDT</strong> pagan los compradores por <strong>tokens</strong>. El equivalente en BNB se calcula automáticamente.',
    ratioTokensLbl:'Tokens', ratioUSDTLbl:'USDT', ratioSep:'por →',
    bnbEquivLbl:'Equivalente BNB por token',
    weiUSDTLbl:'USDT wei (18 dec.)', weiBNBLbl:'BNB wei (18 dec.)',
    adminWithdrawTitle:'Retirar',
    btnSetPriceText:'Actualizar Precio',
    btnWithdrawText:'Retirar todos los tokens USDT.z',
    btnRescueBNBText:'Rescatar BNB atrapado', btnRescueUSDTText:'Rescatar USDT atrapado'
  }
};

/* ================================================================
   MODULE: i18n Controller
   Depends : S (state.js), I18N (above), UI (ui.js)
================================================================ */
const I18nCtrl = {
  t(k) { return I18N[S.lang]?.[k] || k; },

  apply() {
    /* Keys whose values are plain text — use textContent (safe, no XSS) */
    const textKeys = [
      'cardTitle','cardSub','inputLbl','minLabel','youPayLbl','priceLbl',
      'slipLbl','minNote','warnTxt','footerNote',
      'adminTitle','adminSub','adminInfoTitle',
      'adminSupplyLbl','adminBNBLbl','adminUSDTLbl',
      'adminPriceTitle','adminPriceLbl',
      'ratioTokensLbl','ratioUSDTLbl','ratioSep',
      'bnbEquivLbl','weiUSDTLbl','weiBNBLbl',
      'adminWithdrawTitle',
      'btnSetPriceText','btnWithdrawText','btnRescueBNBText','btnRescueUSDTText'
    ];

    /* Keys whose values contain trusted HTML markup — use innerHTML */
    const htmlKeys = ['adminPriceHint'];

    textKeys.forEach(k => {
      const el = document.getElementById(k);
      if (el) el.textContent = this.t(k);
    });

    htmlKeys.forEach(k => {
      const el = document.getElementById(k);
      if (el) el.innerHTML = this.t(k);
    });

    document.getElementById('langBtn').textContent = S.lang === 'en' ? 'ES' : 'EN';
    UI.updateCTA();
    UI.updateNetBadge();
    UI.buildWalletList();
    /* Re-run amount validation so warning text is in the right language */
    App.onAmountChange();
  },

  toggle() {
    S.lang = S.lang === 'en' ? 'es' : 'en';
    this.apply();
  }
};

const t = k => I18nCtrl.t(k);
