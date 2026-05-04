/* ================================================================
   MODULE: Config
   Purpose : Immutable application constants.
   Future  : All environment-specific values live here to make
             future module extraction trivial.
================================================================ */
const CFG = Object.freeze({
  /** Contract address (TokenSale — BNB Smart Chain mainnet) */
  ADDR:             "0x32b51924F3656471d2d73965930783C80F1C65e9",
  BSC_HEX:          "0x38",
  BSC_ID:           56,
  /** Slippage protection applied to minTokensOut (5 %) */
  SLIPPAGE:         0.95,
  /** Default fallback USD price per token if on-chain data unavailable */
  TOKEN_USD:        0.02,
  /** Fallback BNB/USD rate if CoinGecko is unreachable */
  BNB_USD_FALLBACK: 600,
  /** Ordered list of public BSC RPC endpoints for read-only calls */
  BSC_RPCS: [
    "https://rpc.ankr.com/bsc",
    "https://bsc-pokt.nodies.app",
    "https://bsc.meowrpc.com",
    "https://1rpc.io/bnb",
    "https://bsc-rpc.publicnode.com",
    "https://bsc.drpc.org",
    "https://bnb.api.onfinality.io/public"
  ]
});
