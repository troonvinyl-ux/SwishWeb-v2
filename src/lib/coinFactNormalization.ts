/** Literal evidence parsing only; no catalogue, alloy or hidden-letter inference. */
export const COIN_FACT_KEYS = ['country', 'year', 'denomination', 'ruler', 'composition', 'mint'] as const;
export type CoinFactKey = typeof COIN_FACT_KEYS[number];
export const coinRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function coinScalar(value: unknown): string {
  const row = coinRecord(value), raw = typeof value === 'object' && value !== null ? row.value ?? row.name : value;
  const text = typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
  return /^(?:unknown|unresolved|unidentified|unverified|not (?:known|established|legible|recorded)|none|n\/?a|null|undefined)$/i.test(text) ? '' : text;
}
export const COIN_FACT_ALIASES: Record<CoinFactKey, string[]> = {
  country: ['country', 'issuing_country', 'issuingCountry', 'countryOfOrigin', 'country_of_origin', 'country_region_of_origin'],
  year: ['year', 'yearMade', 'year_made', 'issue_year', 'issue_date', 'coin_date', 'visible_date', 'date', 'date_range'],
  denomination: ['denomination', 'face_value', 'faceValue'], ruler: ['ruler', 'monarch', 'sovereign', 'ruler_name'],
  composition: ['composition', 'metal', 'material', 'alloy'], mint: ['mint', 'mintLocation', 'mint_location'],
};
export function coinFieldKey(value: string): CoinFactKey | '' {
  const key = value.toLowerCase().replace(/[^a-z]/g, '');
  return /^(?:country|issuingcountry|countryregionoforigin|countryoforigin)$/.test(key) ? 'country'
    : /^(?:year|date|daterange|yearmade|yearofissue|coindate|issuedate|issueyear|visibledate)$/.test(key) ? 'year'
    : /^(?:denomination|facevalue)$/.test(key) ? 'denomination' : /^(?:ruler|monarch|sovereign)$/.test(key) ? 'ruler'
    : /^(?:metal|composition|material|alloy)$/.test(key) ? 'composition' : /^(?:mint|mintlocation)$/.test(key) ? 'mint' : '';
}
export const normalizeCoinCountry = (value: string) => /^(?:russia|russian|russian empire|россия|российская империя)$/i.test(value) ? 'Russia' : value;
export function singleCoinYear(value: string): string {
  if (/\?|\b(?:BC|BCE|uncertain|illegible)\b/i.test(value)) return '';
  const dates = [...new Set(value.match(/\b(?:1\d{3}|20\d{2}|2100)\b/g) || [])];
  return dates.length === 1 ? dates[0] : '';
}
/** A standalone issue date is not invalidated by a separately labelled ruler's reign. */
export function literalCollectorIdentity(transcription: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const countries = ['Russia', 'Hungary', 'Italy', 'Britain', 'France', 'Germany', 'Spain', 'Portugal', 'Canada', 'Australia', 'China', 'Japan', 'India', 'Netherlands', 'Austria', 'Poland', 'Greece'];
  const found = countries.filter(country => new RegExp(`\\b${country}\\b`, 'i').test(transcription));
  if (found.length === 1 && !new RegExp(`\\b(?:not|possibly|maybe)\\s+${found[0]}\\b`, 'i').test(transcription)) fields.country = found[0];
  if (!fields.country && /\bRussian\b|Россия/i.test(transcription) && !/\b(?:not|possibly|maybe)\s+Russian\b/i.test(transcription)) fields.country = 'Russia';
  const denomination = /\b(\d+)\s*(kopecks?|kopeks?|kopecs?|kop(?:ecks?|eks?)?|denars?|deniers?|penn(?:y|ies)|pfennigs?|kreuzers?|thalers?|roubles?|rubles?)\b/i.exec(transcription);
  if (denomination && !/\?/.test(transcription.slice(denomination.index, denomination.index + denomination[0].length + 1))) fields.denomination = `${denomination[1]} ${/^kop/i.test(denomination[2]) ? 'kopeks' : denomination[2]}`;
  const lines = transcription.split(/\r?\n|\//).map(line => line.trim());
  const issueLines = lines.filter(line => /^(?:(?:coin|issue|date|year)\s*[:=]?\s*)?(?:1\d{3}|20\d{2}|2100)\s*[.]?$/i.test(line));
  const issueDates = [...new Set(issueLines.map(singleCoinYear).filter(Boolean))];
  const date = issueDates.length === 1 ? issueDates[0] : !issueDates.length ? singleCoinYear(transcription) : '';
  if (date) fields.date = date;
  const metal = /\b(silver|gold|copper|bronze|brass|cupronickel)\b/i.exec(transcription);
  if (metal) fields.metal = metal[1];
  else if (lines.some(line => /^AR\.?$/i.test(line))) fields.metal = 'Silver'; // Literal numismatic notation on the note, not physical testing.
  const rulerLine = lines.find(line => /^(?:ruler|monarch)\s*[:=]/i.test(line));
  if (rulerLine) fields.ruler = rulerLine.replace(/^(?:ruler|monarch)\s*[:=]\s*/i, '').replace(/\s+\d{4}\s*[-–—]\s*\d{4}.*$/, '').trim();
  // Only the literal, fully visible name is a fallback. Never reconstruct text hidden by a sticker.
  if (!fields.ruler) { const name = /\bLeopold(?:\s+Ignatius|\s+I\b)?/i.exec(transcription); if (name) fields.ruler = name[0]; }
  const mint = lines.find(line => /^mint\s*[:=]/i.test(line));
  if (mint) fields.mint = mint.replace(/^mint\s*[:=]\s*/i, '').trim();
  return fields;
}
