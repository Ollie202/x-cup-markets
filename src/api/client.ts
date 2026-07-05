import type { MarketCardsResponse, PortfolioResponse, WalletConfigResponse } from './types';
import { getApiBaseUrl as getConfiguredApiBaseUrl } from '../../js/constants.js';

export function getApiBaseUrl() {
  return getConfiguredApiBaseUrl();
}

export async function apiRequest<TResponse>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return payload as TResponse;
}

export const marketApi = {
  walletConfig: () => apiRequest<WalletConfigResponse>('/wallet/config'),
  marketCards: (query = 'status=open&tradingStatus=open&limit=100&sort=kickoff_time') =>
    apiRequest<MarketCardsResponse>(`/markets/cards?${query}`),
  portfolio: (address: string) =>
    apiRequest<PortfolioResponse>(`/portfolio/${encodeURIComponent(address)}`),
  portfolioOrders: (address: string) =>
    apiRequest<PortfolioResponse>(`/portfolio/${encodeURIComponent(address)}/orders`),
  portfolioTrades: (address: string) =>
    apiRequest<PortfolioResponse>(`/portfolio/${encodeURIComponent(address)}/trades`),
  portfolioPositions: (address: string) =>
    apiRequest<PortfolioResponse>(`/portfolio/${encodeURIComponent(address)}/positions`),
};
