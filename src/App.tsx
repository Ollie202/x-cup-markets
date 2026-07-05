import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Copy, Moon, Send, Sun, Trash2, Search, X as XIcon } from 'lucide-react';
import { fetchFixtureInsights, hydrateFromBackend, refreshPortfolio, submitBackendOrder } from '../js/api.js';
import { gameMarkets, playerPropMarkets, quickChoices } from '../js/data.js';
import { state as legacyState } from '../js/state.js';
import { getApiBaseUrl, sportLabels, SYMBOL, WC_ANIMS } from '../js/constants.js';
import { flagUrl, getInitials, shortAddress } from '../js/utils.js';
import { useUiStore } from './stores/uiStore';
import type { WalletActions } from './wallet/types';

const appState = legacyState as {
  selectedWalletId: string | null;
  walletProvider: unknown;
  account: string | null;
  connected: boolean;
  apiOnline: boolean;
  apiError?: string;
  balance: number | null;
  portfolio: unknown;
  pendingTicket: PendingTicket | null;
  price: number;
  side: string;
  sport: string;
  tickets: Ticket[];
};
const labelsBySport = sportLabels as Record<string, { title: string; icon: string }>;
const alpha3ToAlpha2: Record<string, string> = {
  ARG: 'ar', AUS: 'au', BEL: 'be', BIH: 'ba', BRA: 'br', CAN: 'ca', CRC: 'cr', CUW: 'cw', CZE: 'cz',
  ECU: 'ec', ENG: 'gb-eng', ESP: 'es', FRA: 'fr', GER: 'de', HAI: 'ht', CIV: 'ci', JPN: 'jp', KOR: 'kr',
  MAR: 'ma', MEX: 'mx', NED: 'nl', PAR: 'py', POR: 'pt', QAT: 'qa', RSA: 'za', SCO: 'gb-sct', SWE: 'se',
  SUI: 'ch', TUN: 'tn', TUR: 'tr', URU: 'uy', USA: 'us',
};

type MatchOption = [string, string, number, number, string?, string?, string?, string?, string?, string?];
type Choice = {
  label: string;
  price: string;
  title: string;
  marketId?: string;
  backendMarketId?: string;
  outcomeSide?: string;
  cssClass?: string;
  disabled?: boolean;
  disabledReason?: string;
  marketScope?: string;
  sidePrices?: Partial<Record<'YES' | 'NO', { price: number; outcomeSide: string }>>;
};
type MarketMatch = {
  id: string;
  sport: string;
  group: string;
  home: string;
  away: string;
  homeFlag: string;
  awayFlag: string;
  homeCode: string;
  awayCode: string;
  time: string;
  marketId?: string;
  leagueName?: string;
  leagueKey?: string;
  homeLogoUrl?: string;
  awayLogoUrl?: string;
  isLive?: boolean;
  options: MatchOption[];
  quick?: Choice[];
  fixture?: {
    kickoffTime?: string;
    status?: string;
    competition?: { name?: string; kind?: string };
    statistics?: TeamStats[];
    stats?: TeamStats[];
    recentForm?: {
      home?: FormRowData[];
      away?: FormRowData[];
    };
    insights?: FixtureInsights;
  };
};
type FixtureInsights = {
  headToHead?: {
    played?: number;
    homeWins?: number;
    draws?: number;
    awayWins?: number;
    homeGoals?: number;
    awayGoals?: number;
  };
  formGauge?: {
    home?: { score?: number; summary?: string; form?: string };
    away?: { score?: number; summary?: string; form?: string };
  };
  lastMeetings?: Array<{
    date?: string;
    leagueName?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeGoals?: number;
    awayGoals?: number;
    status?: string;
  }>;
  standings?: {
    home?: TeamStanding;
    away?: TeamStanding;
  };
};
type TeamStanding = {
  rank?: number;
  points?: number;
  goalsDiff?: number;
  played?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  form?: string;
  group?: string;
};
type FormRowData = {
  result?: string;
  venue?: string;
  score?: string;
  opponent?: string;
  date?: string;
};
type TeamStats = {
  team?: string;
  name?: string;
  label?: string;
  value?: string | number;
  home?: string | number;
  away?: string | number;
};
type PlayerMarket = {
  name: string;
  country: string;
  image?: string;
  title: string;
  label: string;
  yes: number;
  no: number;
  marketId?: string;
  backendMarketId?: string;
  marketScope?: string;
};
type Ticket = {
  id: string;
  title: string;
  side: string;
  price: number;
  amount: number;
  marketId?: string;
  outcomeSide?: string;
  pnl?: number;
  updatedAt: Date;
};
type PendingTicket = Omit<Ticket, 'id' | 'amount' | 'updatedAt'> & {
  backendMarketId?: string;
  marketScope?: string;
  sidePrices?: Partial<Record<'YES' | 'NO', { price: number; outcomeSide: string }>>;
};
type AssistantMessage = {
  role: 'assistant' | 'user';
  text: string;
};
type AssistantContext = {
  match?: MarketMatch | null;
  matches: MarketMatch[];
};
type PageName = 'home' | 'match' | 'positions';
type RouteState = {
  page: PageName;
  sport: string;
  category: string;
  matchId?: string;
};
type MarketPageState = {
  hasMore: boolean;
  nextOffset?: number;
};
type HydrateMarketResult = {
  ok: boolean;
  pagination?: MarketPageState | null;
};

const sports = ['football', 'basketball', 'cricket', 'tennis', 'formula-1', 'ufc', 'esports'];
const footballTabs = [
  ['all', 'All Games'],
  ['international-friendly', 'Int. Friendly Games'],
  ['leagues', 'Leagues'],
];
const nonFootballTabs = [['all', 'All Games']];
const MARKET_LOAD_TIMEOUT_MS = 45000;
const WALLET_CONNECTED_KEY = 'x-cup-wallet-connected';
const WALLET_DISCONNECTED_KEY = 'x-cup-wallet-disconnected';
const WALLET_PROVIDER_KEY = 'x-cup-wallet-provider';
const LazyWalletRuntime = lazy(() => import('./wallet/WalletRuntime').then(module => ({ default: module.WalletRuntime })));

type WalletUiState = {
  connected: boolean;
  address?: string;
};

function shouldLoadWalletRuntimeOnBoot() {
  if (appState.connected) return true;
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(WALLET_DISCONNECTED_KEY) !== '1'
    && (localStorage.getItem(WALLET_CONNECTED_KEY) === '1' || Boolean(localStorage.getItem(WALLET_PROVIDER_KEY)));
}

function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <img src="/xsporty-logo.jpg" alt="" />
    </span>
  );
}

function XSocialIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M13.9 10.5 21.3 2h-1.8l-6.4 7.4L8 2H2l7.8 11.3L2 22h1.8l6.8-7.8L16 22h6l-8.1-11.5Zm-2.4 2.8-.8-1.1L4.4 3.3h2.7l5 7.1.8 1.1 6.6 9.3h-2.7l-5.3-7.5Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M21.6 4.2 18.3 19c-.2 1-.8 1.2-1.6.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6 12.7 1.2 11.2c-1-.3-1-1 .2-1.5L20.1 2.5c.9-.3 1.7.2 1.5 1.7Z" />
    </svg>
  );
}

function parseRoute(): RouteState {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const sport = params.get('sport') || 'football';
  const fallbackCategory = 'all';
  const page = (params.get('page') || 'home') as PageName;
  return {
    page: page === 'match' || page === 'positions' ? page : 'home',
    sport,
    category: params.get('category') || fallbackCategory,
    matchId: params.get('match') || undefined,
  };
}

function writeRoute(route: RouteState, mode: 'push' | 'replace' = 'replace') {
  const params = new URLSearchParams();
  params.set('page', route.page);
  params.set('sport', route.sport);
  params.set('category', route.category);
  if (route.page === 'match' && route.matchId) params.set('match', route.matchId);
  const nextHash = `#${params.toString()}`;
  if (window.location.hash === nextHash) return;
  if (mode === 'push') window.history.pushState(null, '', nextHash);
  else window.history.replaceState(null, '', nextHash);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId = 0;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function countryFlagFor(match: MarketMatch, side: 'home' | 'away') {
  const flag = side === 'home' ? match.homeFlag : match.awayFlag;
  const code = side === 'home' ? match.homeCode : match.awayCode;
  const normalizedFlag = String(flag || '').toLowerCase();
  if (normalizedFlag && normalizedFlag !== 'un') return flagUrl(normalizedFlag);
  return flagUrl(alpha3ToAlpha2[String(code || '').toUpperCase()] || 'un');
}

function imageFor(match: MarketMatch, side: 'home' | 'away') {
  if (side === 'home') return match.homeLogoUrl || countryFlagFor(match, 'home');
  return match.awayLogoUrl || countryFlagFor(match, 'away');
}

function logoFor(match: MarketMatch, side: 'home' | 'away') {
  if (match.sport === 'esports') return side === 'home' ? match.homeLogoUrl : match.awayLogoUrl;
  return imageFor(match, side);
}

function teamNameFor(match: MarketMatch, side: 'home' | 'away') {
  return side === 'home' ? match.home : match.away;
}

function TeamLogo({ match, side }: { match: MarketMatch; side: 'home' | 'away' }) {
  const [imageFailed, setImageFailed] = useState(false);
  const name = teamNameFor(match, side);
  const logo = logoFor(match, side);
  const showInitials = match.sport === 'esports' && (!logo || imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [logo]);

  if (showInitials) {
    return (
      <span className="team-logo team-logo--initials" aria-label={`${name} logo`}>
        {getInitials(name)}
      </span>
    );
  }

  return <img className="team-logo" src={logo} alt={name} onError={() => setImageFailed(true)} />;
}

function priceNumber(price: string | number) {
  const value = Number(String(price).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(value)) return 50;
  return String(price).includes('.') ? Math.max(1, Math.min(99, Math.round(100 / value))) : value;
}

function displayProbability(price: string | number) {
  return `${Math.round(priceNumber(price))}%`;
}

function marketSearch(match: MarketMatch) {
  return `${match.home} ${match.away} ${match.homeCode} ${match.awayCode} ${match.leagueName || ''}`.toLowerCase();
}

function dedupeMatches(matches: MarketMatch[]) {
  const seen = new Set<string>();
  return matches.filter(match => {
    const key = [match.sport, match.group, match.time, match.home, match.away].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultCategoryForSport(_sport: string, _matches: MarketMatch[]) {
  return 'all';
}

function categoryHasMarkets(sport: string, category: string, matches: MarketMatch[], _players: PlayerMarket[]) {
  if (sport !== 'football') return matches.some(match => match.sport === sport);
  if (category === 'all') return matches.some(match => match.sport === 'football');
  return matches.some(match => match.sport === 'football' && match.group === category);
}

function optionCategory(option: MatchOption) {
  return option[1] || 'Main';
}

function optionChoices(option: MatchOption, match: MarketMatch): Choice[] {
  const yesPrice = Number(option[2]) || 0;
  const noPrice = Number(option[3]) || 0;
  const sidePrices = {
    YES: { price: yesPrice, outcomeSide: option[5] || 'YES' },
    NO: { price: noPrice, outcomeSide: option[7] || 'NO' },
  };
  return [
    {
      label: option[6] || 'Yes',
      price: `${yesPrice}c`,
      title: option[0],
      marketId: option[4],
      outcomeSide: option[5] || 'YES',
      cssClass: 'up',
      disabled: Boolean(option[9]),
      disabledReason: option[9] || '',
      sidePrices,
    },
    {
      label: option[8] || 'No',
      price: `${noPrice}c`,
      title: option[0],
      marketId: option[4],
      outcomeSide: option[7] || 'NO',
      cssClass: 'down',
      disabled: Boolean(option[9]),
      disabledReason: option[9] || '',
      sidePrices,
    },
  ].map(choice => ({
    ...choice,
    label:
      choice.label === match.home || choice.label === match.away || choice.label === 'Draw' || choice.label === 'Yes' || choice.label === 'No'
        ? choice.label
        : choice.label,
  }));
}

function pNl(ticket: Ticket, index: number) {
  if (typeof ticket.pnl === 'number') return ticket.pnl;
  const move = index % 2 === 0 ? 0.16 : -0.07;
  return ticket.amount * move;
}

function Header({
  sport,
  setSport,
  query,
  setQuery,
  positionCount,
  onOpenPositions,
  onHome,
  onSearchSubmit,
  connected,
  address,
  balance,
  onConnectWallet,
  onDisconnectWallet,
}: {
  sport: string;
  setSport: (sport: string) => void;
  query: string;
  setQuery: (query: string) => void;
  positionCount: number;
  onOpenPositions: () => void;
  onHome: () => void;
  onSearchSubmit: () => void;
  connected: boolean;
  address?: string;
  balance: number | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}) {
  const [walletOpen, setWalletOpen] = useState(false);
  const theme = useUiStore(state => state.theme);
  const toggleTheme = useUiStore(state => state.toggleTheme);
  const displayAddress = address ? shortAddress(address) : '';
  const balanceText = balance == null ? `... ${SYMBOL}` : `${balance.toFixed(2)} ${SYMBOL}`;

  useEffect(() => {
    if (!walletOpen) return;
    function close() {
      setWalletOpen(false);
    }
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [walletOpen]);

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button className="brand brand-button" type="button" aria-label="Xsporty home" onClick={onHome}>
          <BrandMark />
          <span>
            <strong>Xsporty</strong>
            <small>Prediction Market</small>
          </span>
        </button>

        <form className="search-box header-search" role="search" onSubmit={event => { event.preventDefault(); onSearchSubmit(); }}>
          <Search aria-hidden="true" size={22} />
          <input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Search teams, players, markets" />
        </form>

        <div className="wallet-panel">
          {connected ? (
            <button className="positions-top-btn" type="button" onClick={onOpenPositions}>
              My Positions
              {positionCount > 0 ? <span className="ticket-count-badge">{positionCount}</span> : null}
            </button>
          ) : null}
          <button
            className="theme-top-btn"
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          {connected ? (
            <div className="profile-wallet" onClick={event => event.stopPropagation()}>
              <button className="account-chip" type="button" onClick={() => setWalletOpen(open => !open)} aria-expanded={walletOpen} aria-label="Open wallet menu">
                <span>{balanceText}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              {walletOpen ? (
                <div className="profile-dropdown modern-wallet-menu">
                  <div className="wallet-menu-head wallet-menu-head--simple">
                    <div>
                      <strong>{displayAddress}</strong>
                      <small>{displayAddress}</small>
                    </div>
                    <button className="wallet-copy-btn" type="button" aria-label="Copy wallet address" onClick={() => address && navigator.clipboard?.writeText(address)}>
                      <Copy size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="wallet-menu-balance">
                    <strong>~{balanceText}</strong>
                  </div>
                  <button className="wallet-menu-row" type="button" onClick={() => { setWalletOpen(false); onOpenPositions(); }}>
                    <span>History</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                  <button className="wallet-menu-logout" type="button" onClick={() => { setWalletOpen(false); onDisconnectWallet(); }}>
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <button className="connect-wallet-btn" type="button" onClick={onConnectWallet}>
              Connect Wallet
            </button>
          )}
        </div>

        <nav className="top-sport-nav" aria-label="Sports">
          {sports.map(item => (
            <button
              key={item}
              className={sport === item ? 'is-active' : ''}
              type="button"
              data-sport={item}
              onClick={() => setSport(item)}
            >
              {labelsBySport[item]?.title || item}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Hero({ match, onOpen, loading }: { match?: MarketMatch; onOpen: (match: MarketMatch) => void; loading: boolean }) {
  const title = match ? `${match.home}\nVS\n${match.away}` : loading ? 'Loading\nFootball\nMarkets' : 'No Football\nMarkets\nAvailable';
  return (
    <section className="hero-banner wc-hero-banner home-section" aria-label="Featured football market">
      <div className="wc-hero-bg" />
      <div className="wc-hero-overlay" />
      <div className="wc-hero-content">
        <div className="wc-hero-left">
          <span className="wc-hero-eyebrow">Top League Football - Prediction Market</span>
          <h1 className="wc-hero-title">
            {title.split('\n').map((line, index) => (
              <React.Fragment key={line + index}>
                {index === 1 ? <span>{line}</span> : line}
                {index < title.split('\n').length - 1 ? <br /> : null}
              </React.Fragment>
            ))}
          </h1>
          <p className="wc-hero-subtitle">
            {match
              ? `${match.time} - Prediction markets are open.`
              : loading
                ? 'Fetching live football markets.'
                : 'No football markets are available right now.'}
          </p>
          <div className="wc-hero-badges">
            <span>WC</span>
            <span>2026</span>
            <span>Top Leagues</span>
            <span>Arc Testnet</span>
          </div>
          {match ? (
            <button className="wc-hero-action" type="button" onClick={() => onOpen(match)}>
              Open market
            </button>
          ) : null}
        </div>

        <div className="wc-hero-mid" aria-hidden="true">
          <div className="wc-hero-divider" />
          <div className="wc-hero-stats">
            <div>
              <strong>{match?.options.length || '--'}</strong>
              <span>Markets</span>
            </div>
            <div>
              <strong>2</strong>
              <span>Teams</span>
            </div>
            <div>
              <strong>2026</strong>
              <span>Top Leagues</span>
            </div>
          </div>
          <div className="wc-hero-divider" />
        </div>

        <div className="wc-hero-right">
          <img className="wc-hero-logo" src="/wc2026.png" alt="Top league football" />
          <div className="wc-hero-teams" aria-label="Featured matchup teams">
            <span>{match ? <img src={countryFlagFor(match, 'home')} alt={match.home} /> : null}</span>
            <b>VS</b>
            <span>{match ? <img src={countryFlagFor(match, 'away')} alt={match.away} /> : null}</span>
          </div>
          <span className="wc-hero-hosts">USA - Mexico - Canada</span>
        </div>
      </div>
    </section>
  );
}

function PriceButton({ choice, onPick, compact = false }: { choice: Choice; onPick: (choice: Choice) => void; compact?: boolean }) {
  const showLabel = !compact || choice.label.toLowerCase() === 'draw';
  const shownPrice = displayProbability(choice.price);
  return (
    <button
      className={choice.cssClass || ''}
      type="button"
      aria-label={`${choice.label} ${choice.disabled ? 'Closed' : shownPrice}`}
      disabled={choice.disabled}
      aria-disabled={choice.disabled || undefined}
      onClick={event => {
        event.stopPropagation();
        onPick(choice);
      }}
    >
      {showLabel ? <span>{choice.label}</span> : null}
      <b>{choice.disabled ? 'Closed' : shownPrice}</b>
    </button>
  );
}

function FeaturedStrip({
  matches,
  mode,
  setMode,
  onOpen,
  onPick,
}: {
  matches: MarketMatch[];
  mode: string;
  setMode: (mode: string) => void;
  onOpen: (match: MarketMatch) => void;
  onPick: (choice: Choice) => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const visible = mode === 'live' ? matches.filter(match => match.isLive) : matches.slice(0, 8);

  return (
    <section className="featured-strip home-section" aria-label="Most popular games">
      <div className="compact-section-head">
        <div className="featured-mode-tabs" aria-label="Featured market view">
          <button className={mode === 'popular' ? 'is-active' : ''} type="button" onClick={() => setMode('popular')}>
            Most Popular
          </button>
          <button className={mode === 'live' ? 'is-active' : ''} type="button" onClick={() => setMode('live')}>
            Live
          </button>
        </div>
        <div>
          <button type="button" aria-label="Scroll featured markets left" onClick={() => scroller.current?.scrollBy({ left: -360, behavior: 'smooth' })}>
            &lt;
          </button>
          <button type="button" aria-label="Scroll featured markets right" onClick={() => scroller.current?.scrollBy({ left: 360, behavior: 'smooth' })}>
            &gt;
          </button>
        </div>
      </div>
      <div className="featured-games" ref={scroller}>
        {visible.map(match => {
          const choices = quickChoices(match) as Choice[];
          return (
            <article
              key={match.id}
              className={`featured-card ${choices.length === 3 ? 'featured-card--three-way' : ''}`}
              data-search={marketSearch(match)}
              onClick={() => onOpen(match)}
            >
              <span className="sport-icon">{labelsBySport[match.sport]?.icon || '•'}</span>
              <span className="feature-time">{match.isLive ? <><span className="status-dot live" /><span className="live-label">LIVE</span></> : match.time.toUpperCase()}</span>
              <div className="featured-flags">
                <TeamLogo match={match} side="home" />
                <strong>VS</strong>
                <TeamLogo match={match} side="away" />
              </div>
              <div className="featured-names">
                <span>{match.home}</span>
                <span>{match.away}</span>
              </div>
              <div className="featured-odds">
                {choices.map(choice => (
                  <PriceButton key={`${match.id}-${choice.title}-${choice.label}`} choice={choice} onPick={onPick} compact />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MatchCard({ match, onOpen, onPick }: { match: MarketMatch; onOpen: (match: MarketMatch) => void; onPick: (choice: Choice) => void }) {
  const choices = quickChoices(match) as Choice[];
  const isTwoWay = choices.length === 2;
  return (
    <article
      className={`match-row match-row--${match.sport} ${isTwoWay ? 'match-row--two-way' : 'match-row--three-way'}`}
      data-search={marketSearch(match)}
      onClick={() => onOpen(match)}
    >
      <div className="match-meta">
        {match.isLive ? <span className="status-dot live" aria-hidden="true" /> : null}
        <span>{match.isLive ? 'LIVE' : match.time}</span>
      </div>
      <div className="match-teams">
        <div>
          <TeamLogo match={match} side="home" />
          <strong>{match.home}</strong>
        </div>
        <b>VS</b>
        <div>
          <TeamLogo match={match} side="away" />
          <strong>{match.away}</strong>
        </div>
      </div>
      <div className="quick-odds">
        {choices.map(choice => (
          <PriceButton key={`${match.id}-${choice.title}-${choice.label}`} choice={choice} onPick={onPick} compact />
        ))}
      </div>
    </article>
  );
}

function PlayerMarketCard({ player, onPick }: { player: PlayerMarket; onPick: (choice: Choice) => void }) {
  const playerKey = player.name.toLowerCase().replaceAll(' ', '-');
  const sidePrices = {
    YES: { price: player.yes, outcomeSide: 'YES' },
    NO: { price: player.no, outcomeSide: 'NO' },
  };

  return (
    <article className="player-prop-card" data-player={playerKey} data-search={`${player.name} ${player.country} ${player.title} ${player.label}`.toLowerCase()}>
      <div className="player-prop-image" data-initials={getInitials(player.name)}>
        {player.image ? <img src={player.image} alt={player.name} /> : null}
      </div>
      <div className="player-prop-copy">
        <span>
          {player.country} - {player.label}
        </span>
        <strong>{player.title}</strong>
        <small>{player.name}</small>
      </div>
      <div className="player-prop-prices">
        <button className="price up" type="button" onClick={() => onPick({ label: 'Yes', price: `${player.yes}c`, title: player.title, marketId: player.marketId, backendMarketId: player.backendMarketId, outcomeSide: 'YES', marketScope: player.marketScope, sidePrices })}>
          Yes {player.yes}c
        </button>
        <button className="price down" type="button" onClick={() => onPick({ label: 'No', price: `${player.no}c`, title: player.title, marketId: player.marketId, backendMarketId: player.backendMarketId, outcomeSide: 'NO', marketScope: player.marketScope, sidePrices })}>
          No {player.no}c
        </button>
      </div>
    </article>
  );
}

function EsportsMarketSection({
  title,
  count,
  matches,
  emptyTitle,
  emptyText,
  onOpen,
  onPick,
}: {
  title: string;
  count: number;
  matches: MarketMatch[];
  emptyTitle: string;
  emptyText: string;
  onOpen: (match: MarketMatch) => void;
  onPick: (choice: Choice) => void;
}) {
  return (
    <section className="esports-market-section" aria-label={title}>
      <div className="esports-section-head">
        <h3>{title}</h3>
        <span>{count}</span>
      </div>
      {matches.length ? (
        <div className="match-list" aria-label={`${title} cards`}>
          {matches.map(match => (
            <MatchCard key={match.id} match={match} onOpen={onOpen} onPick={onPick} />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyTitle} text={emptyText} />
      )}
    </section>
  );
}

function MarketBoard({
  sport,
  category,
  setCategory,
  matches,
  players,
  query,
  hasMoreMarkets,
  loadingMoreMarkets,
  onLoadMoreMarkets,
  onOpen,
  onPick,
}: {
  sport: string;
  category: string;
  setCategory: (category: string) => void;
  matches: MarketMatch[];
  players: PlayerMarket[];
  query: string;
  hasMoreMarkets: boolean;
  loadingMoreMarkets: boolean;
  onLoadMoreMarkets: () => void;
  onOpen: (match: MarketMatch) => void;
  onPick: (choice: Choice) => void;
}) {
  const tabs = sport === 'football' ? footballTabs : nonFootballTabs;
  const [esportsStatus, setEsportsStatus] = useState<'upcoming' | 'live'>('upcoming');
  const filteredMatches = matches.filter(match => {
    if (match.sport !== sport) return false;
    if (query && !marketSearch(match).includes(query.toLowerCase())) return false;
    if (sport !== 'football') return true;
    if (category === 'all') return true;
    if (category === 'players') return false;
    return match.group === category;
  });
  const filteredPlayers = players.filter(player => {
    if (category !== 'players') return false;
    if (!query) return true;
    return `${player.name} ${player.country} ${player.title} ${player.label}`.toLowerCase().includes(query.toLowerCase());
  });
  const liveEsportsMatches = filteredMatches.filter(match => match.isLive);
  const upcomingEsportsMatches = filteredMatches.filter(match => !match.isLive);
  const selectedEsportsMatches = esportsStatus === 'live' ? liveEsportsMatches : upcomingEsportsMatches;
  const canLoadMore = hasMoreMarkets && filteredMatches.length > 0 && category !== 'players' && !query;

  return (
    <section className="market-board home-section" id="games-board">
      <div className="section-head">
        <div>
          <h2>
            <span className="sport-icon-inline">{labelsBySport[sport]?.icon}</span> {labelsBySport[sport]?.title || 'Markets'}
          </h2>
        </div>
      </div>
      <div className="market-tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={category === key ? 'is-active' : ''} type="button" onClick={() => setCategory(key)}>
            {label}
          </button>
        ))}
      </div>
      {sport === 'esports' ? (
        <div className="esports-dashboard">
          <div className="featured-mode-tabs esports-status-toggle" aria-label="Esports game status">
            <button
              className={esportsStatus === 'upcoming' ? 'is-active' : ''}
              type="button"
              onClick={() => setEsportsStatus('upcoming')}
            >
              Upcoming
            </button>
            <button
              className={esportsStatus === 'live' ? 'is-active' : ''}
              type="button"
              onClick={() => setEsportsStatus('live')}
            >
              Live
            </button>
          </div>
          <EsportsMarketSection
            title={esportsStatus === 'live' ? 'Live Games' : 'Upcoming Games'}
            count={selectedEsportsMatches.length}
            matches={selectedEsportsMatches}
            emptyTitle={esportsStatus === 'live' ? 'No live esports games' : 'No upcoming esports games'}
            emptyText={
              esportsStatus === 'live'
                ? 'Live cards will appear here as soon as games are in play.'
                : 'There are no upcoming esports cards right now.'
            }
            onOpen={onOpen}
            onPick={onPick}
          />
        </div>
      ) : category === 'players' ? (
        <div className="player-market-grid">
          {filteredPlayers.map(player => (
            <PlayerMarketCard key={`${player.name}-${player.title}`} player={player} onPick={onPick} />
          ))}
          {!filteredPlayers.length ? <EmptyState title="No player markets found" text="Try another search term or check back soon." /> : null}
        </div>
      ) : (
        <>
          <div className="match-list" aria-label="Market game cards">
            {filteredMatches.map(match => (
              <MatchCard key={match.id} match={match} onOpen={onOpen} onPick={onPick} />
            ))}
            {!filteredMatches.length ? <EmptyState title={`No ${labelsBySport[sport]?.title || 'sports'} markets yet`} text="This sport has no open cards right now." /> : null}
          </div>
          {canLoadMore ? (
            <div className="market-load-more">
              <button type="button" onClick={onLoadMoreMarkets} disabled={loadingMoreMarkets}>
                {loadingMoreMarkets ? 'Loading markets' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function LoadingMarkets() {
  return (
    <div className="loading-markets" role="status" aria-live="polite" aria-label="Loading live markets">
      <span aria-hidden="true" />
    </div>
  );
}

function MatchPage({ match, onBack, onPick }: { match: MarketMatch; onBack: () => void; onPick: (choice: Choice) => void }) {
  const [group, setGroup] = useState('All');
  const [statsOpen, setStatsOpen] = useState(false);
  const [insights, setInsights] = useState<FixtureInsights | null>(match.fixture?.insights || null);
  const [statsLoading, setStatsLoading] = useState(false);
  const groups = useMemo(() => ['All', ...Array.from(new Set(match.options.map(optionCategory)))], [match]);
  const shownOptions = group === 'All' ? match.options : match.options.filter(option => optionCategory(option) === group);
  const matchWithInsights = useMemo(() => ({
    ...match,
    fixture: {
      ...match.fixture,
      ...(insights ? { insights } : {}),
    },
  }), [insights, match]);
  const realStats = useMemo(() => statsForMatch(matchWithInsights), [matchWithInsights]);

  useEffect(() => {
    setGroup('All');
    setStatsOpen(false);
  }, [match.id]);

  useEffect(() => {
    let cancelled = false;
    setInsights(match.fixture?.insights || null);
    if (match.fixture?.insights || !match.id || match.sport !== 'football') return () => { cancelled = true; };
    setStatsLoading(true);
    fetchFixtureInsights(match.id)
      .then(payload => {
        if (!cancelled) setInsights(payload?.insights || null);
      })
      .catch(() => {
        if (!cancelled) setInsights(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });
    return () => { cancelled = true; };
  }, [match.fixture?.insights, match.id, match.sport]);

  return (
    <section className="match-page" id="match-page">
      <button className="back-button" type="button" onClick={onBack}>
        Back to games
      </button>
      <div className="match-detail-card">
        <div className="match-meta detail-meta">
          <span>{match.time} - Prediction markets available</span>
        </div>
        <div className="detail-title-row">
          <div className="detail-matchup">
            <div className="detail-team">
              <TeamLogo match={match} side="home" />
              <span>{match.homeCode}</span>
            </div>
            <h2>{match.home} vs {match.away}</h2>
            <div className="detail-team">
              <TeamLogo match={match} side="away" />
              <span>{match.awayCode}</span>
            </div>
          </div>
        </div>
        <div className="stats-toggle-box">
          <button className="stats-toggle" type="button" onClick={() => setStatsOpen(open => !open)} aria-expanded={statsOpen}>
            STATS <ChevronDown size={15} className={statsOpen ? 'is-open' : ''} aria-hidden="true" />
          </button>
          {statsOpen ? (
            <div className="stats-dropdown">
              <div className="stats-dropdown__header">
                <strong>Match stats</strong>
                <span>{statsLoading ? 'Loading stats' : realStats.hasData ? 'Fixture data' : 'No stats available for this fixture yet'}</span>
              </div>
              {realStats.hasData ? (
                <div className="stats-grid">
                  <FormColumn title={match.home} rows={realStats.homeForm} />
                  <FormColumn title={match.away} rows={realStats.awayForm} />
                  {realStats.rows.length ? <StatsTable rows={realStats.rows} /> : null}
                </div>
              ) : (
                <EmptyState title="Stats not available" text="This fixture does not include recent form or team statistics yet." />
              )}
            </div>
          ) : null}
        </div>
        <div className="option-tabs" aria-label="Match market groups">
          {groups.map(item => (
            <button key={item} className={group === item ? 'is-active' : ''} type="button" onClick={() => setGroup(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="option-list">
          {shownOptions.map(option => (
            <div className={`option-row ${option[9] ? 'is-disabled' : ''}`} key={`${option[4]}-${option[0]}`}>
              <div>
                <strong>{option[0]}</strong>
                <span>{optionCategory(option)}</span>
              </div>
              {optionChoices(option, match).map(choice => (
                <button
                  key={`${option[4]}-${choice.outcomeSide}`}
                  className={`price ${choice.cssClass || ''}`}
                  type="button"
                  disabled={choice.disabled}
                  onClick={() => onPick(choice)}
                >
                  {choice.label} {choice.price}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function statsForMatch(match: MarketMatch) {
  const insights = match.fixture?.insights;
  const homeForm = normalizeFormRows(match.fixture?.recentForm?.home);
  const awayForm = normalizeFormRows(match.fixture?.recentForm?.away);
  const rows = normalizeStatRows(match.fixture?.statistics || match.fixture?.stats);
  const insightHomeForm = meetingRowsForTeam(insights?.lastMeetings, match.home);
  const insightAwayForm = meetingRowsForTeam(insights?.lastMeetings, match.away);
  const insightRows = normalizeStatRows(insightStatRows(insights));
  return {
    homeForm: homeForm.length ? homeForm : insightHomeForm,
    awayForm: awayForm.length ? awayForm : insightAwayForm,
    rows: rows.length ? rows : insightRows,
    hasData: Boolean(homeForm.length || awayForm.length || rows.length || insightHomeForm.length || insightAwayForm.length || insightRows.length),
  };
}

function meetingRowsForTeam(meetings: FixtureInsights['lastMeetings'] | undefined, teamName: string) {
  if (!Array.isArray(meetings)) return [];
  const normalizedTeam = teamName.toLowerCase();
  return meetings.flatMap(meeting => {
    const homeTeam = meeting.homeTeam || '';
    const awayTeam = meeting.awayTeam || '';
    const isHome = homeTeam.toLowerCase() === normalizedTeam;
    const isAway = awayTeam.toLowerCase() === normalizedTeam;
    if (!isHome && !isAway) return [];
    const teamGoals = isHome ? meeting.homeGoals : meeting.awayGoals;
    const opponentGoals = isHome ? meeting.awayGoals : meeting.homeGoals;
    return [{
      result: scoreResult(teamGoals, opponentGoals),
      venue: isHome ? 'Home' : 'Away',
      score: teamGoals != null && opponentGoals != null ? `${teamGoals}-${opponentGoals}` : '-',
      opponent: isHome ? awayTeam : homeTeam,
      date: shortDate(meeting.date),
    }];
  }).slice(0, 5);
}

function scoreResult(teamGoals?: number, opponentGoals?: number) {
  if (teamGoals == null || opponentGoals == null) return '-';
  if (teamGoals > opponentGoals) return 'W';
  if (teamGoals < opponentGoals) return 'L';
  return 'D';
}

function shortDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function insightStatRows(insights?: FixtureInsights) {
  if (!insights) return [];
  const rows: TeamStats[] = [];
  const h2h = insights.headToHead;
  if (h2h?.played != null) {
    rows.push({ label: 'Head-to-head', home: `${h2h.homeWins ?? 0}W`, away: `${h2h.awayWins ?? 0}W` });
    rows.push({ label: 'H2H goals', home: h2h.homeGoals ?? '-', away: h2h.awayGoals ?? '-' });
    if (h2h.draws != null) rows.push({ label: 'H2H draws', home: h2h.draws, away: h2h.played });
  }
  const homeStanding = insights.standings?.home;
  const awayStanding = insights.standings?.away;
  if (homeStanding || awayStanding) {
    rows.push({ label: 'League rank', home: homeStanding?.rank ?? '-', away: awayStanding?.rank ?? '-' });
    rows.push({ label: 'Points', home: homeStanding?.points ?? '-', away: awayStanding?.points ?? '-' });
    rows.push({ label: 'Goal difference', home: homeStanding?.goalsDiff ?? '-', away: awayStanding?.goalsDiff ?? '-' });
  }
  const form = insights.formGauge;
  if (form?.home || form?.away) {
    rows.push({ label: 'Form score', home: form.home?.score ?? '-', away: form.away?.score ?? '-' });
  }
  return rows;
}

function normalizeFormRows(rows?: FormRowData[]) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    if (!row || (!row.opponent && !row.score)) return [];
    return [{
      result: String(row.result || '-').slice(0, 1).toUpperCase(),
      venue: row.venue || '',
      score: row.score || '-',
      opponent: row.opponent || 'Opponent',
      date: row.date || '',
    }];
  }).slice(0, 5);
}

function normalizeStatRows(rows?: TeamStats[]) {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(row => {
    const label = row.label || row.name || row.team;
    if (!label) return [];
    return [{
      label,
      home: row.home ?? row.value ?? '-',
      away: row.away ?? '-',
    }];
  });
}

function FormColumn({ title, rows }: { title: string; rows: ReturnType<typeof normalizeFormRows> }) {
  if (!rows.length) return null;
  return (
    <div className="form-column">
      <h3>{title}</h3>
      {rows.map((row, index) => (
        <div className="form-row" key={`${title}-${row.opponent}-${index}`}>
          <span className={`form-badge ${row.result.toLowerCase()}`}>{row.result}</span>
          <strong>{row.score}</strong>
          <span>{row.date || row.venue}</span>
          <small>{row.venue ? `${row.venue} vs ${row.opponent}` : row.opponent}</small>
        </div>
      ))}
    </div>
  );
}

function StatsTable({ rows }: { rows: ReturnType<typeof normalizeStatRows> }) {
  return (
    <div className="form-column">
      <h3>Team stats</h3>
      {rows.map((row, index) => (
        <div className="form-row" key={`${row.label}-${index}`}>
          <span className="form-badge">{index + 1}</span>
          <strong>{row.label}</strong>
          <span>{row.home}</span>
          <small>{row.home} / {row.away}</small>
        </div>
      ))}
    </div>
  );
}

function TradeSlip({
  pending,
  amount,
  setAmount,
  connected,
  onSelectSide,
  onConfirm,
  onClose,
}: {
  pending: PendingTicket | null;
  amount: string;
  setAmount: (amount: string) => void;
  connected: boolean;
  onSelectSide: (side: 'YES' | 'NO') => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const numericAmount = Number(amount) || 0;
  const price = pending?.price || 50;
  const shares = price > 0 ? numericAmount / (price / 100) : 0;

  return (
    <aside className="right-rail">
      <section className="trade-slip">
        <div className="slip-topline">
          <div className="slip-tabs">
            <button className="is-active" type="button">Trade</button>
          </div>
          <button className="slip-close" type="button" onClick={onClose} aria-label="Close trade panel">
            <XIcon size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="ticket-view trade-view is-active">
          <div className="side-toggle" role="group" aria-label="Trade side">
            <button className={pending?.side !== 'NO' ? 'is-active' : ''} type="button" onClick={() => onSelectSide('YES')}>
              YES
            </button>
            <button className={pending?.side === 'NO' ? 'is-active' : ''} type="button" onClick={() => onSelectSide('NO')}>
              NO
            </button>
          </div>
          <h2>{pending?.title || 'Choose a market price'}</h2>
          <label>
            Amount
            <span className="amount-wrap">
              <input value={amount} onChange={event => setAmount(event.target.value.replace(/[^0-9.]/g, ''))} type="text" inputMode="decimal" aria-label="Trade amount" />
              <span className="amount-suffix">{SYMBOL}</span>
            </span>
          </label>
          <div className="quote-grid">
            <span>Avg price</span>
            <strong>{price}c</strong>
            <span>Est. shares</span>
            <strong>{shares.toFixed(1)}</strong>
            <span>Max payout</span>
            <strong>{shares.toFixed(2)} {SYMBOL}</strong>
          </div>
          <button className="connect-btn full confirm-trade" type="button" onClick={onConfirm}>
            {connected ? 'Confirm ticket' : 'Connect wallet first'}
          </button>
        </div>
      </section>
    </aside>
  );
}

function PositionsPage({ tickets, onBack, onPnl }: { tickets: Ticket[]; onBack: () => void; onPnl: (ticket: Ticket, index: number) => void }) {
  const [positionFilter, setPositionFilter] = useState<'open' | 'wins' | 'losses'>('open');
  const net = tickets.reduce((sum, ticket, index) => sum + pNl(ticket, index), 0);
  const visibleTickets = tickets.filter((ticket, index) => {
    if (positionFilter === 'wins') return pNl(ticket, index) >= 0;
    if (positionFilter === 'losses') return pNl(ticket, index) < 0;
    return true;
  });
  return (
    <section className="positions-dashboard">
      <button className="back-button" type="button" onClick={onBack}>Back to games</button>
      <div className="history-hero">
        <div>
          <span className="status-dot" />
          <h2>My Positions</h2>
        </div>
        <p>Track open prediction market positions from your connected wallet.</p>
      </div>
      <div className="history-summary positions-dashboard__summary">
        <article><span>Open Positions</span><strong>{tickets.length}</strong></article>
        <article><span>Net P/L</span><strong className={net >= 0 ? 'is-profit' : 'is-loss'}>{net >= 0 ? '+' : ''}{net.toFixed(2)} {SYMBOL}</strong></article>
        <article><span>Markets</span><strong>{new Set(tickets.map(ticket => ticket.marketId || ticket.title)).size}</strong></article>
      </div>
      <div className="positions-dashboard__grid">
        <article className="history-list positions-dashboard__history">
          <div className="positions-page-tabs" role="tablist" aria-label="Position filters">
            <button className={positionFilter === 'open' ? 'is-active' : ''} type="button" onClick={() => setPositionFilter('open')}>Open tickets</button>
            <button className={positionFilter === 'wins' ? 'is-active' : ''} type="button" onClick={() => setPositionFilter('wins')}>Wins</button>
            <button className={positionFilter === 'losses' ? 'is-active' : ''} type="button" onClick={() => setPositionFilter('losses')}>Losses</button>
          </div>
          <div className="dashboard-list">
            {visibleTickets.map((ticket) => {
              const originalIndex = tickets.findIndex(item => item.id === ticket.id);
              return (
              <button className="dashboard-row" type="button" key={ticket.id} onClick={() => onPnl(ticket, originalIndex)}>
                <div>
                  <span className={`ticket-side ${ticket.side.toLowerCase()}`}>{ticket.side}</span>
                  <strong>{ticket.title}</strong>
                  <small>{ticket.amount.toFixed(2)} shares at {ticket.price}c</small>
                </div>
                <b className={pNl(ticket, originalIndex) >= 0 ? 'is-profit' : 'is-loss'}>{pNl(ticket, originalIndex) >= 0 ? '+' : ''}{pNl(ticket, originalIndex).toFixed(2)} {SYMBOL}</b>
              </button>
              );
            })}
            {!visibleTickets.length ? <div className="ticket-empty"><strong>{tickets.length ? 'No tickets in this tab' : 'No positions'}</strong><span>{tickets.length ? 'Try another tab.' : 'Confirmed tickets appear here.'}</span></div> : null}
          </div>
        </article>
      </div>
    </section>
  );
}

function AssistantLogo({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? 'assistant-logo assistant-logo--small' : 'assistant-logo'} aria-hidden="true">
      <Bot size={small ? 18 : 25} strokeWidth={2.4} />
    </span>
  );
}

function XsportyAssistant({
  matches,
  players,
  onOpenMatch,
  onPrepareBet,
  onShowPlayers,
}: {
  matches: MarketMatch[];
  players: PlayerMarket[];
  onOpenMatch: (match: MarketMatch) => void;
  onPrepareBet: (match: MarketMatch, choice: Choice, amount: number) => void;
  onShowPlayers: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AssistantMessage[]>([
    { role: 'assistant', text: 'Tell me what you want to find, compare, or bet. I can answer sports questions without forcing a ticket.' },
  ]);
  const [context, setContext] = useState<AssistantContext>({ match: null, matches: [] });
  const [position, setPosition] = useState<{ x: number; y: number } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = window.localStorage.getItem('xsporty-assistant-position');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as { x?: unknown; y?: unknown };
      return typeof parsed.x === 'number' && typeof parsed.y === 'number' ? { x: parsed.x, y: parsed.y } : null;
    } catch {
      return null;
    }
  });
  const logRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean; launcher: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  const moveAssistant = useCallback((x: number, y: number, persist = false) => {
    if (typeof window === 'undefined') return;
    const box = shellRef.current?.getBoundingClientRect();
    const width = box?.width ?? 180;
    const height = box?.height ?? 64;
    const gutter = 12;
    const maxX = Math.max(gutter, window.innerWidth - width - gutter);
    const maxY = Math.max(gutter, window.innerHeight - height - gutter);
    const next = {
      x: Math.min(Math.max(x, gutter), maxX),
      y: Math.min(Math.max(y, gutter), maxY),
    };
    setPosition(next);
    if (persist) {
      window.localStorage.setItem('xsporty-assistant-position', JSON.stringify(next));
    }
  }, []);

  useEffect(() => {
    if (!position) return;
    const handleResize = () => moveAssistant(position.x, position.y, true);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [moveAssistant, position]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      const box = shellRef.current?.getBoundingClientRect();
      if (box) moveAssistant(box.left, box.top, true);
    });
  }, [moveAssistant, open]);

  function startDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const isLauncher = Boolean(target.closest('.xs-assistant-launcher'));
    const isDragHandle = Boolean(target.closest('.xs-assistant-drag'));
    if (!isLauncher && !isDragHandle) return;
    if (!isLauncher && target.closest('button, input, textarea, select, a')) return;
    const box = shellRef.current?.getBoundingClientRect();
    if (!box) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: box.left,
      originY: box.top,
      moved: false,
      launcher: isLauncher,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragAssistant(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
    moveAssistant(drag.originX + deltaX, drag.originY + deltaY);
  }

  function stopDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const box = shellRef.current?.getBoundingClientRect();
    if (box) {
      moveAssistant(box.left, box.top, true);
    }
    if (drag.launcher && !drag.moved) {
      suppressClickRef.current = true;
      setOpen(value => !value);
      return;
    }
    suppressClickRef.current = drag.moved;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    setMessages(previous => [...previous, { role: 'user', text }]);
    const answer = await answerAssistant(text, matches, players, context, { onOpenMatch, onPrepareBet, onShowPlayers });
    setContext(answer.context);
    setMessages(previous => [...previous, { role: 'assistant', text: answer.text }]);
  }

  function clearChat() {
    setContext({ match: null, matches: [] });
    setMessages([{ role: 'assistant', text: 'Fresh chat. Ask about games, players, markets, or type the bet you want.' }]);
  }

  function toggleAssistant() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setOpen(value => !value);
  }

  const assistantStyle: React.CSSProperties | undefined = position
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : undefined;

  return (
    <div
      className={open ? 'xs-assistant is-open' : 'xs-assistant'}
      ref={shellRef}
      style={assistantStyle}
      onPointerDown={startDrag}
      onPointerMove={dragAssistant}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
    >
      {open ? (
        <section className="xs-assistant-panel" aria-label="Xsporty Assistant chat">
          <header className="xs-assistant-head xs-assistant-drag">
            <AssistantLogo />
            <div>
              <strong>Xsporty Assistant</strong>
              <small>Sports answers and natural-language tickets</small>
            </div>
            <button type="button" className="xs-assistant-icon-btn" aria-label="Clear chat" onClick={clearChat}>
              <Trash2 size={17} aria-hidden="true" />
            </button>
            <button type="button" className="xs-assistant-icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <XIcon size={18} aria-hidden="true" />
            </button>
          </header>
          <div className="xs-assistant-log" ref={logRef}>
            {messages.map((message, index) => (
              <div className={`xs-assistant-message is-${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'assistant' ? <AssistantLogo small /> : null}
                <p>{message.text}</p>
              </div>
            ))}
          </div>
          <form className="xs-assistant-input" onSubmit={submit}>
            <input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Ask about games, players, markets, or type a bet..." />
            <button type="submit" aria-label="Send message">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      ) : null}
      <button type="button" className="xs-assistant-launcher" aria-label="Open Xsporty Assistant" onClick={toggleAssistant}>
        <AssistantLogo />
      </button>
    </div>
  );
}

async function answerAssistant(
  text: string,
  matches: MarketMatch[],
  players: PlayerMarket[],
  context: AssistantContext,
  actions: {
    onOpenMatch: (match: MarketMatch) => void;
    onPrepareBet: (match: MarketMatch, choice: Choice, amount: number) => void;
    onShowPlayers: () => void;
  },
): Promise<{ text: string; context: AssistantContext }> {
  const request = normalizeAssistantText(text);
  const ranked = rankAssistantMatches(text, matches);
  const nextContext: AssistantContext = { match: ranked[0]?.match || context.match || null, matches: ranked.length ? ranked.slice(0, 5).map(item => item.match) : context.matches };
  const wantsBet = /\b(bet|stake|wager|ticket|place|put|buy)\b/.test(request);
  const asksPlayer = /\b(player|playing|injured|injury|available|roster|squad|lineup|starting|neymar|messi|mbappe|ronaldo)\b/.test(request);

  if (/^(hi|hello|hey|yo)\b/.test(request)) return { text: 'Hey. Ask me for games, player info, prices, comparisons, or tell me the ticket you want.', context: nextContext };
  if (asksPlayer && !wantsBet) return { text: await answerAssistantPlayerQuestion(text, players), context: nextContext };

  if (wantsBet) {
    const match = pickAssistantMatch(request, ranked, context, matches);
    if (!match) return { text: 'Tell me the team, player, or game first, then I can prepare the ticket.', context: nextContext };
    const choice = findAssistantChoice(text, match);
    if (!choice) return { text: `I found ${match.home} vs ${match.away}, but I need the side or market. Try "bet 50 on ${match.home}" or "bet 25 on draw".`, context: { ...nextContext, match } };
    const amount = extractAssistantAmount(request) || 100;
    actions.onPrepareBet(match, choice, amount);
    return { text: `Ticket loaded: ${amount} on ${choice.label} in ${choice.title} at ${choice.price}. Confirm it in the slip when ready.`, context: { ...nextContext, match } };
  }

  if (/\b(open|show|load|take me|go to)\b/.test(request)) {
    const match = pickAssistantMatch(request, ranked, context, matches);
    if (!match) return { text: 'Which game do you want me to open?', context: nextContext };
    actions.onOpenMatch(match);
    return { text: `Opened ${match.home} vs ${match.away}.`, context: { ...nextContext, match } };
  }

  if (/\b(compare|odds|price|prices|markets|lines)\b/.test(request)) {
    const match = pickAssistantMatch(request, ranked, context, matches);
    if (!match) return { text: 'Name a team, player, or game and I will compare the available prices.', context: nextContext };
    const lines = match.options.slice(0, 5).map(option => `${option[0]}: ${optionChoices(option, match).map(choice => `${choice.label} ${choice.price}`).join(' / ')}`);
    return { text: `${match.home} vs ${match.away}\n${lines.join('\n')}`, context: { ...nextContext, match } };
  }

  if (/\b(players|player futures)\b/.test(request)) {
    actions.onShowPlayers();
    const shown = players.slice(0, 4).map(player => `${player.name}: ${player.title} - Yes ${player.yes}c / No ${player.no}c`);
    return { text: shown.length ? shown.join('\n') : 'No player markets are loaded right now.', context: nextContext };
  }

  if (/\b(games|matches|fixtures|schedule|world cup|football|basketball|cricket|tennis|ufc|formula|esports)\b/.test(request)) {
    const shown = ranked.length ? ranked.slice(0, 4).map(item => item.match) : matches.slice(0, 4);
    return { text: shown.length ? shown.map(match => `${match.home} vs ${match.away} - ${match.time} - ${match.options.length} markets`).join('\n') : 'No backend games are loaded right now.', context: { match: shown[0] || nextContext.match || null, matches: shown } };
  }

  return { text: 'I can answer from the loaded sports and market data. Ask for games, players, prices, comparisons, or type the bet you want.', context: nextContext };
}

async function answerAssistantPlayerQuestion(text: string, players: PlayerMarket[]) {
  const player = extractAssistantPlayer(text, players);
  if (!player) return 'Which player should I check?';
  const params = `query=${encodeURIComponent(player)}&season=2026`;
  for (const path of [`/sports/players/status?${params}`, `/players/status?${params}`]) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${path}`);
      if (!response.ok) continue;
      const data = await response.json();
      const result = data?.player || data?.result || data;
      const status = result?.availability || result?.status || result?.playingStatus;
      if (status) return `${result.name || player}: ${status}.${result.reason ? ` ${result.reason}` : ''}`;
    } catch {
      // Fall back to market data below.
    }
  }
  const market = players.find(item => normalizeAssistantText(item.name).includes(normalizeAssistantText(player)));
  if (market) return `I can see ${market.name} in player markets, but that does not confirm official availability. Related market: ${market.title} - Yes ${market.yes}c / No ${market.no}c.`;
  return `I cannot confirm ${player}'s official status from the current backend routes yet. The frontend is ready for /sports/players/status or /players/status when the backend exposes it.`;
}

function extractAssistantPlayer(text: string, players: PlayerMarket[]) {
  const request = normalizeAssistantText(text);
  const known = ['Neymar', 'Neymar Jr', 'Lionel Messi', 'Kylian Mbappe', 'Cristiano Ronaldo', ...players.map(player => player.name)];
  const found = known.find(name => request.includes(normalizeAssistantText(name)));
  if (found) return found;
  return text.replace(/\b(is|are|will|does|do|did|playing|play|in|the|this|world|cup|available|injured|starting|lineup|roster|squad|for)\b/gi, ' ').replace(/[^\w\s'-]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ');
}

function rankAssistantMatches(text: string, matches: MarketMatch[]) {
  const request = normalizeAssistantText(text);
  const terms = request.split(' ').filter(term => term.length > 2);
  return matches.map(match => {
    const haystack = normalizeAssistantText(`${match.home} ${match.away} ${match.homeCode} ${match.awayCode} ${match.leagueName || ''} ${match.group} ${match.sport} ${match.options.map(option => option[0]).join(' ')}`);
    const teamHits = [match.home, match.away, match.homeCode, match.awayCode].filter(Boolean).reduce((score, value) => score + (request.includes(normalizeAssistantText(value)) ? 8 : 0), 0);
    const termHits = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
    return { match, score: teamHits + termHits };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
}

function pickAssistantMatch(request: string, ranked: ReturnType<typeof rankAssistantMatches>, context: AssistantContext, matches: MarketMatch[]) {
  if (/\b(this|that|current|same)\b/.test(request) && context.match) return context.match;
  const ordinal = request.match(/\b(first|second|third|fourth|1st|2nd|3rd|4th)\b/)?.[0] || '';
  const indexes: Record<string, number> = { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3 };
  const index = indexes[ordinal];
  if (index !== undefined) return context.matches[index] || ranked[index]?.match || matches[index];
  return ranked[0]?.match || context.match || null;
}

function findAssistantChoice(text: string, match: MarketMatch) {
  const request = normalizeAssistantText(text);
  const choices = match.options.flatMap(option => optionChoices(option, match));
  const teamName = [match.home, match.away].find(team => request.includes(normalizeAssistantText(team)));
  const scored = choices.map(choice => {
    const haystack = normalizeAssistantText(`${choice.title} ${choice.label} ${choice.outcomeSide || ''}`);
    let score = 0;
    if (teamName && haystack.includes(normalizeAssistantText(teamName))) score += 14;
    ['draw', 'over', 'under', 'yes', 'no'].forEach(word => {
      if (request.includes(word) && haystack.includes(word)) score += 8;
    });
    request.split(' ').forEach(term => {
      if (term.length > 2 && haystack.includes(term)) score += 1;
    });
    if (choice.disabled) score -= 100;
    return { choice, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].choice : null;
}

function extractAssistantAmount(request: string) {
  const amount = Number(request.match(/\$?(\d+(?:\.\d+)?)/)?.[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeAssistantText(value: string) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9.\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function PnlModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  if (!ticket) return null;
  const pnl = pNl(ticket, 0);
  return (
    <div className="pnl-modal">
      <button className="pnl-modal__backdrop" type="button" onClick={onClose} aria-label="Close PnL card" />
      <article className="share-pnl-card" role="dialog" aria-modal="true" aria-labelledby="share-pnl-title">
        <button className="share-pnl-card__close" type="button" onClick={onClose} aria-label="Close PnL card">x</button>
        <div className="share-pnl-card__brand">
          <BrandMark />
          <div><strong>Xsporty Markets</strong><small>Position on Arc Testnet</small></div>
        </div>
        <div className="share-pnl-card__headline">
          <span>Open position</span>
          <h2 id="share-pnl-title">{ticket.title}</h2>
        </div>
        <div className={`share-pnl-card__amount ${pnl >= 0 ? 'is-profit' : 'is-loss'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)} {SYMBOL}</div>
        <div className="share-pnl-card__meta">
          <div><span>Side</span><strong>{ticket.side}</strong></div>
          <div><span>Entry</span><strong>{ticket.price}c</strong></div>
          <div><span>Stake</span><strong>{ticket.amount.toFixed(2)} {SYMBOL}</strong></div>
          <div><span>Status</span><strong>Open</strong></div>
        </div>
        <div className="share-pnl-card__bar"><span style={{ width: `${Math.min(100, Math.max(10, ticket.price))}%` }} /></div>
        <p>Screenshot-ready Xsporty position card.</p>
      </article>
    </div>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-main">
        <div className="footer-brand">
          <a className="brand footer-logo" href="#" onClick={event => event.preventDefault()}>
            <BrandMark />
            <span><strong>Xsporty</strong><small>Prediction Market on Arc Testnet</small></span>
          </a>
          <p>Top league markets for match outcomes.</p>
          <div className="footer-socials" aria-label="Social links">
            <a href="https://x.com/XsportyApp" target="_blank" rel="noreferrer" aria-label="Xsporty on X"><XSocialIcon /></a>
            <a href="https://t.me/XsportyBot" target="_blank" rel="noreferrer" aria-label="Telegram"><TelegramIcon /></a>
          </div>
        </div>
        <nav className="footer-links" aria-label="Market links">
          <h2>Markets</h2>
          <a href="#games-board">Markets</a>
          <a href="#games-board">How It Works</a>
          <a href="#games-board">Terms &amp; Conditions</a>
          <a href="#games-board">Privacy Policy</a>
        </nav>
        <nav className="footer-links" aria-label="Help links">
          <h2>Help</h2>
          <a href="#games-board">FAQ</a>
          <a href="#games-board">Wallet Support</a>
          <a href="https://arc.network" target="_blank" rel="noreferrer">Arc Testnet</a>
        </nav>
      </div>
    </footer>
  );
}

export function App() {
  const initialRoute = useRef<RouteState>(parseRoute());
  const routeWriteMode = useRef<'push' | 'replace'>('replace');
  const [matches, setMatches] = useState<MarketMatch[]>([]);
  const [players, setPlayers] = useState<PlayerMarket[]>([]);
  const [sport, setSport] = useState(initialRoute.current.sport);
  const [category, setCategory] = useState(initialRoute.current.category);
  const [query, setQuery] = useState('');
  const [featuredMode, setFeaturedMode] = useState('popular');
  const [selectedMatch, setSelectedMatch] = useState<MarketMatch | null>(null);
  const [pending, setPending] = useState<PendingTicket | null>(null);
  const [amount, setAmount] = useState('100');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [page, setPage] = useState<PageName>(initialRoute.current.page === 'match' && !initialRoute.current.matchId ? 'home' : initialRoute.current.page);
  const [seenPositionCount, setSeenPositionCount] = useState(0);
  const [pnlTicket, setPnlTicket] = useState<Ticket | null>(null);
  const [apiError, setApiError] = useState('');
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingMoreMarkets, setLoadingMoreMarkets] = useState(false);
  const [marketPage, setMarketPage] = useState<MarketPageState>({ hasMore: false });
  const [walletPulse, setWalletPulse] = useState(0);
  const [walletRuntimeEnabled, setWalletRuntimeEnabled] = useState(shouldLoadWalletRuntimeOnBoot);
  const [walletConnectRequestId, setWalletConnectRequestId] = useState(0);
  const [walletState, setWalletState] = useState<WalletUiState>({
    connected: appState.connected,
    address: appState.account || undefined,
  });
  const orbRef = useRef<HTMLButtonElement | null>(null);
  const walletActionsRef = useRef<WalletActions>({});
  const didHandleInitialSport = useRef(false);

  const refreshWalletState = useCallback(() => {
    setWalletPulse(value => value + 1);
    setTickets([...(appState.tickets || [])] as Ticket[]);
  }, []);

  const requestWalletConnect = useCallback(() => {
    setWalletRuntimeEnabled(true);
    setWalletConnectRequestId(value => value + 1);
  }, []);

  const registerWalletActions = useCallback((actions: WalletActions) => {
    walletActionsRef.current = actions;
  }, []);

  const updateWalletState = useCallback((nextState: WalletUiState) => {
    setWalletState(nextState);
  }, []);

  const disconnectWallet = useCallback(() => {
    walletActionsRef.current.disconnect?.();
  }, []);

  const queueRoutePush = useCallback(() => {
    routeWriteMode.current = 'push';
  }, []);

  const changeSport = useCallback((nextSport: string) => {
    queueRoutePush();
    setQuery('');
    setSelectedMatch(null);
    setSport(nextSport);
    setCategory(defaultCategoryForSport(nextSport, matches));
    setPage('home');
  }, [matches, queueRoutePush]);

  const changeCategory = useCallback((nextCategory: string) => {
    queueRoutePush();
    setQuery('');
    setSelectedMatch(null);
    setCategory(nextCategory);
    setPage('home');
  }, [queueRoutePush]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setApiError('');
      const result = await withTimeout(hydrateFromBackend(), MARKET_LOAD_TIMEOUT_MS, 'Market load') as HydrateMarketResult;
      const ok = Boolean(result?.ok);
      if (cancelled) return;
      const nextMatches = dedupeMatches([...(gameMarkets as MarketMatch[])]);
      const nextPlayers: PlayerMarket[] = [];
      if (ok && nextMatches.length) {
        setMatches(nextMatches);
        setMarketPage(result.pagination || { hasMore: false });
        const nextSport = nextMatches.some(match => match.sport === sport) ? sport : nextMatches[0].sport;
        const nextCategory = categoryHasMarkets(nextSport, category, nextMatches, nextPlayers)
          ? category
          : defaultCategoryForSport(nextSport, nextMatches);
        if (nextSport !== sport) setSport(nextSport);
        if (nextCategory !== category) setCategory(nextCategory);
      } else {
        setMatches([]);
        setPlayers([]);
        setMarketPage({ hasMore: false });
        setApiError(appState.apiError || 'Could not load market data. Please try again.');
        setLoadingMarkets(false);
        return;
      }
      setPlayers(nextPlayers);
      if (!sports.includes(sport)) setSport(appState.sport || 'football');
      const route = initialRoute.current;
      if (route.page === 'match' && route.matchId) {
        const routeMatch = nextMatches.find(match => match.id === route.matchId);
        if (routeMatch) {
          setSelectedMatch(routeMatch);
          setPage('match');
        }
      }
      setLoadingMarkets(false);
    }

    load().catch(error => {
      console.warn('Market load failed:', error);
      if (!cancelled) {
        setMatches([]);
        setPlayers([]);
        setMarketPage({ hasMore: false });
        setApiError(error instanceof Error ? error.message : 'Could not load market data. Please try again.');
        setLoadingMarkets(false);
      }
    });
    const refreshId = window.setInterval(() => {
      load().catch(error => console.warn('Market refresh failed:', error));
    }, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, []);

  const loadMoreMarkets = useCallback(async () => {
    if (loadingMoreMarkets || !marketPage.hasMore) return;
    setLoadingMoreMarkets(true);
    setApiError('');
    try {
      const offset = marketPage.nextOffset ?? (gameMarkets as MarketMatch[]).length;
      const result = await withTimeout(
        hydrateFromBackend({ offset, append: true }),
        MARKET_LOAD_TIMEOUT_MS,
        'More markets'
      ) as HydrateMarketResult;
      const nextMatches = dedupeMatches([...(gameMarkets as MarketMatch[])]);
      if (result.ok && nextMatches.length) {
        setMatches(nextMatches);
        setMarketPage(result.pagination || { hasMore: false });
      } else {
        setMarketPage({ hasMore: false });
      }
    } catch (error) {
      console.warn('More market load failed:', error);
      setApiError(error instanceof Error ? error.message : 'Could not load more markets. Please try again.');
    } finally {
      setLoadingMoreMarkets(false);
    }
  }, [loadingMoreMarkets, marketPage.hasMore, marketPage.nextOffset]);

  useEffect(() => {
    if (!didHandleInitialSport.current) {
      didHandleInitialSport.current = true;
      return;
    }
    setCategory(defaultCategoryForSport(sport, matches));
    setSelectedMatch(null);
    setPage('home');
  }, [sport]);

  useEffect(() => {
    if (page === 'match' && !selectedMatch) return;
    const mode = routeWriteMode.current;
    routeWriteMode.current = 'replace';
    writeRoute({
      page,
      sport,
      category,
      matchId: selectedMatch?.id,
    }, mode);
  }, [category, page, selectedMatch?.id, sport]);

  useEffect(() => {
    if (page === 'positions') setSeenPositionCount(tickets.length);
  }, [page, tickets.length]);

  useEffect(() => {
    function handleRouteChange() {
      const route = parseRoute();
      setSport(route.sport);
      setCategory(route.category);
      if (route.page === 'match' && route.matchId) {
        const routeMatch = matches.find(match => match.id === route.matchId);
        if (routeMatch) {
          setSelectedMatch(routeMatch);
          setPage('match');
          return;
        }
      }
      setSelectedMatch(null);
      setPage(route.page === 'match' ? 'home' : route.page);
    }

    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, [matches]);

  const sportMatches = useMemo(() => matches.filter(match => match.sport === sport), [matches, sport]);
  const heroMatch = useMemo(() => {
    return matches.find(match => match.sport === 'football');
  }, [matches]);

  const pickMarket = useCallback((choice: Choice) => {
    if (choice.disabled) {
      window.alert(choice.disabledReason || 'Market is closed');
      return;
    }
    const price = priceNumber(choice.price);
    const side = choice.outcomeSide || (choice.cssClass === 'down' ? 'NO' : 'YES');
    const next = {
      title: choice.title,
      side,
      price,
      marketId: choice.marketId,
      backendMarketId: choice.backendMarketId,
      outcomeSide: choice.outcomeSide || side,
      marketScope: choice.marketScope,
      sidePrices: choice.sidePrices,
    };
    appState.pendingTicket = next;
    appState.price = price;
    appState.side = side;
    setPending(next);
  }, []);

  const selectPendingSide = useCallback((side: 'YES' | 'NO') => {
    setPending(current => {
      if (!current || current.side === side) return current;
      const sidePrice = current.sidePrices?.[side];
      const nextPrice = sidePrice?.price ?? 100 - current.price;
      const next = {
        ...current,
        side,
        price: nextPrice,
        outcomeSide: sidePrice?.outcomeSide || side,
      };
      appState.pendingTicket = next;
      appState.price = nextPrice;
      appState.side = side;
      return next;
    });
  }, []);

  const openMatch = useCallback((match: MarketMatch) => {
    queueRoutePush();
    appState.pendingTicket = null;
    setSelectedMatch(match);
    setPending(null);
    setPage('match');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [queueRoutePush]);

  const prepareAssistantBet = useCallback((match: MarketMatch, choice: Choice, stake: number) => {
    setAmount(String(stake));
    setSelectedMatch(match);
    setPage('match');
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    pickMarket(choice);
  }, [pickMarket]);

  const showPlayerMarkets = useCallback(() => {
    setSport('football');
    setCategory('players');
    setSelectedMatch(null);
    setPage('home');
    window.requestAnimationFrame(() => {
      document.querySelector('#games-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const submitSearch = useCallback(() => {
    const term = query.trim().toLowerCase();
    const showResults = () => {
      queueRoutePush();
      setSelectedMatch(null);
      setPage('home');
      window.requestAnimationFrame(() => {
        document.querySelector('#games-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    if (!term) {
      showResults();
      return;
    }
    const playerHit = players.find(player => `${player.name} ${player.country} ${player.title} ${player.label}`.toLowerCase().includes(term));
    if (playerHit) {
      setSport('football');
      setCategory('players');
      showResults();
      return;
    }
    const matchHit = matches.find(match => match.sport === sport && marketSearch(match).includes(term)) || matches.find(match => marketSearch(match).includes(term));
    if (matchHit) {
      setSport(matchHit.sport);
      setCategory('all');
      showResults();
      return;
    }
    showResults();
  }, [matches, players, query, queueRoutePush, sport]);

  const showHome = useCallback(() => {
    queueRoutePush();
    setSelectedMatch(null);
    setPage('home');
    window.requestAnimationFrame(() => {
      const target = document.querySelector('.wc-hero-banner') || document.querySelector('#games-board');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [queueRoutePush]);

  const openPositions = useCallback(() => {
    queueRoutePush();
    setSelectedMatch(null);
    setSeenPositionCount(tickets.length);
    setPage('positions');
  }, [queueRoutePush, tickets.length]);

  const confirmTicket = useCallback(async () => {
    if (!pending) {
      window.alert('Choose a market price first');
      return;
    }
    const stake = Number(amount) || 0;
    if (!stake) {
      window.alert('Enter an amount');
      return;
    }
    if (!walletState.connected || !walletState.address) {
      requestWalletConnect();
      return;
    }
    try {
      if (!pending.marketId) {
        window.alert('This market is not available for trading yet.');
        return;
      }
      await submitBackendOrder(pending, stake);
      await refreshPortfolio().catch(() => undefined);
      refreshWalletState();
      setSeenPositionCount((appState.tickets || []).length);
      setPending(null);
      queueRoutePush();
      setPage('positions');
    } catch (error) {
      console.warn(error);
      window.alert(error instanceof Error ? error.message : 'Order submission failed');
    }
  }, [amount, pending, queueRoutePush, refreshWalletState, requestWalletConnect, walletState.address, walletState.connected]);

  const animateOrb = useCallback(() => {
    const node = orbRef.current;
    if (!node) return;
    node.classList.remove(...WC_ANIMS);
    void node.offsetWidth;
    node.classList.add(WC_ANIMS[Math.floor(Math.random() * WC_ANIMS.length)]);
  }, []);

  return (
    <>
      {walletRuntimeEnabled ? (
        <Suspense fallback={null}>
          <LazyWalletRuntime
            connectRequestId={walletConnectRequestId}
            onWalletChange={refreshWalletState}
            onWalletState={updateWalletState}
            onActions={registerWalletActions}
          />
        </Suspense>
      ) : null}
      <Header
        sport={sport}
        setSport={changeSport}
        query={query}
        setQuery={setQuery}
        positionCount={Math.max(0, tickets.length - seenPositionCount)}
        onOpenPositions={openPositions}
        onHome={showHome}
        onSearchSubmit={submitSearch}
        connected={walletState.connected}
        address={walletState.address}
        balance={appState.balance}
        onConnectWallet={requestWalletConnect}
        onDisconnectWallet={disconnectWallet}
      />
      <main className={`dashboard-shell ${page === 'match' ? 'is-match-open' : ''} ${pending ? 'has-right-rail' : 'no-right-rail'}`}>
        <section className="main-column">
          {page === 'home' ? (
            <>
              <Hero match={heroMatch} onOpen={openMatch} loading={loadingMarkets} />
              {sport === 'football' ? (
                <FeaturedStrip matches={sportMatches} mode={featuredMode} setMode={setFeaturedMode} onOpen={openMatch} onPick={pickMarket} />
              ) : null}
              {loadingMarkets ? <LoadingMarkets /> : null}
              <MarketBoard
                sport={sport}
                category={category}
                setCategory={changeCategory}
                matches={matches}
                players={players}
                query={query}
                hasMoreMarkets={marketPage.hasMore}
                loadingMoreMarkets={loadingMoreMarkets}
                onLoadMoreMarkets={loadMoreMarkets}
                onOpen={openMatch}
                onPick={pickMarket}
              />
              {apiError ? <div id="error-screen"><div className="error-content"><strong>Markets unavailable</strong><p>{apiError}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div></div> : null}
            </>
          ) : null}
          {page === 'match' && selectedMatch ? <MatchPage match={selectedMatch} onBack={showHome} onPick={pickMarket} /> : null}
          {page === 'positions' ? <PositionsPage tickets={tickets} onBack={showHome} onPnl={setPnlTicket} /> : null}
        </section>
        {pending ? (
          <TradeSlip
            pending={pending}
            amount={amount}
            setAmount={setAmount}
            connected={walletState.connected}
            onSelectSide={selectPendingSide}
            onConfirm={confirmTicket}
            onClose={() => {
              appState.pendingTicket = null;
              setPending(null);
            }}
          />
        ) : null}
      </main>
      <button
        className="floating-ticket-button"
        type="button"
        ref={orbRef}
        onClick={animateOrb}
        aria-label="Top league football"
      >
        <img src="/wc2026.png" alt="Top league football" className="wc26-logo" />
      </button>
      <XsportyAssistant
        matches={matches}
        players={players}
        onOpenMatch={openMatch}
        onPrepareBet={prepareAssistantBet}
        onShowPlayers={showPlayerMarkets}
      />
      <PnlModal ticket={pnlTicket} onClose={() => setPnlTicket(null)} />
      <Footer />
    </>
  );
}
