import { COIN_FACT_KEYS, COIN_FACT_ALIASES, coinRecord, coinScalar, coinFieldKey, normalizeCoinCountry, singleCoinYear, type CoinFactKey } from '@/lib/coinFactNormalization';
import { coinListingFacts, type CoinListingFacts } from '@/lib/coinListingFacts';
import { collectorCoinFields } from '@/lib/collectorCoinFields';
export interface CoinAttribution { status: 'corroborated' | 'provisional' | 'unresolved'; facts: CoinListingFacts; agreements: CoinFactKey[]; conflicts: string[]; }
export const COIN_FACT_LABELS: Record<CoinFactKey, string> = { country: 'Issuing country', year: 'Coin year', denomination: 'Denomination', ruler: 'Ruler', composition: 'Composition', mint: 'Mint' };
const comparable = (key: CoinFactKey, value: string) => (key === 'country' ? normalizeCoinCountry(value) : key === 'year' ? singleCoinYear(value) : value).toLowerCase().replace(/kopecks?/g, 'kopeks').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const valueFor = (key: CoinFactKey, values: Record<string, unknown>) => COIN_FACT_ALIASES[key].map(alias => coinScalar(values[alias])).find(Boolean) || '';
/** Matching literal coin observations and notes corroborate attribution only, never authenticity, grade or tested metal. */
export function coinAttribution(attributes: Record<string, unknown>, title = ''): CoinAttribution {
  const facts = coinListingFacts(attributes, title), collector = collectorCoinFields(attributes);
  const visual = { ...coinRecord(attributes.observedCharacteristics) };
  const envelope = coinRecord(attributes.collector_envelope ?? attributes._rapid_coin_evidence);
  if (Array.isArray(envelope.fields)) for (const raw of envelope.fields) {
    const row = coinRecord(raw), key = coinFieldKey(coinScalar(row.name));
    if (key && row.source === 'visual' && !visual[key]) visual[key] = row.value;
  }
  const agreements: CoinFactKey[] = [], conflicts: string[] = [];
  for (const key of COIN_FACT_KEYS) {
    const observed = valueFor(key, visual), labelled = valueFor(key, collector), selected = facts[key]?.value || '';
    if (!observed || !labelled) continue;
    const left = comparable(key, observed), right = comparable(key, labelled);
    if (!left || !right) continue;
    if (left === right && comparable(key, selected) === left) agreements.push(key);
    else if (left !== right) conflicts.push(`${COIN_FACT_LABELS[key]}: coin observation “${observed}” differs from collector note “${labelled}”.`);
  }
  const reported = envelope.discrepancies;
  if (Array.isArray(reported)) conflicts.push(...reported.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())));
  const status = !Object.keys(facts).length ? 'unresolved' : !conflicts.length && (['country', 'year', 'denomination'] as const).every(key => agreements.includes(key)) ? 'corroborated' : 'provisional';
  return { status, facts, agreements, conflicts: [...new Set(conflicts)] };
}
