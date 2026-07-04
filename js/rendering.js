import { state } from './state.js';
import { sportLabels, marketVisuals } from './constants.js';
import { gameMarkets, playerPropMarkets, leagueMarkets, liveFeaturedMarkets, quickChoices } from './data.js';
import { escapeHtml, flagUrl, esportsLogoHtml, getInitials } from './utils.js';
import { apiGet } from './api.js';
import { setActive, optionRow } from './ui.js';
import { selectMarket } from './trading.js';

const gamesGrid = document.querySelector("#games-grid");
const featuredGames = document.querySelector("#featured-games");
const heroBanner = document.querySelector(".hero-banner");
const featuredStrip = document.querySelector(".featured-strip");
const playerMarketList = document.querySelector("#player-market-list");
const leagueFilter = document.querySelector("#league-filter");
const leagueSelector = document.querySelector("#league-selector");
const leagueMarketList = document.querySelector("#league-market-list");
const playerFilter = document.querySelector("#player-filter");
const playerSearch = document.querySelector("#player-search");
const matchPage = document.querySelector("#match-page");
const detailTitle = document.querySelector("#detail-title");
const detailMeta = document.querySelector("#detail-meta");
const detailId = document.querySelector("#detail-id");
const detailHomeFlag = document.querySelector("#detail-home-flag");
const detailAwayFlag = document.querySelector("#detail-away-flag");
const detailHomeCode = document.querySelector("#detail-home-code");
const detailAwayCode = document.querySelector("#detail-away-code");
const detailHomeTeam = detailHomeCode?.closest(".detail-team");
const detailAwayTeam = detailAwayCode?.closest(".detail-team");
const detailInsight = document.querySelector("#detail-insight");
const statsToggle = document.querySelector("#stats-toggle");
const detailTabs = document.querySelector("#detail-tabs");
const detailOptions = document.querySelector("#detail-options");
const heroTitle = document.querySelector("[data-hero-title]");
const heroKicker = document.querySelector(".wc-hero-eyebrow");
const heroCopy = document.querySelector("[data-hero-copy]");
const heroButton = document.querySelector("[data-hero-market]");
const heroHomeLogo = document.querySelector("[data-hero-home-logo]");
const heroAwayLogo = document.querySelector("[data-hero-away-logo]");
const heroBadges = document.querySelector("[data-hero-badges]");
const heroMarketCount = document.querySelector("[data-hero-market-count]");

const headlineTeamWeights = {
  Argentina: 100,
  Brazil: 100,
  France: 96,
  Spain: 94,
  Portugal: 92,
  England: 90,
  Germany: 88,
  Netherlands: 84,
  Uruguay: 82,
  Belgium: 78,
  Croatia: 76,
  Mexico: 74,
  USA: 74,
  Canada: 70,
  Morocco: 68,
  Japan: 66,
  Senegal: 66,
  Switzerland: 64,
  Colombia: 64,
  Australia: 60,
};

function updateWorldCupHeadlineHero() {
  if (!heroTitle || !heroButton) return;

  const cutoff = Date.now() - 3 * 60 * 60 * 1000;
  const candidates = gameMarkets
    .filter(match => match.sport === "football" && match.group === "world-cup")
    .filter(match => !match.fixture?.kickoffTime || new Date(match.fixture.kickoffTime).valueOf() >= cutoff)
    .sort(compareHeadlineMatches);

  const match = candidates[0];
  if (!match) return;

  const choices = quickChoices(match);
  const homeImg = match.homeLogoUrl || flagUrl(match.homeFlag);
  const awayImg = match.awayLogoUrl || flagUrl(match.awayFlag);
  const marketCount = match.options?.length || choices.length;

  if (heroKicker) heroKicker.textContent = "FIFA World Cup 2026 - Prediction Market";
  heroTitle.innerHTML = `${escapeHtml(match.home)}<br><span>vs</span><br>${escapeHtml(match.away)}`;
  if (heroCopy) {
    heroCopy.textContent = `${match.time} - ${marketCount} open markets.`;
  }
  if (heroBadges) {
    heroBadges.innerHTML = [match.homeCode, match.awayCode, "World Cup", "Arc Testnet"]
      .map(label => `<span>${escapeHtml(label)}</span>`)
      .join("");
  }
  if (heroMarketCount) heroMarketCount.textContent = String(marketCount);
  heroButton.dataset.heroMarket = match.id;
  heroButton.textContent = "Open market";

  if (heroHomeLogo) {
    heroHomeLogo.src = homeImg;
    heroHomeLogo.alt = `${match.home} badge`;
    heroHomeLogo.hidden = false;
  }
  if (heroAwayLogo) {
    heroAwayLogo.src = awayImg;
    heroAwayLogo.alt = `${match.away} badge`;
    heroAwayLogo.hidden = false;
  }
}

function compareHeadlineMatches(a, b) {
  const scoreDelta = headlineScore(b) - headlineScore(a);
  if (scoreDelta !== 0) return scoreDelta;
  return kickoffValue(a) - kickoffValue(b);
}

function headlineScore(match) {
  const homeWeight = headlineTeamWeights[match.home] || 50;
  const awayWeight = headlineTeamWeights[match.away] || 50;
  const marketDepth = Math.min(20, match.options?.length || 0);
  const liveBoost = match.isLive ? 25 : 0;
  return homeWeight + awayWeight + marketDepth + liveBoost;
}

function kickoffValue(match) {
  const value = match.fixture?.kickoffTime ? new Date(match.fixture.kickoffTime).valueOf() : Number.MAX_SAFE_INTEGER;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function renderGameTiles() {
  gamesGrid.innerHTML = "";
  featuredGames.innerHTML = "";
  playerMarketList.innerHTML = "";
  leagueMarketList.innerHTML = "";
  leagueFilter.innerHTML = "";
  leagueFilter.hidden = true;
  playerMarketList.hidden = true;
  leagueMarketList.hidden = true;
  leagueSelector.hidden = true;
  playerFilter.hidden = true;
  if (playerSearch) playerSearch.value = "";
  gamesGrid.hidden = false;
  gamesGrid.dataset.sport = state.sport;
  const activeMarkets = gameMarkets.filter(match => match.sport === state.sport);
  const sport = sportLabels[state.sport];
  const footballTabs = document.querySelectorAll(
    "#games-board [data-category='world-cup'], #games-board [data-category='international-friendly'], #games-board [data-category='leagues'], #games-board [data-category='players']"
  );
  const ufcTabs = document.querySelectorAll(
    "#games-board [data-category='ufc-men'], #games-board [data-category='ufc-women']"
  );
  footballTabs.forEach(tab => {
    tab.hidden = state.sport !== "football";
  });
  ufcTabs.forEach(tab => {
    tab.hidden = state.sport !== "ufc";
  });
  if (state.sport !== "football" && [...footballTabs].some(tab => tab.classList.contains("is-active"))) {
    const allTab = document.querySelector("#games-board [data-category='all']");
    setActive(document.querySelectorAll("#games-board .market-tabs button"), allTab);
  }
  if (state.sport !== "ufc" && [...ufcTabs].some(tab => tab.classList.contains("is-active"))) {
    const allTab = document.querySelector("#games-board [data-category='all']");
    setActive(document.querySelectorAll("#games-board .market-tabs button"), allTab);
  }
  document.querySelector("#games-board .section-head h2").textContent = `${sport.icon} ${sport.title}`;
  activeMarkets.forEach(match => {
    const categories = ["all"];
    if (match.isLive) categories.push("live");
    if (state.sport === "football") categories.push(footballCategoryForMatch(match));
    if (state.sport === "ufc") categories.push(match.group);
    const card = document.createElement("article");
    card.className = "match-row game-tile";
    card.dataset.matchId = match.id;
    card.dataset.marketCategory = categories.join(" ");
    card.dataset.leagueKey = match.leagueKey || "";
    card.dataset.search = `${match.home} ${match.away} ${match.homeCode} ${match.awayCode}`.toLowerCase();
    const visual = marketVisuals[match.id] || {};

    if (match.sport === "ufc") {
      const choices = quickChoices(match);
      card.className += " ufc-title-card";
      if (visual.eventArt) card.style.setProperty("--fight-art", `url("${visual.eventArt}")`);
      card.innerHTML = `
        <span class="fight-event-line">${match.isLive ? '<span class="status-dot live"></span><span class="live-label">LIVE</span> ' : ''}${escapeHtml(match.time)}</span>
        <div class="ufc-title-stage" aria-label="${escapeHtml(match.home)} versus ${escapeHtml(match.away)}">
          <article class="fighter-card is-home">
            ${visual.homeImage ? `<img class="fighter-image" src="${escapeHtml(visual.homeImage)}" alt="${escapeHtml(match.home)}" onerror="this.hidden=true" />` : ""}
            <div class="fighter-card-copy">
              <strong>${escapeHtml(match.home)}</strong>
              <button type="button">${escapeHtml(choices[0].label)}<span>${escapeHtml(choices[0].price)}</span></button>
            </div>
          </article>
          <b class="fight-vs">VS</b>
          <article class="fighter-card is-away">
            ${visual.awayImage ? `<img class="fighter-image" src="${escapeHtml(visual.awayImage)}" alt="${escapeHtml(match.away)}" onerror="this.hidden=true" />` : ""}
            <div class="fighter-card-copy">
              <strong>${escapeHtml(match.away)}</strong>
              <button type="button">${escapeHtml(choices[2].label)}<span>${escapeHtml(choices[2].price)}</span></button>
            </div>
          </article>
        </div>
        <button class="fight-distance-pick" type="button">${escapeHtml(choices[1].label)}<span>${escapeHtml(choices[1].price)}</span></button>
      `;
      card.querySelector(".fighter-card.is-home button").addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(choices[0].title, event.currentTarget, choices[0]);
      });
      card.querySelector(".fighter-card.is-away button").addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(choices[2].title, event.currentTarget, choices[2]);
      });
      card.querySelector(".fight-distance-pick").addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(choices[1].title, event.currentTarget, choices[1]);
      });
      card.addEventListener("click", () => openMatchPage(match.id));
      gamesGrid.appendChild(card);
      return;
    }

    if (match.sport === "formula-1") {
      const [eventName, eventDate] = match.time.split(" - ");
      card.className += " formula-event-card";
      card.innerHTML = `
        <img class="formula-event-art" src="${visual.eventImage}" alt="${eventName} Formula 1 race car" />
        <div class="formula-event-copy">
          <span>${eventName} - ${eventDate}</span>
          <strong>${eventName}</strong>
          <p>Driver winner market: ${match.home}</p>
          <small>${match.home} vs ${match.away} headline picks</small>
          <button type="button">Open race market</button>
        </div>
      `;
      card.querySelector("button").addEventListener("click", event => {
        event.stopPropagation();
        openMatchPage(match.id);
      });
      card.addEventListener("click", () => openMatchPage(match.id));
      gamesGrid.appendChild(card);
      return;
    }

    if (match.sport === "esports") {
      const choices = quickChoices(match);
      const teamChoices = [choices[0], choices[choices.length - 1]].filter(Boolean);
      card.classList.add("esports-event-card");
      const homeImg = match.homeLogoUrl || `https://placehold.co/36x36/0f172a/25d8e8?text=${encodeURIComponent(match.homeCode)}&font=roboto`;
      const awayImg = match.awayLogoUrl || `https://placehold.co/36x36/0f172a/25d8e8?text=${encodeURIComponent(match.awayCode)}&font=roboto`;
      card.innerHTML = `
        <div class="match-teams">
        <span class="match-meta-line">${sport.icon} ${match.isLive ? `<span class="status-dot live"></span><span class="live-label">LIVE</span> ${match.time}` : match.time} - ${sport.title.toUpperCase()}</span>
          <div class="matchup-sides esports-matchup" aria-label="${match.home} versus ${match.away}">
            <strong><img class="esports-team-logo" src="${homeImg}" alt="${match.home}" /> ${match.home}</strong>
            <strong>${match.away} <img class="esports-team-logo" src="${awayImg}" alt="${match.away}" /></strong>
            <b>VS</b>
          </div>
        </div>
        <div class="quick-odds esports-odds">
          ${teamChoices.map(choice => `<button class="${choice.cssClass || ""}" type="button" data-market-id="${choice.marketId || ""}" data-outcome-side="${choice.outcomeSide || ""}" data-disabled-reason="${escapeHtml(choice.disabledReason || "")}" ${choice.disabled ? "disabled aria-disabled=\"true\"" : ""}>${choice.label}<span>${choice.disabled ? "Closed" : choice.price}</span></button>`).join("")}
        </div>
      `;
      card.querySelectorAll(".quick-odds button").forEach((button, index) => {
        button.addEventListener("click", event => {
          event.stopPropagation();
          selectMarket(teamChoices[index].title, button, teamChoices[index]);
        });
      });
      card.addEventListener("click", () => openMatchPage(match.id));
      gamesGrid.appendChild(card);
      return;
    }

    const choices = quickChoices(match);
    const homeImg = match.homeLogoUrl || flagUrl(match.homeFlag);
    const awayImg = match.awayLogoUrl || flagUrl(match.awayFlag);
    card.innerHTML = `
      <div class="match-teams">
        <span class="match-meta-line">${sport.icon} ${escapeHtml(match.time)} - ${escapeHtml(sport.title.toUpperCase())}</span>
        <div class="matchup-sides" aria-label="${escapeHtml(match.home)} versus ${escapeHtml(match.away)}">
          <strong><img src="${escapeHtml(homeImg)}" alt="${escapeHtml(match.home)}" /> ${escapeHtml(match.home)}</strong>
          <b>VS</b>
          <strong><img src="${escapeHtml(awayImg)}" alt="${escapeHtml(match.away)}" /> ${escapeHtml(match.away)}</strong>
        </div>
      </div>
      <div class="quick-odds">
        ${choices.map(choice => `<button class="${escapeHtml(choice.cssClass || "")}" type="button" data-market-id="${escapeHtml(choice.marketId || "")}" data-outcome-side="${escapeHtml(choice.outcomeSide || "")}" data-disabled-reason="${escapeHtml(choice.disabledReason || "")}" ${choice.disabled ? "disabled aria-disabled=\"true\"" : ""}>${escapeHtml(choice.label)}<span>${escapeHtml(choice.disabled ? "Closed" : choice.price)}</span></button>`).join("")}
      </div>
    `;
    card.querySelectorAll(".quick-odds button").forEach((button, index) => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(choices[index].title, button, choices[index]);
      });
    });
    card.addEventListener("click", () => openMatchPage(match.id));
    gamesGrid.appendChild(card);
  });
  updateWorldCupHeadlineHero();
  renderLeagueFilterTabs();
  renderFeaturedMarkets("popular");
  renderPlayerPropMarkets();
  renderLeagueMarkets("premier-league");
  applyActiveBoardCategory();
}

function footballCategoryForMatch(match) {
  if (match.group === "leagues") return "leagues";
  if (match.group === "international-friendly") return "international-friendly";
  return "world-cup";
}

function renderLeagueFilterTabs() {
  const leagueMatches = gameMarkets.filter(match => match.sport === "football" && match.group === "leagues");
  if (!leagueMatches.length) return;
  const leagues = new Map();
  leagueMatches.forEach(match => {
    const key = match.leagueKey || slugifyLeague(match.leagueName || "Other Leagues");
    const name = match.leagueName || "Other Leagues";
    leagues.set(key, { key, name, count: (leagues.get(key)?.count || 0) + 1 });
  });
  const buttons = [{ key: "all", name: "All Leagues", count: leagueMatches.length }, ...leagues.values()];
  buttons.forEach((league, index) => {
    const button = document.createElement("button");
    const label = document.createElement("span");
    const count = document.createElement("b");
    button.type = "button";
    button.dataset.leagueFilter = league.key;
    button.classList.toggle("is-active", index === 0);
    label.textContent = league.name;
    count.textContent = league.count;
    button.append(label, count);
    button.addEventListener("click", () => {
      setActive(leagueFilter.querySelectorAll("button"), button);
      filterMatchRows("leagues");
    });
    leagueFilter.appendChild(button);
  });
}

function slugifyLeague(name) {
  return String(name || "other-leagues")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other-leagues";
}

function applyActiveBoardCategory() {
  const activeTab = document.querySelector("#games-board .market-tabs button.is-active");
  const category = activeTab?.dataset.category || (state.sport === "football" ? "world-cup" : "all");
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
  gamesGrid.hidden = false;
  playerMarketList.hidden = true;
  playerFilter.hidden = true;
  leagueFilter.hidden = category !== "leagues" || !leagueFilter.children.length;
  leagueSelector.hidden = true;
  leagueMarketList.hidden = true;
  filterMatchRows(category);
}

export function renderFeaturedMarkets(mode) {
  featuredGames.innerHTML = "";
  const activeMarkets = mode === "live"
    ? liveFeaturedMarkets
    : gameMarkets.filter(match => match.sport === state.sport).slice(0, 6);

  activeMarkets.forEach(match => {
    const sport = sportLabels[match.sport] || sportLabels.football;
    const featuredChoices = quickChoices(match);
    const featured = document.createElement("article");
    featured.className = "featured-card";
    if (featuredChoices.length === 3) featured.classList.add("featured-card--three-way");
    featured.dataset.search = `${match.home} ${match.away} ${match.homeCode} ${match.awayCode}`.toLowerCase();
    const homeImg = match.homeLogoUrl || flagUrl(match.homeFlag);
    const awayImg = match.awayLogoUrl || flagUrl(match.awayFlag);
    featured.innerHTML = `
      <span class="sport-icon">${sport.icon}</span>
      <span class="feature-time">${match.isLive ? '<span class="status-dot live"></span><span class="live-label">LIVE</span>' : match.time.toUpperCase()}</span>
      <div class="featured-flags">
        <img src="${homeImg}" alt="${match.home}" />
        <strong>VS</strong>
        <img src="${awayImg}" alt="${match.away}" />
      </div>
      <div class="featured-names"><span>${match.home}</span><span>${match.away}</span></div>
      <div class="featured-odds">
        ${featuredChoices.map(choice => `<button class="${choice.cssClass || ""}" type="button" data-market-id="${choice.marketId || ""}" data-outcome-side="${choice.outcomeSide || ""}" data-disabled-reason="${escapeHtml(choice.disabledReason || "")}" ${choice.disabled ? "disabled aria-disabled=\"true\"" : ""}>${choice.label}<b>${choice.disabled ? "Closed" : choice.price}</b></button>`).join("")}
      </div>
    `;
    featured.querySelectorAll(".featured-odds button").forEach((button, index) => {
      button.addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(featuredChoices[index].title, button, featuredChoices[index]);
      });
    });
    if (match.id) featured.addEventListener("click", () => openMatchPage(match.id));
    featuredGames.appendChild(featured);
  });
}

export function renderPlayerPropMarkets() {
  playerMarketList.innerHTML = "";
  playerPropMarkets.forEach(player => {
    const card = document.createElement("article");
    card.className = "player-prop-card";
    card.dataset.search = `${player.name} ${player.country} ${player.title} ${player.label}`.toLowerCase();
    card.dataset.player = player.name.toLowerCase().replaceAll(" ", "-");
    card.innerHTML = `
      <div class="player-prop-image" data-initials="${escapeHtml(getInitials(player.name))}" data-fallback-name="${escapeHtml(player.name)}">
        ${player.image ? `<img src="${escapeHtml(player.image)}" alt="${escapeHtml(player.name)}" />` : ""}
      </div>
      <div class="player-prop-copy">
        <span>${escapeHtml(player.country)} - ${escapeHtml(player.label)}</span>
        <h3>${escapeHtml(player.title)}</h3>
        <small>${escapeHtml(player.name)}</small>
      </div>
      <div class="player-prop-prices">
        <button class="price up" type="button">Yes ${Number(player.yes)}c</button>
        <button class="price down" type="button">No ${Number(player.no)}c</button>
      </div>
    `;
    const imageWrap = card.querySelector(".player-prop-image");
    const image = card.querySelector("img");
    if (image) {
      image.addEventListener("load", () => imageWrap.classList.remove("image-failed"));
      image.addEventListener("error", () => {
        imageWrap.classList.add("image-failed");
        image.hidden = true;
      });
    } else {
      imageWrap.classList.add("image-failed");
    }
    card.querySelector(".price.up")?.addEventListener("click", () =>
      selectMarket(`${player.name} - ${player.title}`, card.querySelector(".price.up"), {
        marketId: player.marketId,
        outcomeSide: "YES",
        marketScope: player.marketScope,
        backendMarketId: player.backendMarketId
      })
    );
    card.querySelector(".price.down")?.addEventListener("click", () =>
      selectMarket(`${player.name} - ${player.title}`, card.querySelector(".price.down"), {
        marketId: player.marketId,
        outcomeSide: "NO",
        marketScope: player.marketScope,
        backendMarketId: player.backendMarketId
      })
    );
    card.addEventListener("click", event => {
      if (event.target.closest(".price")) return;
      openPlayerFuturePage(player);
    });
    playerMarketList.appendChild(card);
  });
}

function openPlayerFuturePage(player) {
  document.body.classList.remove("is-history-page");
  document.body.classList.add("is-match-open");
  document.querySelectorAll(".home-section").forEach(section => (section.hidden = true));
  document.querySelector("#history-page").hidden = true;
  document.querySelector("#positions-dashboard").hidden = true;
  matchPage.hidden = false;

  detailTitle.textContent = `${player.name} - ${player.title}`;
  detailMeta.textContent = `${player.label}${player.country ? ` - ${player.country}` : ""} - Player futures market`;
  detailHomeFlag.hidden = true;
  detailAwayFlag.hidden = true;
  if (detailHomeTeam) detailHomeTeam.hidden = true;
  if (detailAwayTeam) detailAwayTeam.hidden = true;
  detailHomeFlag.removeAttribute("src");
  detailAwayFlag.removeAttribute("src");
  detailHomeCode.textContent = "";
  detailAwayCode.textContent = "";
  detailInsight.hidden = true;
  detailInsight.innerHTML = "";
  statsToggle.hidden = true;
  statsToggle.setAttribute("aria-expanded", "false");
  detailTabs.innerHTML = "";
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "is-active";
  tab.textContent = "Market";
  detailTabs.appendChild(tab);

  detailOptions.innerHTML = "";
  detailOptions.appendChild(optionRow(
    `${player.name} - ${player.title}`,
    player.label,
    player.yes,
    player.no,
    player.marketId,
    "YES",
    "Yes",
    "NO",
    "No"
  ));
  scrollDetailToTop();
}

function scrollDetailToTop() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

export function renderLeagueMarkets(leagueKey) {
  const league = leagueMarkets[leagueKey] || leagueMarkets["premier-league"];
  leagueMarketList.innerHTML = "";
  if (!league?.clubs?.length) {
    leagueSelector.hidden = true;
    leagueMarketList.hidden = true;
    return;
  }
  league.clubs.forEach((match, index) => {
    const yes = 38 + ((index * 7) % 24);
    const no = 100 - yes;
    const card = document.createElement("article");
    card.className = "league-match-card";
    card.innerHTML = `
      <span class="match-meta-line">${league.title.toUpperCase()} - ${index === 0 ? "Featured" : "Upcoming"}</span>
      <div class="league-clubs">
        <div><img src="${match.homeLogo}" alt="${match.home} logo" /><strong>${match.home}</strong></div>
        <b>VS</b>
        <div><img src="${match.awayLogo}" alt="${match.away} logo" /><strong>${match.away}</strong></div>
      </div>
      <div class="quick-odds">
        <button type="button">${match.homeCode}<span>${(2.05 + index * 0.12).toFixed(2)}</span></button>
        <button type="button">Draw<span>${(3.1 + index * 0.08).toFixed(2)}</span></button>
        <button type="button">${match.awayCode}<span>${(2.45 + index * 0.11).toFixed(2)}</span></button>
      </div>
      <div class="league-market-prices">
        <button class="price up" type="button">Yes ${yes}c</button>
        <button class="price down" type="button">No ${no}c</button>
      </div>
    `;
    card.querySelectorAll(".quick-odds button").forEach((button, buttonIndex) => {
      const title = buttonIndex === 0 ? `${match.home} to win` : buttonIndex === 1 ? `${match.home} vs ${match.away} to end in a draw` : `${match.away} to win`;
      button.addEventListener("click", event => {
        event.stopPropagation();
        selectMarket(title, button);
      });
    });
    card.querySelectorAll(".price").forEach(button => {
      button.addEventListener("click", () => selectMarket(`${match.home} vs ${match.away}`, button));
    });
    leagueMarketList.appendChild(card);
  });
}

export function renderMatchInsight(match, insights) {
  detailInsight.innerHTML = "";
  detailInsight.hidden = true;
  statsToggle.hidden = true;
  statsToggle.setAttribute("aria-expanded", "false");
  statsToggle.textContent = "STATS";

  let hasContent = false;

  if (match.sport === "formula-1") {
    const visual = marketVisuals[match.id] || {};
    const [eventName, eventDate] = match.time.split(" - ");
    detailInsight.innerHTML = `
      <article class="formula-detail-insight">
        <img src="${visual.eventImage}" alt="${eventName} Formula 1 race car" />
        <div>
          <span>Formula 1 event</span>
          <h3>${eventName}</h3>
          <p>${eventDate} - One proposed winner market for this race.</p>
          <strong>${match.home} to win the Grand Prix</strong>
        </div>
      </article>
    `;
    hasContent = true;
  } else if (insights) {
    const h2h = insights.headToHead;
    const standings = insights.standings;
    const lastMeetings = insights.lastMeetings || [];
    const homeStanding = standings && standings.home;
    const awayStanding = standings && standings.away;

    detailInsight.innerHTML = `
      <div class="insight-topline">
        <span>${match.home}</span>
        <strong>Matchup</strong>
        <span>${match.away}</span>
      </div>
      <div class="insight-grid">
        <article class="form-card">
          ${homeStanding ? `<div class="form-ring is-home" style="--form:${Math.min(100, (homeStanding.points / Math.max(1, homeStanding.played || 1) * 20))}%"><strong>${homeStanding.rank}</strong><span>Rank</span></div>` : '<div class="form-ring is-home" style="--form:50%"><strong>-</strong><span>Rank</span></div>'}
          <h3>${match.home}</h3>
          ${homeStanding ? `<p>${homeStanding.wins}-${homeStanding.draws}-${homeStanding.losses} - ${homeStanding.points} pts</p>` : ''}
        </article>
        <article class="rank-card">
          <span>Head to Head</span>
          ${h2h ? `<div class="rank-bars"><div><b>${h2h.homeWins}</b><small>${match.homeCode} wins</small></div><div><b>${h2h.draws}</b><small>Draws</small></div><div><b>${h2h.awayWins}</b><small>${match.awayCode} wins</small></div></div>` : '<p>No prior meetings</p>'}
        </article>
        <article class="form-card">
          ${awayStanding ? `<div class="form-ring is-away" style="--form:${Math.min(100, (awayStanding.points / Math.max(1, awayStanding.played || 1) * 20))}%"><strong>${awayStanding.rank}</strong><span>Rank</span></div>` : '<div class="form-ring is-away" style="--form:50%"><strong>-</strong><span>Rank</span></div>'}
          <h3>${match.away}</h3>
          ${awayStanding ? `<p>${awayStanding.wins}-${awayStanding.draws}-${awayStanding.losses} - ${awayStanding.points} pts</p>` : ''}
        </article>
      </div>
      ${lastMeetings.length > 0 ? `
      <details class="recent-board">
        <summary>Last ${lastMeetings.length} meetings</summary>
        <div class="recent-columns">
          <article class="recent-team-card">
            ${lastMeetings.map(m => `<div class="result-row"><span class="result-badge is-${m.homeGoals > m.awayGoals ? 'w' : m.homeGoals === m.awayGoals ? 'd' : 'l'}">${m.homeGoals > m.awayGoals ? 'W' : m.homeGoals === m.awayGoals ? 'D' : 'L'}</span><span>${m.homeTeam} ${m.homeGoals}-${m.awayGoals} ${m.awayTeam}</span><span class="result-opponent">${new Date(m.date).toLocaleDateString()}</span></div>`).join("")}
          </article>
        </div>
      </details>` : ''}
    `;
    hasContent = true;
  }

  if (hasContent) {
    statsToggle.hidden = false;
  }
}

export async function openMatchPage(matchId) {
  const match = gameMarkets.find(item => item.id === matchId);
  if (!match) return;
  document.body.classList.remove("is-history-page");
  document.querySelectorAll(".home-section").forEach(section => (section.hidden = true));
  document.querySelector("#history-page").hidden = true;
  document.querySelector("#positions-dashboard").hidden = true;
  matchPage.hidden = false;
  document.body.classList.add("is-match-open");
  detailTitle.textContent = match.sport === "formula-1"
    ? `${match.time.split(" - ")[0]} winner market`
    : `${match.home} vs ${match.away}`;
  detailMeta.textContent = `${match.time} - Prediction markets available`;
  detailHomeFlag.hidden = match.sport === "formula-1";
  detailAwayFlag.hidden = match.sport === "formula-1";
  if (detailHomeTeam) detailHomeTeam.hidden = false;
  if (detailAwayTeam) detailAwayTeam.hidden = false;
  if (match.sport !== "formula-1") {
    detailHomeFlag.src = match.homeLogoUrl || flagUrl(match.homeFlag);
    detailHomeFlag.alt = match.home;
    detailAwayFlag.src = match.awayLogoUrl || flagUrl(match.awayFlag);
    detailAwayFlag.alt = match.away;
  } else {
    detailHomeFlag.removeAttribute("src");
    detailAwayFlag.removeAttribute("src");
    detailHomeFlag.alt = "";
    detailAwayFlag.alt = "";
  }
  detailHomeCode.textContent = match.homeCode;
  detailAwayCode.textContent = match.awayCode;
  let insights;
  if (match.fixture && match.fixture.source && match.fixture.source.provider === "api-football") {
    try {
      const res = await apiGet('/fixtures/' + match.id + '/insights');
      insights = res.insights;
    } catch (e) {
      /* insights unavailable */
    }
  }
  renderMatchInsight(match, insights);
  statsToggle.onclick = () => {
    const expanded = statsToggle.getAttribute("aria-expanded") === "true";
    statsToggle.setAttribute("aria-expanded", !expanded);
    detailInsight.hidden = expanded;
  };
  renderDetailTabs(match);
  renderDetailOptions(match, "All");
  const firstBtn = detailOptions.querySelector(".option-row .price:not(:disabled)");
  if (firstBtn) firstBtn.click();
  scrollDetailToTop();

}

export function showHome() {
  document.body.classList.remove("is-match-open", "is-history-page");
  matchPage.hidden = true;
  document.querySelector("#history-page").hidden = true;
  document.querySelector("#positions-dashboard").hidden = true;
  document.querySelectorAll(".home-section").forEach(section => (section.hidden = false));
  syncSportHero();

}

export function syncSportHero() {
  const useCompactLanding = state.sport === "formula-1" || state.sport === "ufc" || state.sport === "esports";
  if (heroBanner) heroBanner.hidden = useCompactLanding;
  if (featuredStrip) featuredStrip.hidden = useCompactLanding;
}

export function renderDetailTabs(match) {
  const groups = ["All", ...new Set(match.options.map(option => option[1]))];
  detailTabs.innerHTML = "";
  groups.forEach((group, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = group;
    button.classList.toggle("is-active", index === 0);
    button.addEventListener("click", () => {
      setActive(detailTabs.querySelectorAll("button"), button);
      renderDetailOptions(match, group);
    });
    detailTabs.appendChild(button);
  });
}

export function renderDetailOptions(match, group) {
  detailOptions.innerHTML = "";
  match.options
    .filter(option => group === "All" || option[1] === group)
    .forEach(([title, label, yes, no, marketId, upSide, upLabel, downSide, downLabel, disabledReason]) =>
      detailOptions.appendChild(optionRow(title, label, yes, no, marketId, upSide, upLabel, downSide, downLabel, disabledReason))
    );
}

export function filterMatchRows(category) {
  gamesGrid.querySelector(".market-empty-state")?.remove();
  let visibleCount = 0;
  const activeLeagueKey = category === "leagues"
    ? leagueFilter?.querySelector(".is-active")?.dataset.leagueFilter || "all"
    : "all";
  document.querySelectorAll("#games-grid [data-market-category]").forEach(item => {
    const categories = item.dataset.marketCategory?.split(" ") || [];
    const categoryHidden = Boolean(category) && !categories.includes(category);
    const leagueHidden = category === "leagues" && activeLeagueKey !== "all" && item.dataset.leagueKey !== activeLeagueKey;
    item.hidden = categoryHidden || leagueHidden;
    if (!item.hidden) visibleCount += 1;
  });
  if (visibleCount > 0) return;
  const empty = document.createElement("article");
  empty.className = "market-empty-state";
  empty.textContent = category === "leagues"
    ? "No tradable league matches are open right now."
    : "No markets are open in this view right now.";
  gamesGrid.appendChild(empty);
}

export function applyPlayerSearch() {
  const query = playerSearch?.value.trim().toLowerCase() || "";
  document.querySelectorAll("#player-market-list .player-prop-card").forEach(card => {
    card.hidden = query.length > 0 && !card.dataset.search.includes(query);
  });
}

export function initializeImageFallbacks() {
  document.querySelectorAll(".hero-player-card img").forEach(image => {
    image.addEventListener("error", () => {
      image.hidden = true;
    });
  });
}
