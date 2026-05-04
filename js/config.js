/* ================================================================
   MODULE: Config
   Purpose : Immutable application constants.
   SECURITY: [SEC-1] CFG es Object.freeze() con validación de RPC
             en tiempo de ejecución. Las URLs RPC se verifican contra
             una allowlist de dominios conocidos antes de usarse.
             El contrato address se normaliza a checksum para evitar
             ataques de typosquatting en logs/UI.
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
  BSC_RPCS: Object.freeze([
    "https://rpc.ankr.com/bsc",
    "https://bsc-pokt.nodies.app",
    "https://bsc.meowrpc.com",
    "https://1rpc.io/bnb",
    "https://bsc-rpc.publicnode.com",
    "https://bsc.drpc.org",
    "https://bnb.api.onfinality.io/public"
  ]),

  /* [SEC-1] Allowlist de dominios externos permitidos para fetch.
     Mantiene compatibilidad total con CoinGecko (favicon, logos)
     y los RPCs BSC. Cualquier fetch a dominio no listado será
     rechazado por Utils.fetchWithTimeout(). */
  ALLOWED_FETCH_ORIGINS: Object.freeze([
    "api.coingecko.com",
    "rpc.ankr.com",
    "bsc-pokt.nodies.app",
    "bsc.meowrpc.com",
    "1rpc.io",
    "bsc-rpc.publicnode.com",
    "bsc.drpc.org",
    "bnb.api.onfinality.io"
  ]),

  /* [SEC-1] Allowlist de dominios para imágenes/iconos de wallets */
  ALLOWED_IMG_ORIGINS: Object.freeze([
    "upload.wikimedia.org",
    "assets.coingecko.com",
    "phantom.app",
    "coin-images.coingecko.com"
  ])
});
