import { state } from './state.js';
import { sportLabels, WC_ANIMS } from './constants.js';
import { showToast, setActive, showTrade, showPositions, closePnlCard } from './ui.js';
import { showHome, renderGameTiles, renderFeaturedMarkets, syncSportHero, renderLeagueMarkets, filterMatchRows, applyPlayerSearch, openMatchPage } from './rendering.js';
import { markPositionsSeen, renderHistoryPage } from './trading.js';

export function wireNavigation() {
  document.querySelectorAll("[data-action='home']").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      showHome();
      document.querySelector("#games-board")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll("[data-action='back-home']").forEach(button => {
    button.addEventListener("click", showHome);
  });

  const wcBtn = document.getElementById("wc26-orb");
  function wcPlayRandom() {
    if (!wcBtn) return;
    wcBtn.classList.remove(...WC_ANIMS);
    void wcBtn.offsetWidth;
    wcBtn.classList.add(WC_ANIMS[Math.floor(Math.random() * WC_ANIMS.length)]);
    wcBtn.addEventListener("animationend", () => wcBtn.classList.remove(...WC_ANIMS), { once: true });
  }
  wcBtn?.addEventListener("click", event => {
    event.stopPropagation();
    wcPlayRandom();
  });
  function scheduleIdleAnim() {
    const delay = 14000 + Math.random() * 20000;
    setTimeout(() => {
      if (Math.random() < 0.55) wcPlayRandom();
      scheduleIdleAnim();
    }, delay);
  }
  scheduleIdleAnim();
  document.querySelectorAll("[data-hero-market]").forEach(button => {
    button.addEventListener("click", () => openMatchPage(button.dataset.heroMarket));
  });
}

export function wireTopSportNav() {
  document.querySelectorAll(".top-sport-nav button").forEach(button => {
    button.addEventListener("click", () => {
      state.sport = button.dataset.sport;
      const defaultCategory = "all";
      setActive(document.querySelectorAll(".top-sport-nav button"), button);
      setActive(document.querySelectorAll("#games-board .market-tabs button"), document.querySelector(`#games-board [data-category='${defaultCategory}']`));
      document.querySelector(".search-box input").value = "";
      showHome();
      renderGameTiles();

    });
  });
}

export function wireBoardTabs() {
  document.querySelectorAll(".market-board").forEach(board => {
    const tabs = board.querySelectorAll(".market-tabs button");
    tabs.forEach(button => {
      button.addEventListener("click", () => {
        setActive(tabs, button);
        const category = button.dataset.category;
        const gamesGrid = document.querySelector("#games-grid");
        const playerMarketList = document.querySelector("#player-market-list");
        const playerFilter = document.querySelector("#player-filter");
        const playerSearch = document.querySelector("#player-search");
        const leagueFilter = document.querySelector("#league-filter");
        const leagueSelector = document.querySelector("#league-selector");
        const leagueMarketList = document.querySelector("#league-market-list");
        if (category === "players") {
          gamesGrid.hidden = true;
          leagueFilter.hidden = true;
          leagueSelector.hidden = true;
          leagueMarketList.hidden = true;
          playerMarketList.hidden = false;
          playerFilter.hidden = false;
          applyPlayerSearch();
          return;
        }
        if (category === "leagues") {
          gamesGrid.hidden = false;
          playerMarketList.hidden = true;
          playerFilter.hidden = true;
          leagueFilter.hidden = !leagueFilter.children.length;
          leagueSelector.hidden = true;
          leagueMarketList.hidden = true;
          filterMatchRows("leagues");
          return;
        }
        gamesGrid.hidden = false;
        playerMarketList.hidden = true;
        playerFilter.hidden = true;
        leagueFilter.hidden = true;
        leagueSelector.hidden = true;
        leagueMarketList.hidden = true;
        if (playerSearch) playerSearch.value = "";
        filterMatchRows(category);
      });
    });
  });

  document.querySelectorAll(".league-panel").forEach(button => {
    button.addEventListener("click", () => {
      setActive(document.querySelectorAll(".league-panel"), button);
      renderLeagueMarkets(button.dataset.league);
    });
  });
}

export function wireDashboardTools() {
  const searchInput = document.querySelector(".search-box input");
  const featuredScroller = document.querySelector("#featured-games");
  const carouselButtons = document.querySelectorAll(".compact-section-head > div:last-child button");
  const featuredModeButtons = document.querySelectorAll("[data-featured-mode]");
  const playerSearch = document.querySelector("#player-search");

  searchInput?.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    document.querySelectorAll("[data-search]").forEach(item => {
      item.hidden = query.length > 0 && !item.dataset.search.includes(query);
    });
  });

  playerSearch?.addEventListener("input", () => {
    applyPlayerSearch();
  });

  carouselButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      const direction = index === 0 ? -1 : 1;
      featuredScroller?.scrollBy({ left: direction * 360, behavior: "smooth" });
    });
  });

  featuredModeButtons.forEach(button => {
    button.addEventListener("click", () => {
      setActive(featuredModeButtons, button);
      renderFeaturedMarkets(button.dataset.featuredMode);
    });
  });
}

export function wireFooterLinks() {
  document.querySelectorAll("[data-footer-action]").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      const action = link.dataset.footerAction;
      if (action === "markets") {
        document.querySelector(".top-sport-nav")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (action === "how") {
        document.querySelector(".hero-banner, .match-list")?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      if (action === "wallet") {
        document.querySelector(".footer-socials")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      if (action === "faq") {
        return;
      }
      if (action === "terms") {
        return;
      }
      if (action === "privacy") {
        return;
      }
    });
  });
}

export function wireSlipTabs() {
  document.querySelectorAll(".slip-tabs button").forEach(button => {
    button.addEventListener("click", () => {
      setActive(document.querySelectorAll(".slip-tabs button"), button);
      if (button.classList.contains("positions-tab")) {
        showPositions();
        markPositionsSeen();
      } else {
        showTrade();
      }
    });
  });
}

export function wireSideToggle() {
  const sideButtons = document.querySelectorAll(".side-toggle button");
  sideButtons.forEach(button => {
    button.addEventListener("click", () => {
      state.side = button.textContent.trim();
      if (state.pendingTicket) state.pendingTicket.side = state.side;
      setActive(sideButtons, button);
      showToast(`${state.side} side selected`);
    });
  });
}

export function wireOutsideClose() {
  document.addEventListener("click", event => {
    const profileDropdown = document.querySelector(".profile-dropdown");
    if (!event.target.closest(".profile-menu")) profileDropdown.hidden = true;

    const clickedTradeSlip = event.target.closest(".trade-slip");
    const clickedMarketPrice = event.target.closest(".price");
    const clickedProfileMenu = event.target.closest(".profile-menu");
    if (!clickedTradeSlip && !clickedMarketPrice && !clickedProfileMenu) {
      showTrade();
    }
  });
}

export function wirePnlModal() {
  document.querySelectorAll("[data-action='close-pnl']").forEach(button => {
    button.addEventListener("click", closePnlCard);
  });

  document.addEventListener("keydown", event => {
    const pnlModal = document.querySelector("#pnl-modal");
    if (event.key === "Escape" && !pnlModal.hidden) {
      closePnlCard();
    }
  });
}
