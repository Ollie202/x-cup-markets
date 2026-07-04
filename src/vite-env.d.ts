/// <reference types="vite/client" />

interface Window {
  XSPORTY_API_BASE_URL?: string;
  XSPORTY_WALLETCONNECT_PROJECT_ID?: string;
  XSPORTY_ARC_CHAIN_ID?: string | number;
  XSPORTY_ARC_RPC_URL?: string;
  XSPORTY_ARC_EXPLORER_URL?: string;
  XSPORTY_ARC_NATIVE_CURRENCY_NAME?: string;
  XSPORTY_ARC_NATIVE_CURRENCY_SYMBOL?: string;
  XSPORTY_ARC_NATIVE_CURRENCY_DECIMALS?: string | number;
  Xsporty?: {
    openMatchPage: (matchId?: string) => void;
    showHome: () => void;
  };
  // Backward-compat aliases.
  XCUP_API_BASE_URL?: string;
  XCUP_WALLETCONNECT_PROJECT_ID?: string;
  XCupMarkets?: {
    openMatchPage: (matchId?: string) => void;
    showHome: () => void;
  };
}
