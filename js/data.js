export let gameMarkets = [];
export let playerPropMarkets = [];
export let leagueMarkets = {};
export let liveFeaturedMarkets = [];

export function replaceGameMarkets(newMarkets) {
  gameMarkets = newMarkets;
}

export function replaceLiveFeaturedMarkets(newMarkets) {
  liveFeaturedMarkets = newMarkets;
}

export function replacePlayerPropMarkets(newMarkets) {
  playerPropMarkets = newMarkets;
}

export function replaceLeagueMarkets(newMarkets) {
  leagueMarkets = newMarkets;
}

export function game(id, home, away, homeFlag, awayFlag, homeCode, awayCode, time, marketId, sport = "football", group = "leagues") {
  return {
    id, sport, group, home, away, homeFlag, awayFlag, homeCode, awayCode, time, marketId,
    liquidity: `$${Math.floor(75 + Math.random() * 160)}.${Math.floor(Math.random() * 9)}k liquidity`,
    options: buildGameOptions(home, away, sport),
  };
}

function playerProp(name, country, image, title, label, yes, no) {
  return { name, country, image, title, label, yes, no };
}

function club(home, away, homeLogo, awayLogo, homeCode, awayCode) {
  return { home, away, homeLogo, awayLogo, homeCode, awayCode };
}

function featuredMarket(home, away, homeFlag, awayFlag, homeCode, awayCode, time, sport) {
  return { home, away, homeFlag, awayFlag, homeCode, awayCode, time, sport };
}

export function quickChoices(match) {
  if (match.quick?.length) return match.quick;
  if (match.sport === "basketball") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} to win` },
      { label: "O/U", price: "3.30", title: "Total points over 169.5" },
      { label: match.awayCode, price: "2.65", title: `${match.away} to win` },
    ];
  }
  if (match.sport === "cricket") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} to win` },
      { label: "Sixes", price: "3.30", title: "Match total over 12.5 sixes" },
      { label: match.awayCode, price: "2.65", title: `${match.away} to win` },
    ];
  }
  if (match.sport === "tennis") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} to win the match` },
      { label: "Sets", price: "3.30", title: "Match goes to 3+ sets" },
      { label: match.awayCode, price: "2.65", title: `${match.away} to win the match` },
    ];
  }
  if (match.sport === "formula-1") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} finishes ahead of ${match.away}` },
      { label: "Podium", price: "3.30", title: `${match.home} reaches the podium` },
      { label: match.awayCode, price: "2.65", title: `${match.away} finishes ahead of ${match.home}` },
    ];
  }
  if (match.sport === "ufc") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} to win` },
      { label: "Distance", price: "3.30", title: "Fight goes the distance" },
      { label: match.awayCode, price: "2.65", title: `${match.away} to win` },
    ];
  }
  if (match.sport === "esports") {
    return [
      { label: match.homeCode, price: "2.10", title: `${match.home} to win the series` },
      { label: "Map 3", price: "3.30", title: "Series goes to map 3" },
      { label: match.awayCode, price: "2.65", title: `${match.away} to win the series` },
    ];
  }
  return [
    { label: match.homeCode, price: "2.10", title: `${match.home} to win` },
    { label: "Draw", price: "3.30", title: `${match.home} vs ${match.away} to end in a draw` },
    { label: match.awayCode, price: "2.65", title: `${match.away} to win` },
  ];
}

function buildGameOptions(home, away, sport) {
  if (sport === "basketball") return buildBasketballOptions(home, away);
  if (sport === "cricket") return buildCricketOptions(home, away);
  if (sport === "tennis") return buildTennisOptions(home, away);
  if (sport === "formula-1") return buildFormulaOneOptions(home, away);
  if (sport === "ufc") return buildUfcOptions(home, away);
  if (sport === "esports") return buildEsportsOptions(home, away);

  const keyHomePlayer = home === "Argentina" ? "Messi" : home === "France" ? "Mbappé" : home === "Portugal" ? "Ronaldo" : `${home} striker`;
  const keyAwayPlayer = away === "Argentina" ? "Messi" : away === "France" ? "Mbappé" : away === "Portugal" ? "Ronaldo" : `${away} winger`;
  return [
    [`${home} to win`, "Main", 45, 55],
    [`${away} to win`, "Main", 37, 63],
    [`${home} vs ${away} to end in a draw`, "Main", 29, 71],
    [`${home} vs ${away} over 2.5 goals`, "Goals", 54, 46],
    [`${home} vs ${away} under 2.5 goals`, "Goals", 42, 58],
    [`${home} to score first`, "Goals", 52, 48],
    [`1st half draw`, "Half", 38, 62],
    [`${home} to lead at half time`, "Half", 34, 66],
    [`Over 3.5 total cards`, "Bookings", 61, 39],
    [`${away} to get the next yellow card`, "Bookings", 44, 56],
    [`9+ total corners`, "Corners", 55, 45],
    [`${home} 5+ corners`, "Corners", 47, 53],
    [`Both teams to score and over 2.5`, "Combo", 33, 67],
    [`Penalty awarded in the match`, "Combo", 21, 79],
    [`${keyHomePlayer} to score or assist`, "Players", 44, 56],
    [`${keyAwayPlayer} to receive a yellow card`, "Players", 19, 81],
    [`${home} goalkeeper 3+ saves`, "Players", 36, 64],
    [`${home} to win 11+ free kicks`, "Teams", 51, 49],
    [`${away} to have 5+ shots on target`, "Teams", 43, 57],
    [`Goal before 20:00`, "Minutes", 33, 67],
  ];
}

function buildBasketballOptions(home, away) {
  return [
    [`${home} moneyline`, "Main", 54, 46],
    [`${away} moneyline`, "Main", 42, 58],
    [`${home} -5.5 spread`, "Main", 47, 53],
    [`Total points over 169.5`, "Points", 51, 49],
    [`Total points under 169.5`, "Points", 49, 51],
    [`${home} to win first quarter`, "Quarters", 52, 48],
    [`${away} to score 25+ in Q1`, "Quarters", 36, 64],
    [`Over 18.5 made threes`, "Team Stats", 45, 55],
    [`${home} 42+ rebounds`, "Team Stats", 44, 56],
    [`${away} 20+ assists`, "Team Stats", 57, 43],
    [`Star guard 25+ points`, "Players", 48, 52],
    [`Center 10+ rebounds`, "Players", 55, 45],
    [`Player to record double-double`, "Players", 39, 61],
    [`Game goes to overtime`, "Combo", 12, 88],
  ];
}

function buildCricketOptions(home, away) {
  return [
    [`${home} to win`, "Main", 52, 48],
    [`${away} to win`, "Main", 48, 52],
    [`${home} to win the toss`, "Toss", 50, 50],
    [`${home} powerplay over 42.5 runs`, "Runs", 54, 46],
    [`${away} innings over 149.5 runs`, "Runs", 49, 51],
    [`Match total over 12.5 sixes`, "Boundaries", 43, 57],
    [`${home} to score the first boundary`, "Boundaries", 51, 49],
    [`${away} first wicket before 4.5 overs`, "Wickets", 37, 63],
    [`A player scores 50+ runs`, "Players", 58, 42],
    [`Bowler takes 3+ wickets`, "Players", 39, 61],
    [`Highest partnership over 64.5 runs`, "Combo", 47, 53],
    [`Match decided in the final over`, "Combo", 26, 74],
  ];
}

function buildTennisOptions(home, away) {
  return [
    [`${home} to win the match`, "Winner", 52, 48],
    [`${away} to win the match`, "Winner", 48, 52],
    [`Match decided in straight sets`, "Sets", 44, 56],
    [`Match goes to 3+ sets`, "Sets", 56, 44],
    [`${home} wins first set`, "Sets", 54, 46],
    [`${away} wins first set`, "Sets", 46, 54],
    [`Total games over 22.5`, "Games", 51, 49],
    [`Total games under 22.5`, "Games", 49, 51],
    [`${home} holds serve 80%+ of games`, "Serve", 47, 53],
    [`A tiebreak is played`, "Games", 38, 62],
    [`${home} wins in 2 sets`, "Combo", 39, 61],
    [`${away} comeback after losing first set`, "Combo", 22, 78],
  ];
}

function buildEsportsOptions(home, away) {
  return [
    [`${home} to win the series`, "Winner", 55, 45],
    [`${away} to win the series`, "Winner", 45, 55],
    [`${home} wins map 1`, "Maps", 53, 47],
    [`${away} wins map 1`, "Maps", 47, 53],
    [`Series goes to map 3`, "Maps", 49, 51],
    [`${home} wins 2-0`, "Series", 34, 66],
    [`${away} wins 2-0`, "Series", 28, 72],
    [`${home} wins 2-1`, "Series", 21, 79],
    [`${home} total rounds over 25.5`, "Rounds", 52, 48],
    [`${away} opens pistol round`, "Rounds", 50, 50],
    [`${home} first blood on map 1`, "First", 36, 64],
    [`Overtime played on any map`, "Combo", 31, 69],
  ];
}

function buildFormulaOneOptions(home, away) {
  return [
    [`${home} to win the Grand Prix`, "Winner", 41, 59],
  ];
}

function buildUfcOptions(home, away) {
  return [
    [`${home} to win`, "Main", 53, 47],
    [`${away} to win`, "Main", 47, 53],
    [`Fight goes the distance`, "Rounds", 42, 58],
    [`Fight ends before round 3`, "Rounds", 46, 54],
    [`${home} wins by KO or TKO`, "Method", 31, 69],
    [`${away} wins by submission`, "Method", 22, 78],
    [`Either fighter scores a knockdown`, "Striking", 44, 56],
    [`${home} lands 60+ significant strikes`, "Striking", 51, 49],
    [`${away} records 2+ takedowns`, "Grappling", 36, 64],
    [`Performance bonus for this bout`, "Combo", 18, 82],
  ];
}
