export function flagUrl(code) {
  return `https://flagcdn.com/w160/${code}.png`;
}

export function esportsLogoHtml(code) {
  const url = `https://placehold.co/36x36/0f172a/25d8e8?text=${encodeURIComponent(code)}&font=roboto`;
  return `<img class="esports-team-logo" src="${url}" alt="${code} logo" />`;
}

export function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();
}

export function shortAddress(address) {
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function humanMarketLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split(':').filter(Boolean);
  const label = parts.length >= 3 ? parts.slice(2).join(' ') : raw;
  return label
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

export function formatSigned(value) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getPrice(text) {
  const numberMatch = text.match(/\d+(?:\.\d+)?/);
  if (!numberMatch) return null;
  const value = Number(numberMatch[0]);
  if (!Number.isFinite(value)) return null;
  return text.includes('.') ? Math.max(1, Math.min(99, Math.round(100 / value))) : value;
}

export function getTradeAmount() {
  const input = document.querySelector(".trade-slip input");
  return Number(input?.value.replace(/[^\d.]/g, "")) || 0;
}

export function estimatePnl(ticket, index) {
  if (typeof ticket.currentValue === "number" && typeof ticket.costBasis === "number") {
    return ticket.currentValue - ticket.costBasis;
  }
  const movement = index % 2 === 0 ? 0.18 : -0.08;
  const sideBoost = ticket.side === "YES" ? movement : -movement;
  return ticket.amount * sideBoost;
}

export function estimateCurrentPrice(entryPrice, pnl, amount, side) {
  if (!amount) return entryPrice;
  const movement = Math.round((Math.abs(pnl) / amount) * 100);
  const currentPrice = side === "YES" ? entryPrice + Math.sign(pnl) * movement : entryPrice - Math.sign(pnl) * movement;
  return Math.max(1, Math.min(99, currentPrice));
}

export function countryCodeFromUrl(url) {
  const match = String(url || '').match(/\/([a-z]{2}(?:-[a-z]{3})?)\.png/i);
  return match && match[1] && match[1].toLowerCase();
}

const COUNTRY_CODES = {
  'albania':'ALB','algeria':'ALG','argentina':'ARG','armenia':'ARM','australia':'AUS','austria':'AUT',
  'azerbaijan':'AZE',
  'bahrain':'BHR','belgium':'BEL','bolivia':'BOL','bosnia and herzegovina':'BIH','bosnia herzegovina':'BIH','brazil':'BRA',
  'bosnia-herzegovina':'BIH','bulgaria':'BUL','burkina faso':'BFA','cabo verde':'CPV','cameroon':'CMR',
  'canada':'CAN','cape verde':'CPV','chile':'CHI','china':'CHN','china pr':'CHN','chinese taipei':'TPE',
  'colombia':'COL','congo':'CGO','congo dr':'COD','costa rica':'CRC','cote divoire':'CIV',
  'cote d ivoire':'CIV','côte d’ivoire':'CIV','côte d ivoire':'CIV','croatia':'CRO','cuba':'CUB',
  'curacao':'CUW','curaçao':'CUW','cyprus':'CYP','czech republic':'CZE','czechia':'CZE',
  'denmark':'DEN','dominican republic':'DOM','ecuador':'ECU','egypt':'EGY','el salvador':'SLV',
  'england':'ENG','estonia':'EST','finland':'FIN','france':'FRA','germany':'GER','ghana':'GHA',
  'greece':'GRE','guatemala':'GUA','haiti':'HAI','hong kong':'HKG','hong kong china':'HKG',
  'honduras':'HON','hungary':'HUN','iceland':'ISL','india':'IND','indonesia':'IDN','ir iran':'IRN',
  'iran':'IRN','iraq':'IRQ','ireland':'IRL','israel':'ISR',
  'italy':'ITA','ivory coast':'CIV','jamaica':'JAM','japan':'JPN','jordan':'JOR','kazakhstan':'KAZ',
  'kenya':'KEN','korea dpr':'PRK','korea republic':'KOR','kuwait':'KUW','latvia':'LVA','lebanon':'LBN','libya':'LBY','liechtenstein':'LIE',
  'lithuania':'LTU','luxembourg':'LUX','malaysia':'MAS','malta':'MLT','mexico':'MEX','moldova':'MDA',
  'montenegro':'MNE','morocco':'MAR','netherlands':'NED','new zealand':'NZL','nigeria':'NGA',
  'north korea':'PRK','north macedonia':'MKD','northern ireland':'NIR','norway':'NOR','oman':'OMA','panama':'PAN',
  'paraguay':'PAR','peru':'PER','poland':'POL','portugal':'POR','qatar':'QAT','romania':'ROU',
  'republic of ireland':'IRL','russia':'RUS','saudi arabia':'KSA','scotland':'SCO','senegal':'SEN','serbia':'SRB','slovakia':'SVK',
  'slovenia':'SVN','south africa':'RSA','south korea':'KOR','spain':'ESP','sweden':'SWE',
  'switzerland':'SUI','tunisia':'TUN','turkey':'TUR','ukraine':'UKR','united arab emirates':'UAE',
  'turkiye':'TUR','türkiye':'TUR','uae':'UAE','united states':'USA','united states of america':'USA',
  'usa':'USA','us':'USA','u s a':'USA','uruguay':'URU','uzbekistan':'UZB','venezuela':'VEN','vietnam':'VIE','wales':'WAL'
};

export function teamCode(name) {
  const raw = String(name || '').trim();
  if (/^[A-Z]{2,3}$/.test(raw)) return raw;
  const clean = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (COUNTRY_CODES[clean]) return COUNTRY_CODES[clean];
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts.map(p => p[0]).join('').toUpperCase().slice(0, 3);
  const long = parts[0] || '';
  const vowels = new Set(['a','e','i','o','u']);
  let result = '';
  for (const ch of long) {
    if (!vowels.has(ch) && result.length < 3) result += ch;
  }
  while (result.length < 3 && long.length > result.length) result += long[result.length];
  return result.toUpperCase().slice(0, 3) || 'TBD';
}

export function getPnlTitleChips(title) {
  if (title.includes(" vs ")) {
    const [home, rest] = title.split(" vs ");
    return [home.trim(), rest.split(" to ")[0].trim()];
  }
  if (title.includes(" to ")) {
    const [team] = title.split(" to ");
    return [team.trim(), "Top Leagues"];
  }
  return ["Top Leagues", "Market"];
}
