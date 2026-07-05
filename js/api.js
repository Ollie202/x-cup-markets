import { state } from './state.js';
import { getApiBaseUrl } from './constants.js';
import { gameMarkets, replaceGameMarkets, replaceLiveFeaturedMarkets, replacePlayerPropMarkets, game } from './data.js';
import { countryCodeFromUrl, humanMarketLabel, teamCode } from './utils.js';
import { describeWalletProvider, getWalletProvider } from './provider.js';

export const MARKET_CARD_PAGE_SIZE = 100;

export async function apiGet(path) {
  return apiRequest(path, { method: 'GET' });
}

export async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(baseUrl + path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `${response.status} ${response.statusText}`);
  return payload;
}

export async function hydrateFromBackend(options = {}) {
  const offset = Number(options.offset || 0);
  const append = Boolean(options.append);
  const marketCardsPath = `/markets/cards?status=open&tradingStatus=open&limit=${MARKET_CARD_PAGE_SIZE}&offset=${offset}&sort=kickoff_time`;
  try {
    const results = offset === 0
      ? await Promise.all([
        apiGet('/wallet/config'),
        apiGet(marketCardsPath)
      ])
      : [state.walletConfig, await apiGet(marketCardsPath)];
    if (results[0]) state.walletConfig = results[0];
    const marketPage = results[1] || {};
    const backendCards = mergeBackendCards(marketPage.cards || []);
    const backendMarkets = mapBackendCards(backendCards).filter(match => {
      if (isFinishedHomepageMatch(match)) return false;
      return true;
    });
    if (backendMarkets.length > 0) {
      const nextMarkets = append ? mergeMarketMatches(gameMarkets, backendMarkets) : backendMarkets;
      replaceGameMarkets(nextMarkets);
      replaceLiveFeaturedMarkets(nextMarkets.filter(match => match.isLive).slice(0, 8));
      if (offset === 0) replacePlayerPropMarkets([]);
      state.apiOnline = true;
      state.apiError = "";
      if (!nextMarkets.some(match => match.sport === state.sport)) state.sport = nextMarkets[0].sport;
      return { ok: true, pagination: marketPage.pagination || null };
    }
    if (offset === 0) state.apiOnline = false;
    throw new Error('No open tradable market cards are available right now');
  } catch (error) {
    console.warn('Market data load failed:', error);
    if (offset === 0) state.apiOnline = false;
    const message = error instanceof Error ? error.message : String(error);
    state.apiError = message.replace(/\bbackend\b/gi, 'market data service');
  }
  return { ok: false, pagination: null };
}

export async function fetchFixtureInsights(fixtureId) {
  if (!fixtureId) return null;
  return apiGet('/fixtures/' + encodeURIComponent(fixtureId) + '/insights');
}

function mergeBackendCards(...cardGroups) {
  const cardsByKey = new Map();
  cardGroups.flat().forEach((card, index) => {
    const fixtureId = card?.fixture?.id || card?.summaries?.[0]?.fixture?.id;
    const marketId = card?.summaries?.[0]?.market?.id;
    const key = `${card?.type || 'CARD'}:${fixtureId || marketId || index}`;
    cardsByKey.set(key, card);
  });
  return [...cardsByKey.values()];
}

function mergeMarketMatches(currentMarkets, nextMarkets) {
  const matchesById = new Map();
  [...currentMarkets, ...nextMarkets].forEach(match => {
    matchesById.set(match.id, match);
  });
  return [...matchesById.values()];
}

function isFinishedHomepageMatch(match) {
  const fixtureStatus = match.fixture?.status;
  if (fixtureStatus === 'finished' || fixtureStatus === 'cancelled' || fixtureStatus === 'abandoned' || fixtureStatus === 'postponed') {
    return true;
  }
  const options = match.options || [];
  if (!options.length) return false;
  return options.every(option => option[9]);
}

function mapBackendPlayerFutureCards(cards) {
  return cards.flatMap(card => {
    const summary = card.summaries?.[0];
    const market = summary?.market;
    const future = market?.template?.category === 'PLAYER_FUTURE' ? market.template : null;
    const player = future?.player || card.player;
    if (!market || !market.conditionId || !future || !player?.playerName) return [];
    const [yesCents, noCents] = outcomePairCents(
      summary?.summary?.prices?.YES,
      summary?.summary?.prices?.NO
    );
    return [{
      name: player.playerName,
      country: player.teamName || future.competition?.name || 'Top Leagues',
      image: player.imageUrl || (player.playerId ? `https://media.api-sports.io/football/players/${player.playerId}.png` : ''),
      title: market.title,
      label: `${future.competition?.name || 'Top Leagues'} ${future.competition?.season || '2026'}`,
      yes: yesCents,
      no: noCents,
      marketId: market.conditionId ? market.id : undefined,
      backendMarketId: market.id,
      marketScope: 'tournament'
    }];
  });
}

export function mapBackendCards(cards) {
  return cards.flatMap((card, index) => {
    const fixture = card.fixture || (card.summaries && card.summaries[0] && card.summaries[0].fixture);
    const summaries = (card.summaries || []).filter(summary => summary?.market?.conditionId);
    if (!fixture || summaries.length === 0) return [];
    const sport = mapBackendSport(fixture.sport);
    const options = summaries
      .filter(summary => isSupportedBackendMarket(summary.market, fixture, sport))
      .map(summary => marketOptionFromSummary(summary))
      .filter(Boolean);
    if (options.length === 0) return [];
    const home = fixture.homeCompetitor || 'Home';
    const away = fixture.awayCompetitor || 'Away';
    const match = game(fixture.id || 'backend-' + index, home, away, countryCodeFromUrl(fixture.homeLogoUrl) || 'un', countryCodeFromUrl(fixture.awayLogoUrl) || 'un', teamCode(home), teamCode(away), fixtureLabel(fixture), 'ID:' + summaries[0].market.id, sport, backendGroupForFixture(fixture, sport));
    match.backend = true;
    match.fixture = fixture;
    match.leagueName = fixture.competition?.name || '';
    match.leagueKey = leagueKeyForFixture(fixture);
    if (fixture.homeLogoUrl) match.homeLogoUrl = fixture.homeLogoUrl;
    if (fixture.awayLogoUrl) match.awayLogoUrl = fixture.awayLogoUrl;
    match.isLive = fixture.status === 'live';
    if (match.isLive && fixture.kickoffTime) {
      const age = Date.now() - new Date(fixture.kickoffTime).valueOf();
      if (age > 6 * 60 * 60 * 1000) match.isLive = false;
    }
    const fixedOptions = options.map(option => {
      const fixedUp = relevantLabel(option[0], option[5], option[6], home, away);
      const fixedDown = relevantLabel(option[0], option[7], option[8], home, away);
      return [option[0], option[1], option[2], option[3], option[4], option[5], fixedUp, option[7], fixedDown, option[9]];
    });
    match.options = sport === 'esports' ? collapseMirroredWinnerOptions(fixedOptions, home, away) : fixedOptions;
    match.quick = sport === 'esports' ? binaryWinnerButtons(match.options[0], match) : mainMatchButtons(match.options, home, away);
    return [match];
  });
}

function isSupportedBackendMarket(market, fixture, sport) {
  if (sport !== 'football' || fixture?.competition?.name !== 'Friendlies') return true;
  if (market?.type === 'TOTAL_GOALS' || market?.type === 'BOTH_TEAMS_TO_SCORE') return true;
  const rule = market?.resolver?.rule;
  return rule === 'HOME_TEAM_WIN' || rule === 'DRAW' || rule === 'AWAY_TEAM_WIN';
}

function marketOptionFromSummary(summary) {
  const market = summary.market;
  if (!market) return null;
  const outcomes = market.outcomes || [];
  const up = outcomes.find(outcome => outcome.side === 'YES' || outcome.side === 'OVER') || outcomes[1];
  const down = outcomes.find(outcome => outcome.side === 'NO' || outcome.side === 'UNDER') || outcomes[0];
  if (!up || !down) return null;
  const prices = (summary.summary && summary.summary.prices) || {};
  const [upCents, downCents] = outcomePairCents(prices[up.side], prices[down.side]);
  const disabledReason = marketDisabledReason(market);
  return [market.title, (market.template && market.template.category) || market.type || 'Market', upCents, downCents, market.id, up.side, up.label || up.side, down.side, down.label || down.side, disabledReason];
}

function marketDisabledReason(market) {
  if (market.status === 'resolved') return 'Market resolved';
  if (market.status === 'cancelled') return 'Market cancelled';
  if (market.status !== 'open') return 'Market closed';
  if (market.tradingStatus !== 'open') return market.tradingStatusReason || 'Trading closed';
  if (!market.conditionId) return 'Market not on-chain';
  return '';
}

function outcomePairCents(upPriceData, downPriceData) {
  const upCents = centsForOutcome(upPriceData);
  const downCents = centsForOutcome(downPriceData);

  if (upCents != null && downCents != null) return [upCents, downCents];
  if (upCents != null) return [upCents, complementCents(upCents)];
  if (downCents != null) return [complementCents(downCents), downCents];
  return [50, 50];
}

function centsForOutcome(priceData) {
  if (!priceData) return null;
  const value = priceData.bestAsk
    ?? priceData.midpoint
    ?? priceData.lastTradePrice
    ?? priceData.bestBid;
  return normalizePriceCents(value);
}

function normalizePriceCents(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return clampCents(Math.round(numeric <= 1 ? numeric * 100 : numeric));
}

function complementCents(cents) {
  return clampCents(100 - cents);
}

function clampCents(cents) {
  return Math.max(1, Math.min(99, cents));
}

function mapBackendSport(sport) {
  if (sport === 'mma') return 'ufc';
  if (sport === 'american_football') return 'football';
  return sport || 'football';
}

function backendGroupForFixture(fixture, sport) {
  if (sport === 'ufc') return 'ufc-men';
  if (sport !== 'football') return 'all';
  const competition = fixture.competition || {};
  const kind = String(competition.kind || '').toLowerCase();
  const name = String(competition.name || '').toLowerCase();
  if (name === 'friendlies') return 'international-friendly';
  if (kind === 'league') return 'leagues';
  return 'all';
}

function leagueKeyForFixture(fixture) {
  const name = fixture?.competition?.name || 'other-leagues';
  return String(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other-leagues';
}

function fixtureLabel(fixture) {
  const when = fixture.kickoffTime ? new Date(fixture.kickoffTime) : null;
  const date = when && !Number.isNaN(when.valueOf()) ? when.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Scheduled';
  return date;
}

function relevantLabel(title, side, original, home, away) {
  if (original !== 'Yes' && original !== 'No') return original;
  if (title.includes(' to beat ')) {
    const teams = title.split(' to beat ');
    const first = teams[0].trim();
    const second = teams[1] ? teams[1].trim() : '';
    if (side === 'YES') return first;
    if (side === 'NO') return second;
  }
  if (title.includes(' to win ')) {
    const team = title.split(' to win ')[0].trim();
    if (side === 'YES') return team;
    if (side === 'NO') return team === home ? away : home;
  }
  if (title.includes(' to score first')) {
    const team = title.split(' to score first')[0].trim();
    if (side === 'YES') return team;
  }
  if (title.includes('Total Goals') || title.includes('to end in a draw') || title.includes('to be tied')) {
    return side === 'YES' ? 'Yes' : 'No';
  }
  return original;
}

function collapseMirroredWinnerOptions(options, home, away) {
  const homeTitle = `${home} to beat ${away}`;
  const awayTitle = `${away} to beat ${home}`;
  const homeWinner = options.find(option => option[0] === homeTitle);
  const awayWinner = options.find(option => option[0] === awayTitle);
  if (!homeWinner || !awayWinner) return options;
  return [
    homeWinner,
    ...options.filter(option => option !== homeWinner && option !== awayWinner)
  ];
}

function binaryWinnerButtons(option, match) {
  if (!option) return [];
  return [
    {
      label: match.homeCode,
      price: option[2] + 'c',
      title: option[0],
      marketId: option[4],
      outcomeSide: option[5],
      cssClass: 'up',
      disabled: Boolean(option[9]),
      disabledReason: option[9] || ''
    },
    {
      label: match.awayCode,
      price: option[3] + 'c',
      title: option[0],
      marketId: option[4],
      outcomeSide: option[7],
      cssClass: 'down',
      disabled: Boolean(option[9]),
      disabledReason: option[9] || ''
    }
  ];
}
function mainMatchButtons(options, home, away) {
  let homeBtn, drawBtn, awayBtn;
  for (const opt of options) {
    const title = opt[0] || '';
    const side = opt[5];
    const label = opt[6];
    if (side !== 'YES') continue;
    if (label === home && title.includes(' to beat ')) {
      if (!homeBtn) homeBtn = opt;
    } else if (label === away && title.includes(' to beat ')) {
      if (!awayBtn) awayBtn = opt;
    } else if (title.includes('to end in a draw') || title.includes('to be tied')) {
      if (!drawBtn) drawBtn = opt;
    }
  }
  const picks = [homeBtn, drawBtn, awayBtn];
  if (picks.every(p => !p)) return options.slice(0, 3).map(opt => mkQuickBtn(opt));
  return picks.filter(Boolean).map(opt => mkQuickBtn(opt, opt === drawBtn ? 'Draw' : undefined));
}

function mkQuickBtn(opt, labelOverride) {
  const label = labelOverride || opt[6];
  return {
    label,
    price: opt[2] + 'c',
    title: opt[0],
    marketId: opt[4],
    outcomeSide: opt[5],
    cssClass: opt[5] === 'NO' || opt[5] === 'UNDER' ? 'down' : 'up',
    disabled: Boolean(opt[9]),
    disabledReason: opt[9] || ''
  };
}

export async function refreshPortfolio() {
  if (!state.connected || !state.account) return;
  try {
    const portfolio = await apiGet('/portfolio/' + state.account);
    state.portfolio = portfolio;
    const raw = portfolio.collateral?.balance ?? portfolio.collateral;
    state.balance = raw != null ? Number(raw) / 1000000 : null;
    state.tickets = portfolioTickets(portfolio);
  } catch (error) {
    console.warn('Portfolio unavailable:', error);
  }
}

export async function refreshPortfolioActivity() {
  if (!state.connected || !state.account) return;
  const account = state.account;
  const [orders, trades] = await Promise.all([
    apiGet('/portfolio/' + account + '/orders'),
    apiGet('/portfolio/' + account + '/trades')
  ]);
  state.portfolio = {
    ...(state.portfolio || {}),
    account,
    orders: orders.orders,
    trades: trades.trades,
    fills: trades.fills
  };
}

export async function refreshPortfolioPositions() {
  if (!state.connected || !state.account) return;
  const account = state.account;
  const positions = await apiGet('/portfolio/' + account + '/positions');
  state.portfolio = {
    ...(state.portfolio || {}),
    account,
    collateral: positions.collateral,
    positions: positions.positions
  };
  const raw = positions.collateral?.balance ?? positions.collateral;
  state.balance = raw != null ? Number(raw) / 1000000 : null;
  state.tickets = portfolioTickets(positions);
}

function portfolioTickets(portfolio) {
  return (portfolio.positions || []).flatMap((position, positionIndex) => {
    const market = position.market || {};
    const outcomes = displayOutcomesForPosition(position);
    return outcomes
      .filter(outcome => Number(outcome.balance || 0) > 0)
      .map((outcome, outcomeIndex) => ({
        id: `${market.id || position.marketId || 'position'}-${outcome.outcome?.side || outcomeIndex}`,
        title: market.title || position.title || humanMarketLabel(position.marketId) || 'Open position',
        side: outcome.outcome?.side || position.outcomeSide || position.side || 'YES',
        price: priceToCents(outcome.averagePrice ?? position.averagePrice ?? position.entryPrice),
        amount: Number(outcome.balance || 0) / 1000000,
        pnl: Number(outcome.unrealizedPnl ?? outcome.realizedPnl ?? position.unrealizedPnl ?? position.realizedPnl ?? 0) / 1000000 || 0,
        currentPrice: priceToCents(outcome.currentPrice),
        costBasis: Number(outcome.costBasis || 0) / 1000000 || 0,
        currentValue: Number(outcome.currentValue || 0) / 1000000 || 0,
        redeemable: Boolean(outcome.redeemable),
        winning: Boolean(outcome.winning),
        marketId: market.id || position.marketId,
        updatedAt: new Date(position.updatedAt || Date.now()),
        tokenId: outcome.tokenId,
        positionIndex
      }));
  });
}

function displayOutcomesForPosition(position) {
  const outcomes = position.outcomes || [];
  if (position.resolution?.status === 'submitted' && position.resolution?.outcome !== 'VOID') {
    const winning = outcomes.filter(outcome =>
      outcome.winning || outcome.outcome?.side === position.resolution?.outcome
    );
    if (winning.some(outcome => Number(outcome.balance || 0) > 0)) return winning;
    return outcomes.filter(outcome => Number(outcome.balance || 0) > 0 && !outcome.winning);
  }
  return netDisplayOutcomes(outcomes);
}

function netDisplayOutcomes(outcomes) {
  const positive = outcomes.filter(outcome => Number(outcome.balance || 0) > 0);
  if (positive.length !== 2) return positive;

  const yes = positive.find(outcome => outcome.outcome?.side === 'YES');
  const no = positive.find(outcome => outcome.outcome?.side === 'NO');
  if (!yes || !no) return positive;

  const yesBalance = Number(yes.balance || 0);
  const noBalance = Number(no.balance || 0);
  if (yesBalance === noBalance) return positive;

  const netSide = yesBalance > noBalance ? yes : no;
  const netBalance = Math.abs(yesBalance - noBalance);
  return [{ ...netSide, balance: String(netBalance) }];
}

function priceToCents(value) {
  if (value == null || value === '') return 50;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(0, Math.min(100, Math.round(numeric <= 1 ? numeric * 100 : numeric)));
}

export async function ensureCorrectChain() {
  const provider = getWalletProvider();
  if (!provider) throw new Error('No browser wallet found');
  const hexId = state.walletConfig?.chain?.hexId || '0x7a0';
  let currentId;
  try {
    currentId = await provider.request({ method: 'eth_chainId' });
  } catch {
    return;
  }
  if (currentId === hexId) return;
  const chainConfig = state.walletConfig?.walletAddEthereumChain;
  if (chainConfig) {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
      return;
    } catch (switchError) {
      if (switchError.code !== 4902) throw switchError;
    }
    await provider.request({ method: 'wallet_addEthereumChain', params: [chainConfig] });
  } else {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
  }
}

async function syncActiveWalletAccount() {
  const provider = getWalletProvider();
  if (!provider) throw new Error('No browser wallet found');
  let accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (!accounts?.length) accounts = await provider.request({ method: 'eth_accounts' });
  const activeAccount = accounts?.[0];
  if (!activeAccount) throw new Error('No wallet account selected');
  if (state.account?.toLowerCase() !== activeAccount.toLowerCase()) {
    state.account = activeAccount;
    state.balance = null;
  }
  return activeAccount;
}

function normalizeV(sig) {
  if (sig.length !== 132) return sig;
  const v = parseInt(sig.slice(130, 132), 16);
  if (v < 27) {
    const r = sig.slice(2, 66);
    const s = sig.slice(66, 130);
    return '0x' + r + s + (v + 27).toString(16).padStart(2, '0');
  }
  return sig;
}

function typedDataForWallet(typedData) {
  return {
    ...typedData,
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      ...typedData.types,
    },
    message: { ...typedData.message },
  };
}

async function estimateGasWithFallback(provider, txParams, fallbackHex = '0x186a0') {
  try {
    const gasHex = await provider.request({ method: 'eth_estimateGas', params: [txParams] });
    const gasNum = Math.min(Math.ceil(Number.parseInt(gasHex, 16) * 1.2), 8000000);
    return '0x' + gasNum.toString(16);
  } catch (err) {
    return fallbackHex;
  }
}

export async function submitBackendOrder(pending, amount) {
  const activeAccount = await syncActiveWalletAccount();
  const makerAmount = Math.max(1, Math.round(amount * 1000000)).toString();
  const takerAmount = Math.max(1, Math.round((amount / (pending.price / 100)) * 1000000)).toString();
  const prepared = await apiRequest('/clob/orders/prepare', { method: 'POST', body: JSON.stringify({ marketId: pending.marketId, outcomeSide: pending.outcomeSide, maker: activeAccount, side: 'BUY', makerAmount, takerAmount }) });

  const approvalTx = prepared.readiness?.approval?.transaction;
  await ensureCorrectChain();

  if (approvalTx) {
    const provider = getWalletProvider();
    const txParams = { from: activeAccount, to: approvalTx.to, data: approvalTx.data };
    const gas = await estimateGasWithFallback(provider, txParams, '0x186a0');
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{ ...txParams, gas }]
    });
    await waitForTransaction(txHash);
  }

  const provider = getWalletProvider();
  const signingTypedData = typedDataForWallet(prepared.typedData);
  const rawSig = await provider.request({ method: 'eth_signTypedData_v4', params: [activeAccount, JSON.stringify(signingTypedData)] });
  const signature = normalizeV(rawSig);

  const order = { ...prepared.order, signature };
  const submitted = await apiRequest('/clob/orders', { method: 'POST', body: JSON.stringify({ marketId: pending.marketId, outcomeSide: pending.outcomeSide, order }) });
  return submitted;
}

export async function claimWinnings(marketId) {
  if (!marketId) throw new Error('Missing market id for claim');
  const activeAccount = await syncActiveWalletAccount();
  await ensureCorrectChain();
  const redemption = await apiRequest('/markets/' + encodeURIComponent(marketId) + '/redeem-transaction', {
    method: 'POST',
    body: JSON.stringify({})
  });
  const transaction = redemption.transaction;
  if (!transaction?.to || !transaction?.data) throw new Error('Redeem transaction is unavailable');
  const provider = getWalletProvider();
  const txParams = { from: activeAccount, to: transaction.to, data: transaction.data };
  const gas = await estimateGasWithFallback(provider, txParams, '0x249f0');
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{ ...txParams, gas }]
  });
  await waitForTransaction(txHash);
  return txHash;
}

async function waitForTransaction(txHash) {
  for (let i = 0; i < 60; i++) {
    const provider = getWalletProvider();
    const tx = await provider.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
    if (tx?.blockNumber) return;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Approval transaction did not confirm within 2 minutes');
}
