import fs from "node:fs";

const defaultApiBaseUrl = "https://x-cup-backend-production.up.railway.app";
const apiBaseUrl = (
  process.env.XSPORTY_API_BASE_URL ||
  process.env.NEXT_PUBLIC_XSPORTY_API_BASE_URL ||
  process.env.XCUP_API_BASE_URL ||
  process.env.NEXT_PUBLIC_XCUP_API_BASE_URL ||
  defaultApiBaseUrl
).replace(/\/+$/, "");

const arcChainId = process.env.XSPORTY_ARC_CHAIN_ID || process.env.VITE_ARC_CHAIN_ID || "5042002";
const arcRpcUrl = process.env.XSPORTY_ARC_RPC_URL || process.env.VITE_ARC_RPC_URL || "https://arc-testnet.drpc.org";
const arcExplorerUrl = process.env.XSPORTY_ARC_EXPLORER_URL || process.env.VITE_ARC_EXPLORER_URL || "https://testnet.arcscan.app";
const arcNativeName = process.env.XSPORTY_ARC_NATIVE_CURRENCY_NAME || process.env.VITE_ARC_NATIVE_CURRENCY_NAME || "USDC";
const arcNativeSymbol = process.env.XSPORTY_ARC_NATIVE_CURRENCY_SYMBOL || process.env.VITE_ARC_NATIVE_CURRENCY_SYMBOL || "USDC";
const arcNativeDecimals = process.env.XSPORTY_ARC_NATIVE_CURRENCY_DECIMALS || process.env.VITE_ARC_NATIVE_CURRENCY_DECIMALS || "18";

const config =
  `window.XSPORTY_API_BASE_URL = ${JSON.stringify(apiBaseUrl)};\n` +
  `window.XCUP_API_BASE_URL = window.XSPORTY_API_BASE_URL;\n` +
  `window.XSPORTY_ARC_CHAIN_ID = ${JSON.stringify(arcChainId)};\n` +
  `window.XSPORTY_ARC_RPC_URL = ${JSON.stringify(arcRpcUrl)};\n` +
  `window.XSPORTY_ARC_EXPLORER_URL = ${JSON.stringify(arcExplorerUrl)};\n` +
  `window.XSPORTY_ARC_NATIVE_CURRENCY_NAME = ${JSON.stringify(arcNativeName)};\n` +
  `window.XSPORTY_ARC_NATIVE_CURRENCY_SYMBOL = ${JSON.stringify(arcNativeSymbol)};\n` +
  `window.XSPORTY_ARC_NATIVE_CURRENCY_DECIMALS = ${JSON.stringify(arcNativeDecimals)};\n`;

fs.writeFileSync("runtime-config.js", config);
console.log(`Runtime config written for ${apiBaseUrl}`);
