import { prefillCoinListingFacts } from '@/lib/coinListingFacts';
/** Search/relevance context, never a certificate of coin attribution or authenticity. */
export type CoinPeriod = 'ancient' | 'hammered' | 'modern' | null;
export type CoinTradition = 'roman' | 'greek' | 'byzantine' | null;
export interface CoinCategoryContext { lot: boolean; period: CoinPeriod; tradition: CoinTradition; romanBranch: 'imperial' | 'republican' | 'provincial' | null; country?: string | null; year?: number | null; }
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
const countries: Record<string, RegExp> = {
  Russia: /\b(?:russia|russian|ussr|soviet)\b/i, Italy: /\b(?:italy|italian)\b/i,
  Britain: /\b(?:britain|british|united kingdom|great britain|england|english|uk)\b/i,
  France: /\b(?:france|french)\b/i, Germany: /\b(?:germany|german)\b/i,
  Spain: /\b(?:spain|spanish)\b/i, Portugal: /\b(?:portugal|portuguese)\b/i,
  'United States': /\b(?:united states|usa|u\.s\.a\.|american)\b/i, Canada: /\b(?:canada|canadian)\b/i,
  Australia: /\b(?:australia|australian)\b/i, China: /\b(?:china|chinese)\b/i,
  Japan: /\b(?:japan|japanese)\b/i, India: /\b(?:india|indian)\b/i,
  Netherlands: /\b(?:netherlands|dutch)\b/i, Belgium: /\b(?:belgium|belgian)\b/i,
  Austria: /\b(?:austria|austrian)\b/i, Hungary: /\b(?:hungary|hungarian)\b/i,
  Poland: /\b(?:poland|polish)\b/i, Sweden: /\b(?:sweden|swedish)\b/i,
  Denmark: /\b(?:denmark|danish)\b/i, Norway: /\b(?:norway|norwegian)\b/i,
  Switzerland: /\b(?:switzerland|swiss)\b/i, Ireland: /\b(?:ireland|irish)\b/i,
  Mexico: /\b(?:mexico|mexican)\b/i, Greece: /\b(?:greece|greek)\b/i,
};
const countryIn = (value: string): string | null => { const matches = Object.entries(countries).filter(([, pattern]) => pattern.test(value)); return matches.length === 1 ? matches[0][0] : null; };
const fields = ['period', 'era', 'date', 'date_range', 'year', 'year_made', 'yearMade', 'yearRange', 'issue_year', 'issuer', 'issuingAuthority', 'issuing_authority', 'country', 'countryOfOrigin', 'country_of_origin', 'region', 'ruler', 'denomination'];
/** Quantity is stock availability. Explicit collector research fields can guide a search, never confirm identity or lot scope. */
export function coinCategoryContext(title = '', attributes: Record<string, unknown> = {}): CoinCategoryContext {
  attributes = prefillCoinListingFacts(attributes, title);
  const coin = record(attributes.coinFields), confirmed = record(attributes.attributesConfirmed), collector = record(attributes._collector_research_fields);
  const value = (keys: string[]) => keys.map(key => text(confirmed[key])).find(Boolean) || keys.map(key => text(attributes[key])).find(Boolean) || keys.map(key => text(coin[key])).find(Boolean) || keys.map(key => text(collector[key])).find(Boolean) || '';
  const evidence = [title, ...fields.map(key => value([key]))].join(' ');
  let tradition: CoinTradition = /\bbyzantine\b/i.test(evidence) ? 'byzantine' : /\broman\b/i.test(evidence) ? 'roman' : /\b(?:greek|hellenistic)\b/i.test(evidence) ? 'greek' : null;
  const dates = value(['year', 'year_made', 'yearMade', 'issue_year', 'date', 'yearRange', 'date_range']);
  const years = (dates || title).match(/\b(?:1[0-9]{3}|20[0-9]{2}|2100)\b/g) || [];
  const year = !/\?|\b(?:BC|BCE|uncertain|illegible)\b/i.test(dates || title) && new Set(years).size === 1 ? Number(years[0]) : null;
  const explicitPeriod = value(['period', 'era']);
  if (/\bmodern\b/i.test(explicitPeriod) || year !== null && year >= 1600 && !/\b(?:ancient|BC|BCE)\b/i.test(evidence)) tradition = null;
  const period: CoinPeriod = /\b(?:hammered|medieval)\b/i.test(explicitPeriod) ? 'hammered' : tradition || /\b(?:ancient|celtic|BC|BCE)\b/i.test(evidence) ? 'ancient' : /\b(?:hammered|medieval)\b/i.test(evidence) ? 'hammered' : /\bmodern\b/i.test(evidence) || year !== null && year >= 1600 ? 'modern' : null;
  const country = countryIn(value(['country', 'countryOfOrigin', 'country_of_origin', 'issuing_country'])) || countryIn(title);
  const explicitLot = attributes.is_lot === true || attributes.listing_is_lot === true || /^(?:lot|bundle|collection|set)$/i.test(text(attributes.listing_scope));
  const count = Number(attributes.coins_in_lot ?? attributes.lot_coin_count);
  const single = /\b(?:single coin|one coin|not (?:a )?(?:lot|set|bundle))\b/i.test(title);
  const lot = explicitLot || Number.isInteger(count) && count > 1 || !single && /\b(?:lot|bundle|group|collection|set)\s+of\s+(?:[2-9]\d*|1\d+)\b|\b(?:coin lot|bulk lot|job lot|mixed coins)\b|\b(?:[2-9]\d*|1\d+)\s+coins\b/i.test(title);
  const romanBranch = tradition !== 'roman' ? null : /\b(?:provincial|civic)\b/i.test(evidence) ? 'provincial' : /\b(?:republican|republic)\b/i.test(evidence) ? 'republican' : /\b(?:imperial|empire)\b/i.test(evidence) ? 'imperial' : null;
  return { lot, period, tradition, romanBranch, country, year };
}
/** Full ancestry matters; a named country and dated leaf cannot be replaced by an unrelated branch. */
export function coinCategoryMismatch(row: Record<string, unknown>, context: CoinCategoryContext): string | null {
  const branch = `${text(row.categoryPath)} > ${text(row.name)}`;
  const lot = text(row.id) === '3410' || /\b(?:bulk|lots?|collections?|bundles?|sets?|job lots?)\b/i.test(branch);
  if (lot !== context.lot) return context.lot ? 'This listing explicitly describes a coin lot; select a matching lot category.' : 'Collections/Bulk Lots is for multiple coins sold together, not this single coin.';
  const ancient = /\b(?:ancient|roman|hellenistic|byzantine|celtic)\b/i.test(branch) || /\bgreek\b/i.test(branch) && !/\b(?:modern|european)\b/i.test(branch);
  const hammered = /\b(?:hammered|medieval)\b/i.test(branch);
  if (context.period === 'ancient' && !ancient) return 'The item is described as an ancient coin; choose a relevant ancient-coin branch, not a generic or modern category.';
  if (context.period === 'hammered' && !hammered) return 'The item is described as hammered/medieval; choose a matching coin branch.';
  if (context.period === 'modern' && (ancient || hammered)) return 'The recorded date/period does not match this ancient or hammered-coin category.';
  const observed = /\bbyzantine\b/i.test(branch) ? 'byzantine' : /\broman\b/i.test(branch) ? 'roman' : /\b(?:greek|hellenistic)\b/i.test(branch) ? 'greek' : null;
  if (context.tradition && observed && context.tradition !== observed) return 'The category belongs to a different ancient issuing tradition from the item being reviewed.';
  if (context.tradition === 'roman' && context.romanBranch) {
    const subbranch = /\bprovincial\b/i.test(branch) ? 'provincial' : /\brepublic/i.test(branch) ? 'republican' : /\b(?:imperial|empire)\b/i.test(branch) ? 'imperial' : null;
    if (subbranch && subbranch !== context.romanBranch) return 'The Roman category branch differs from the attribution in this draft; review the attribution before changing branches.';
  }
  if (!context.lot && context.period !== 'ancient' && context.country && countryIn(branch) !== context.country) return `The recorded issuing country is ${context.country}; choose its coin branch rather than a different country or generic fallback.`;
  if (context.year != null) {
    const ranges = [...branch.matchAll(/\b(1\d{3}|20\d{2})\s*[-–—]\s*(1\d{3}|20\d{2}|present|date)\b/gi)];
    if (ranges.some(match => context.year! < Number(match[1]) || context.year! > (/present|date/i.test(match[2]) ? Infinity : Number(match[2])))) return 'The coin date falls outside this category’s date range.';
    const before = /\b(?:pre[-\s]?|before\s+)(1\d{3}|20\d{2})\b/i.exec(branch), after = /\b(?:post[-\s]?|after\s+)(1\d{3}|20\d{2})\b/i.exec(branch);
    if (before && context.year >= Number(before[1]) || after && context.year <= Number(after[1])) return 'The coin date falls outside this category’s date range.';
    if (context.country === 'Russia' && (context.year < 1917 && /\b(?:soviet|ussr|federation)\b/i.test(branch) || context.year >= 1917 && /\b(?:tsarist|czarist)\b/i.test(branch))) return 'The recorded Russian coin date does not match this issuing-period branch.';
  }
  return null;
}
export function coinCategoryRank(row: Record<string, unknown>, context: CoinCategoryContext): number {
  const branch = `${text(row.categoryPath)} > ${text(row.name)}`;
  const datedBranch = context.year != null && /\b(?:pre[-\s]?\d{4}|before\s+\d{4}|post[-\s]?\d{4}|after\s+\d{4}|\d{4}\s*[-–—]\s*(?:\d{4}|present|date))\b/i.test(branch) && !coinCategoryMismatch(row, context);
  return (datedBranch ? 10 : 0) + (context.country && context.period !== 'ancient' && countryIn(branch) === context.country ? 60 : 0) + (context.tradition && new RegExp(`\\b${context.tradition}\\b`, 'i').test(branch) ? 40 : 0) + (context.romanBranch && new RegExp(context.romanBranch === 'republican' ? '\\brepublic' : `\\b${context.romanBranch}\\b`, 'i').test(branch) ? 20 : 0) - (/^other\b/i.test(text(row.name)) ? 1 : 0);
}
export function coinSearchPrefix(context: CoinCategoryContext, kind: string): string {
  const era = context.period === 'ancient' ? `ancient${context.tradition ? ` ${context.tradition}` : ''}` : context.period === 'hammered' ? 'hammered medieval' : context.period === 'modern' ? 'modern' : 'collectible';
  return `${era} ${kind}${context.lot ? ' lot' : ''}`;
}
