/* ================================================================
   MODULE: Wallet Definitions
   Purpose : Descriptor objects for each supported wallet.
             detect() and provider() are called at runtime.
================================================================ */
const WALLETS = [
  {
    id: 'metamask',
    name: 'MetaMask',
    desc: 'Most popular Web3 wallet',
    descEs: 'La wallet Web3 más popular',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
    bg: '#f6851b18',
    detect()   { return !!window.ethereum?.isMetaMask || (window.ethereum?.providers||[]).some(p=>p.isMetaMask); },
    provider() { return (window.ethereum?.providers||[]).find(p=>p.isMetaMask) || window.ethereum; },
    url: 'https://metamask.io/download/'
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    desc: 'Mobile-first wallet',
    descEs: 'Wallet para móvil',
    icon: 'https://assets.coingecko.com/coins/images/11085/small/Trust.png',
    bg: '#3375bb18',
    detect()   { return !!(window.ethereum?.isTrust||window.ethereum?.isTrustWallet||(window.ethereum?.providers||[]).some(p=>p.isTrust||p.isTrustWallet)); },
    provider() { return (window.ethereum?.providers||[]).find(p=>p.isTrust||p.isTrustWallet) || window.ethereum; },
    url: 'https://trustwallet.com/download'
  },
  {
    id: 'coinbase',
    name: 'Coinbase Wallet',
    desc: 'Self-custody by Coinbase',
    descEs: 'Autocustodia de Coinbase',
    icon: 'https://assets.coingecko.com/coins/images/196/small/coinbase-icon.png',
    bg: '#1652f018',
    detect()   { return !!(window.ethereum?.isCoinbaseWallet||(window.ethereum?.providers||[]).some(p=>p.isCoinbaseWallet)); },
    provider() { return (window.ethereum?.providers||[]).find(p=>p.isCoinbaseWallet) || window.ethereum; },
    url: 'https://www.coinbase.com/wallet/downloads'
  },
  {
    id: 'phantom',
    name: 'Phantom',
    desc: 'Multi-chain with EVM',
    descEs: 'Multi-cadena con EVM',
    icon: 'https://phantom.app/favicon.ico',
    bg: '#ab9ff218',
    detect()   { return !!window.phantom?.ethereum; },
    provider() { return window.phantom?.ethereum || window.ethereum; },
    url: 'https://phantom.app/download'
  }
];
