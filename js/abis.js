/* ================================================================
   MODULE: ABI Definitions
   Purpose : Solidity ABI for TokenSale contract + ERC-20 minimal ABI.
================================================================ */

/** Full ABI for TokenSale.sol */
const ABI = [
  { inputs: [], stateMutability: "nonpayable", type: "constructor" },

  /* — Write — */
  { inputs: [{ internalType:"uint256", name:"minTokensOut", type:"uint256" }],
    name:"buyWithBNB", outputs:[], stateMutability:"payable", type:"function" },
  { inputs: [
      { internalType:"uint256", name:"usdtAmount",   type:"uint256" },
      { internalType:"uint256", name:"minTokensOut", type:"uint256" }
    ],
    name:"buyWithUSDT", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs: [
      { internalType:"uint256", name:"newBNBPrice",  type:"uint256" },
      { internalType:"uint256", name:"newUSDTPrice", type:"uint256" }
    ],
    name:"setPrice", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[], name:"withdrawRemainingTokens", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[], name:"rescueBNB",  outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[], name:"rescueUSDT", outputs:[], stateMutability:"nonpayable", type:"function" },

  /* — Read — */
  { inputs:[], name:"owner",             outputs:[{ internalType:"address", name:"", type:"address" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"pricePerToken",     outputs:[{ internalType:"uint256", name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"pricePerTokenBNB",  outputs:[{ internalType:"uint256", name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"pricePerTokenUSDT", outputs:[{ internalType:"uint256", name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"getAvailableTokens",outputs:[{ internalType:"uint256", name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"MIN_PURCHASE",      outputs:[{ internalType:"uint256", name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"SALE_TOKEN",        outputs:[{ internalType:"contract IERC20", name:"", type:"address" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"USDT",              outputs:[{ internalType:"contract IERC20", name:"", type:"address" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"BNB_RECEIVER",      outputs:[{ internalType:"address payable", name:"", type:"address" }], stateMutability:"view", type:"function" },
  { inputs:[], name:"USDT_RECEIVER",     outputs:[{ internalType:"address", name:"", type:"address" }], stateMutability:"view", type:"function" },

  /* — Events — */
  { anonymous:false, inputs:[
      { indexed:true,  internalType:"address", name:"buyer",         type:"address" },
      { indexed:false, internalType:"uint256", name:"tokenAmount",   type:"uint256" },
      { indexed:false, internalType:"address", name:"paymentToken",  type:"address" },
      { indexed:false, internalType:"uint256", name:"paymentAmount", type:"uint256" }
    ], name:"TokensPurchased", type:"event" },
  { anonymous:false, inputs:[
      { indexed:false, internalType:"uint256", name:"newBNBPrice",  type:"uint256" },
      { indexed:false, internalType:"uint256", name:"newUSDTPrice", type:"uint256" }
    ], name:"PriceUpdated", type:"event" },
  { anonymous:false, inputs:[
      { indexed:true,  internalType:"address", name:"to",     type:"address" },
      { indexed:false, internalType:"uint256", name:"amount", type:"uint256" }
    ], name:"TokensWithdrawn", type:"event" },
  { anonymous:false, inputs:[
      { indexed:true,  internalType:"address", name:"to",     type:"address" },
      { indexed:false, internalType:"uint256", name:"amount", type:"uint256" }
    ], name:"BNBRescued", type:"event" },
  { anonymous:false, inputs:[
      { indexed:true,  internalType:"address", name:"to",     type:"address" },
      { indexed:false, internalType:"uint256", name:"amount", type:"uint256" }
    ], name:"USDTRescued", type:"event" },

  { stateMutability:"payable", type:"receive" }
];

/** Minimal ERC-20 ABI (balanceOf, approve, allowance) */
const ERC20_ABI = [
  { inputs:[{ name:"account", type:"address" }],
    name:"balanceOf", outputs:[{ name:"", type:"uint256" }], stateMutability:"view", type:"function" },
  { inputs:[{ name:"spender", type:"address" }, { name:"amount", type:"uint256" }],
    name:"approve", outputs:[{ name:"", type:"bool" }], stateMutability:"nonpayable", type:"function" },
  { inputs:[{ name:"owner", type:"address" }, { name:"spender", type:"address" }],
    name:"allowance", outputs:[{ name:"", type:"uint256" }], stateMutability:"view", type:"function" }
];

/** BSC-mainnet USDT (18 decimals) */
const USDT_ADDR = "0x55d398326f99059fF775485246999027B3197955";
