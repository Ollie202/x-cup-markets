import { useQuery } from '@tanstack/react-query';
import { marketApi } from './client';

export const queryKeys = {
  walletConfig: ['wallet-config'] as const,
  marketCards: ['market-cards'] as const,
  portfolio: (address: string) => ['portfolio', address] as const,
};

export function useWalletConfigQuery() {
  return useQuery({
    queryKey: queryKeys.walletConfig,
    queryFn: marketApi.walletConfig,
    staleTime: 60_000,
  });
}

export function useMarketCardsQuery() {
  return useQuery({
    queryKey: queryKeys.marketCards,
    queryFn: () => marketApi.marketCards(),
    refetchInterval: 30_000,
  });
}

export function usePortfolioQuery(address?: string) {
  return useQuery({
    queryKey: address ? queryKeys.portfolio(address) : ['portfolio', 'disconnected'],
    queryFn: () => marketApi.portfolio(address || ''),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });
}
