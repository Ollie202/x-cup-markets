import { useEffect, useRef } from 'react';
import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, getDefaultConfig, useConnectModal } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http, useAccount, useDisconnect } from 'wagmi';
import { defineChain } from 'viem';
import { refreshPortfolio } from '../../js/api.js';
import { state as legacyState } from '../../js/state.js';
import type { WalletActions, WalletState } from './types';

type WalletRuntimeProps = {
  connectRequestId: number;
  onWalletChange: () => void;
  onWalletState: (state: WalletState) => void;
  onActions: (actions: WalletActions) => void;
};

const appState = legacyState as {
  selectedWalletId: string | null;
  walletProvider: unknown;
  account: string | null;
  connected: boolean;
  balance: number | null;
  portfolio: unknown;
  pendingTicket: unknown;
};

type DisconnectState = {
  requested: boolean;
};

const arcChainId = Number(window.XSPORTY_ARC_CHAIN_ID || import.meta.env.VITE_ARC_CHAIN_ID || 0);
const arcRpcUrl = window.XSPORTY_ARC_RPC_URL || import.meta.env.VITE_ARC_RPC_URL || '';
const arcExplorerUrl = window.XSPORTY_ARC_EXPLORER_URL || import.meta.env.VITE_ARC_EXPLORER_URL || '';

if (!arcChainId || !arcRpcUrl) {
  console.warn('Arc testnet wallet config is missing XSPORTY_ARC_CHAIN_ID or XSPORTY_ARC_RPC_URL.');
}

const arcTestnet = defineChain({
  id: arcChainId || 1,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: Number(window.XSPORTY_ARC_NATIVE_CURRENCY_DECIMALS || import.meta.env.VITE_ARC_NATIVE_CURRENCY_DECIMALS || 18),
    name: window.XSPORTY_ARC_NATIVE_CURRENCY_NAME || import.meta.env.VITE_ARC_NATIVE_CURRENCY_NAME || 'USDC',
    symbol: window.XSPORTY_ARC_NATIVE_CURRENCY_SYMBOL || import.meta.env.VITE_ARC_NATIVE_CURRENCY_SYMBOL || 'USDC',
  },
  rpcUrls: {
    default: {
      http: [arcRpcUrl || 'http://127.0.0.1:8545'],
    },
  },
  blockExplorers: arcExplorerUrl
    ? {
        default: {
          name: 'Arc Testnet Explorer',
          url: arcExplorerUrl,
        },
      }
    : undefined,
});
const walletConnectProjectId =
  window.XSPORTY_WALLETCONNECT_PROJECT_ID ||
  window.XCUP_WALLETCONNECT_PROJECT_ID ||
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
  '00000000000000000000000000000000';

const WALLET_CONNECTED_KEY = 'x-cup-wallet-connected';
const WALLET_DISCONNECTED_KEY = 'x-cup-wallet-disconnected';
const WALLET_PROVIDER_KEY = 'x-cup-wallet-provider';

const wagmiConfig = getDefaultConfig({
  appName: 'Xsporty',
  projectId: walletConnectProjectId,
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
});

const queryClient = new QueryClient();

export function WalletRuntime(props: WalletRuntimeProps) {
  const disconnectState = useRef<DisconnectState>({ requested: false });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <WalletBridge {...props} disconnectState={disconnectState.current} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WalletBridge({
  connectRequestId,
  onWalletChange,
  onWalletState,
  onActions,
  disconnectState,
}: WalletRuntimeProps & { disconnectState: DisconnectState }) {
  const { address, connector, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const handledConnectRequest = useRef(0);

  useEffect(() => {
    onActions({
      openConnectModal: openConnectModal || undefined,
      disconnect: () => {
        disconnectState.requested = true;
        disconnect();
      },
    });
  }, [disconnect, disconnectState, onActions, openConnectModal]);

  useEffect(() => {
    if (!connectRequestId || handledConnectRequest.current === connectRequestId || isConnected || !openConnectModal) return;
    handledConnectRequest.current = connectRequestId;
    openConnectModal?.();
  }, [connectRequestId, isConnected, openConnectModal]);

  useEffect(() => {
    let cancelled = false;

    async function syncWallet() {
      if (!isConnected || !address || !connector) {
        if (appState.selectedWalletId === 'rainbowkit') {
          appState.selectedWalletId = null;
          appState.walletProvider = null;
          appState.account = null;
          appState.connected = false;
          appState.balance = null;
          appState.portfolio = null;
          appState.pendingTicket = null;
          localStorage.removeItem(WALLET_CONNECTED_KEY);
          if (disconnectState.requested) {
            localStorage.setItem(WALLET_DISCONNECTED_KEY, '1');
            localStorage.removeItem(WALLET_PROVIDER_KEY);
          }
          disconnectState.requested = false;
        }
        onWalletState({ connected: false });
        onWalletChange();
        return;
      }

      const provider = await connector.getProvider();
      if (cancelled) return;

      appState.selectedWalletId = 'rainbowkit';
      appState.walletProvider = provider;
      appState.account = address;
      appState.connected = true;
      appState.balance = null;
      appState.portfolio = null;
      disconnectState.requested = false;
      localStorage.setItem(WALLET_CONNECTED_KEY, '1');
      localStorage.removeItem(WALLET_DISCONNECTED_KEY);
      localStorage.setItem(WALLET_PROVIDER_KEY, 'rainbowkit');

      await refreshPortfolio().catch(() => undefined);
      onWalletState({ connected: true, address });
      onWalletChange();
    }

    syncWallet().catch(error => {
      console.warn('Wallet sync failed:', error);
      onWalletChange();
    });

    return () => {
      cancelled = true;
    };
  }, [address, connector, disconnectState, isConnected, onWalletChange, onWalletState]);

  return null;
}
