/* ================================================================
   MODULE: State
   Purpose : Single source of truth for runtime state.
             Mutated only through App and Chain modules.
============================================================= */
const S = {
  /* Web3 instances */
  web3:         null,
  readWeb3:     null,
  contract:     null,
  readContract: null,
  provider:     null,

  /* Wallet / session */
  account:      null,
  connected:    false,
  correctNet:   false,
  isOwner:      false,
  ownerAddress: null,

  /* Market data */
  method:          'BNB',
  priceBNBWei:     null,
  priceUSDTWei:    null,
  bnbUSD:          null,
  availableTokens: null,   /* BigInt — null = not loaded yet, 0n = no stock */

  /* i18n */
  lang: 'en'
};
