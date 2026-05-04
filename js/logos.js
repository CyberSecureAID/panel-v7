/* ================================================================
   MODULE: Logos
   Purpose : Fetch coin logo URLs from CoinGecko public API.
             Falls back gracefully (hides broken img elements).
============================================================= */
const Logos = {
  MAP: [
    { coinId: 'binancecoin', targets: ['bnbLogo']               },
    { coinId: 'tether',      targets: ['usdtLogo', 'tokenLogo'] }
  ],

  async load() {
    this.MAP.forEach(({ coinId, targets }) => this._fetch(coinId, targets));
  },

  async _fetch(coinId, targets) {
    try {
      const d   = await Utils.fetchWithTimeout(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`
      );
      const url = d?.image?.large || d?.image?.small || null;
      if (!url) throw new Error('no url');
      targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.src = url;
      });
    } catch {
      targets.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.visibility = 'hidden';
      });
    }
  }
};
