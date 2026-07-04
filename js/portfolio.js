import { state } from './state.js';
import { SYMBOL, ARC_TX_EXPLORER } from './constants.js';
import { gameMarkets } from './data.js';
import { claimWinnings, refreshPortfolioActivity, refreshPortfolioPositions } from './api.js';
import { applyConnectedWallet } from './wallet.js';
import { markPositionsSeen, renderTickets } from './trading.js';
import { showToast } from './ui.js';
import { escapeHtml, humanMarketLabel } from './utils.js';

const dashboard = document.querySelector('#positions-dashboard');
const positionsList = document.querySelector('#dashboard-positions');
const openOrdersList = document.querySelector('#dashboard-open-orders');
const historyList = document.querySelector('#dashboard-history');
const dashboardBalance = document.querySelector('[data-dashboard-balance]');
const dashboardPositionCount = document.querySelector('[data-dashboard-position-count]');
const dashboardOrderCount = document.querySelector('[data-dashboard-order-count]');
const loadingState = {
  positions: false,
  activity: false
};

export function wirePortfolioDashboard() {
  document.querySelectorAll("[data-action='open-portfolio']").forEach(button => {
    button.addEventListener('click', async () => {
      await openPortfolioDashboard();
    });
  });
}

export async function openPortfolioDashboard() {
  if (!state.connected || !state.account) {
    showToast('Connect wallet to view positions');
    return;
  }
  document.body.classList.add('is-history-page');
  document.body.classList.remove('is-match-open');
  document.querySelector('#match-page').hidden = true;
  document.querySelector('#history-page').hidden = true;
  document.querySelectorAll('.home-section').forEach(section => (section.hidden = true));
  dashboard.hidden = false;
  markPositionsSeen();
  loadingState.positions = true;
  loadingState.activity = true;
  renderPortfolioDashboard();
  void loadPortfolioActivity();
  void loadPortfolioPositions();
  dashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function hidePortfolioDashboard() {
  if (dashboard) dashboard.hidden = true;
}

export function renderPortfolioDashboard() {
  if (!dashboard) return;
  const portfolio = state.portfolio;
  const positions = state.tickets || [];
  const openOrders = portfolio?.orders?.open || [];
  const history = portfolio?.orders?.history || [];
  const fillsByOrder = new Map((portfolio?.fills || []).map(fill => [fill.orderId, fill]));

  dashboardBalance.textContent = state.balance == null
    ? '... USDC'
    : `${state.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${SYMBOL}`;
  dashboardPositionCount.textContent = loadingState.positions ? '...' : positions.length;
  dashboardOrderCount.textContent = loadingState.activity ? '...' : openOrders.length;

  positionsList.innerHTML = loadingState.positions
    ? emptyState('Loading positions', 'Reading wallet portfolio.')
    : positions.map(positionRow).join('') || emptyState('No positions', 'Filled outcome balances will show here.');
  positionsList.querySelectorAll('[data-claim-market]').forEach(button => {
    button.addEventListener('click', handleClaimClick);
  });

  openOrdersList.innerHTML = loadingState.activity
    ? emptyState('Loading orders', 'Checking resting CLOB orders.')
    : openOrders.map(order => orderRow(order)).join('') || emptyState('No open orders', 'Resting signed orders will show here.');

  historyList.innerHTML = loadingState.activity
    ? emptyState('Loading history', 'Checking filled and cancelled orders.')
    : history.map(order => orderRow(order, fillsByOrder)).join('') || emptyState('No history', 'Filled and cancelled orders will show here.');
}

async function loadPortfolioActivity() {
  try {
    await refreshPortfolioActivity();
  } catch (error) {
    console.warn('Portfolio activity unavailable:', error);
    showToast(error.message || 'Orders and history unavailable');
  } finally {
    loadingState.activity = false;
    renderPortfolioDashboard();
  }
}

async function loadPortfolioPositions() {
  try {
    await refreshPortfolioPositions();
    applyConnectedWallet();
    renderTickets();
  } catch (error) {
    console.warn('Portfolio positions unavailable:', error);
    showToast(error.message || 'Positions unavailable');
  } finally {
    loadingState.positions = false;
    renderPortfolioDashboard();
  }
}

function positionRow(position) {
  return `
    <div class="dashboard-row">
      <div>
        <span class="ticket-side ${escapeHtml(String(position.side).toLowerCase())}">${escapeHtml(position.side)}</span>
        <strong>${escapeHtml(position.title)}</strong>
        <small>${position.amount.toFixed(2)} shares${position.tokenId ? ` - token ${escapeHtml(shortToken(position.tokenId))}` : ''}</small>
      </div>
      <div class="dashboard-row__actions">
        <b>${position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)} ${SYMBOL}</b>
        ${position.redeemable && position.marketId ? `<button class="claim-button" type="button" data-claim-market="${escapeHtml(position.marketId)}">Claim</button>` : ''}
      </div>
    </div>
  `;
}

async function handleClaimClick(event) {
  event.stopPropagation();
  const button = event.currentTarget;
  const marketId = button.dataset.claimMarket;
  if (!marketId || button.disabled) return;
  button.disabled = true;
  const previous = button.textContent;
  button.textContent = 'Claiming';
  try {
    await claimWinnings(marketId);
    showToast('Winnings claimed');
    await refreshPortfolioPositions();
    await refreshPortfolioActivity();
    applyConnectedWallet();
    renderTickets();
  } catch (error) {
    console.warn('Claim failed:', error);
    showToast(error.message || 'Claim failed');
  } finally {
    button.disabled = false;
    button.textContent = previous || 'Claim';
    renderPortfolioDashboard();
  }
}

function orderRow(order, fillsByOrder = new Map()) {
  const amount = Number(order.order?.makerAmount || order.remainingMaker || 0) / 1000000;
  const title = marketTitle(order);
  const txHash = fillsByOrder.get(order.id)?.transactionHash || order.transactionHash;
  const hashLabel = txHash ? shortHash(txHash) : shortHash(order.orderHash || order.id);
  return `
    <div class="dashboard-row">
      <div>
        <span class="ticket-side ${escapeHtml(String(order.outcomeSide || order.side || 'yes').toLowerCase())}">${escapeHtml(order.outcomeSide || order.side || 'ORDER')}</span>
        <strong>${escapeHtml(title)}</strong>
        <small>${escapeHtml(order.status || 'open')} - ${amount.toFixed(2)} ${SYMBOL}</small>
      </div>
      ${txHash ? `<a class="tx-link" href="${escapeHtml(txUrl(txHash))}" target="_blank" rel="noreferrer">${escapeHtml(hashLabel)}</a>` : `<b>${escapeHtml(hashLabel)}</b>`}
    </div>
  `;
}

function marketTitle(order) {
  if (order.market?.title) return order.market.title;
  const marketId = order.marketId || '';
  for (const match of gameMarkets) {
    const option = (match.options || []).find(item => item[4] === marketId);
    if (option?.[0]) return option[0];
  }
  return humanMarketLabel(marketId) || 'Market order';
}

function emptyState(title, text) {
  return `<div class="ticket-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function shortHash(value = '') {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function shortToken(value = '') {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function txUrl(hash) {
  return ARC_TX_EXPLORER ? `${ARC_TX_EXPLORER}${hash}` : "#";
}
