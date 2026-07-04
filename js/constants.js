export const DEFAULT_API_BASE_URL = "https://x-cup-backend-production.up.railway.app";
export const LOCAL_API_BASE_URL = "http://127.0.0.1:3000";

function normalizeApiBaseUrl(url) {
  return String(url || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  return normalizeApiBaseUrl(
    window.XSPORTY_API_BASE_URL ||
    window.XCUP_API_BASE_URL ||
    localStorage.getItem("xsporty-api-base-url") ||
    localStorage.getItem("x-cup-api-base-url") ||
    DEFAULT_API_BASE_URL
  );
}

export const API_BASE_URL = getApiBaseUrl();

export const sportLabels = {
  football: { title: "Football", icon: "\u26BD" },
  basketball: { title: "Basketball", icon: "\u{1F3C0}" },
  cricket: { title: "Cricket", icon: "\u{1F3CF}" },
  tennis: { title: "Tennis", icon: "\u{1F3BE}" },
  "formula-1": { title: "Formula 1", icon: "\u{1F3CE}\uFE0F" },
  ufc: { title: "UFC", icon: "\u{1F94A}" },
  esports: { title: "Esports", icon: "\u{1F3AE}" },
};

export const SYMBOL = 'USDC';
export const ARC_TX_EXPLORER = window.XSPORTY_ARC_EXPLORER_URL ? `${window.XSPORTY_ARC_EXPLORER_URL.replace(/\/$/, "")}/tx/` : "";
export const marketVisuals = {
  "ufc-makhachev-volkanovski": {
    homeImage: "https://commons.wikimedia.org/wiki/Special:FilePath/Islam_Makhachev_2022_UFC_belt_%28cropped%29.png?width=720",
    awayImage: "https://commons.wikimedia.org/wiki/Special:FilePath/Alexander_Volkanovski_at_UFC_232.jpg?width=720",
  },
  "ufc-pereira-prochazka": {
    homeImage: "https://commons.wikimedia.org/wiki/Special:FilePath/Alex_Pereira_UFC_300.png?width=720",
    awayImage: "https://commons.wikimedia.org/wiki/Special:FilePath/JiriProchazka2022.png?width=720",
  },
  "ufc-shevchenko-grasso": {
    homeImage: "https://commons.wikimedia.org/wiki/Special:FilePath/Valentina_Shevchenko.jpg?width=720",
    awayImage: "https://commons.wikimedia.org/wiki/Special:FilePath/Alexa_Grasso.jpg?width=720",
  },
  "f1-canada-norris-verstappen": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
  "f1-monaco-leclerc-piastri": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
  "f1-spain-hamilton-russell": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
  "f1-austria-norris-piastri": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
  "f1-silverstone-hamilton-verstappen": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
  "f1-belgium-leclerc-russell": { eventImage: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg/1920px-2024_British_Grand_Prix%2C_Verstappen_%283%29.jpg" },
};

export const INSIGHT_CFG = {
  football:   { midLabel: "Table Position", formLabel: "form",     recentLabel: "Last 5 Matches", allowDraw: true,  scoreGen: (s, i) => `${(s + i * 2) % 4}-${(s + i * 3) % 3}`,                          opponents: ["ARS","BAR","JUV","PSG","BYN","AJA","POR","ATM","ROM","INT"] },
  basketball: { midLabel: "Conference",     formLabel: "win %",    recentLabel: "Last 5 Games",   allowDraw: false, scoreGen: (s, i) => `${95 + (s + i * 7) % 25}-${78 + (s + i * 5) % 20}`,            opponents: ["LAL","GSW","BOS","MIA","PHX","MIL","NYK","CHI","DEN","DAL"] },
  cricket:    { midLabel: "ICC Ranking",    formLabel: "form",     recentLabel: "Last 5 Games",   allowDraw: false, scoreGen: (s, i) => `${162 + (s + i * 9) % 78}/${5 + (s + i * 3) % 5}`,              opponents: ["IND","PAK","AUS","ENG","SA","NZ","WI","SL","BAN","AFG"] },
  tennis:     { midLabel: "ATP Ranking",    formLabel: "win %",    recentLabel: "Last 5 Matches", allowDraw: false, scoreGen: (s, i) => `${1 + (s + i * 2) % 2}-${(s + i * 3) % 2}`,                    opponents: ["DJO","ALC","MED","SIN","RUU","FRI","HUB","ZVE","RUB","BER"] },
  esports:    { midLabel: "World Ranking",  formLabel: "win rate", recentLabel: "Last 5 Series",  allowDraw: false, scoreGen: (s, i) => `2-${(s + i) % 2}`,                                             opponents: ["NV","SEN","G2","FNC","EG","T1","C9","NIP","NRG","100T"] },
};

export const WC_ANIMS = [
  "wc-anim-bounce", "wc-anim-spin",   "wc-anim-roll",   "wc-anim-wobble",
  "wc-anim-pulse",  "wc-anim-shake",  "wc-anim-swing",  "wc-anim-rubber",
  "wc-anim-flip",   "wc-anim-tada",
];
