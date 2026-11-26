/** Relevance policy only: category IDs and leaf status still come from live eBay taxonomy. */
export type NumismaticKind = 'coin' | 'banknote' | 'token' | 'medal';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function numismaticKind(attributes: Record<string, unknown> = {}, specialistId = ''): NumismaticKind {
  const fields = record(attributes.coinFields);
  const type = String(attributes.object_type ?? attributes.objectType ?? fields.objectType ?? '').toLowerCase();
  if (specialistId === 'banknotes' || /banknote|paper money/.test(type)) return 'banknote';
  if (/token|jeton/.test(type)) return 'token';
  if (/medal|medallion/.test(type)) return 'medal';
  return 'coin';
}
export function usesNumismaticCategories(nicheId: string | undefined, specialistId = '', attributes: Record<string, unknown> = {}): boolean {
  if (nicheId !== 'coins') return false;
  // A precious-metal jewellery or artefact specialist is not automatically a physical coin.
  if (['gold', 'silver', 'jewellery_precious_metals', 'ancient_artefacts'].includes(specialistId)) return /^(coin|banknote|token|medal|jeton)$/i.test(String(attributes.object_type ?? attributes.objectType ?? ''));
  return true;
}
export function numismaticSearchQuery(title: string, attributes: Record<string, unknown> = {}, specialistId = '', prefix?: string): string {
  const kind = numismaticKind(attributes, specialistId);
  const clean = title.trim().replace(/^(?:provisional(?: identification)?|attributed to|believed to be|possibly)\s*:?\s*/i, '').replace(/\s+/g, ' ');
  return `${prefix || `collectible ${kind}`} ${clean}`.slice(0, 100);
}
/** Reject artwork about coins, supplies and unrelated roots even if the service ranks them first. */
export function isNumismaticCategory(row: Record<string, unknown>, kind: NumismaticKind = 'coin', scope: 'single' | 'lot' = 'single'): boolean {
  const name = String(row.name ?? '').trim();
  const path = String(row.categoryPath ?? '').trim();
  const combined = `${path} > ${name}`;
  const lot = String(row.id ?? '') === '3410' || /\b(?:bulk|lots?|collections?|bundles?|sets?|job lots?)\b/i.test(combined);
  if (lot !== (scope === 'lot')) return false;
  // 360 is the Art Prints selection shown in the reported saved draft, never a coin fallback.
  if (String(row.id ?? '') === '360' || /\b(?:art|prints?|paintings?|posters?|photographs?|photography|drawings?|sculptures?|books?|jewellery|jewelry|clothing|supplies|holders?|albums?|capsules?|storage|accessories|replica moulds?)\b/i.test(combined)) return false;
  const parts = path.split(/\s*(?:>|\/)\s*/).filter(Boolean);
  const hasAncestry = parts.length > 1;
  const rootIsCoins = /^(?:coins?\b|paper money\b|banknotes?\b|numismatics?\b)/i.test(parts[0] || '');
  if (hasAncestry && !rootIsCoins) return false;
  const branch = `${parts.slice(1).join(' > ')} > ${name}`;
  if (kind === 'coin' && /\b(?:banknotes?|paper money|tokens?|jetons?|medals?|medallions?)\b/i.test(branch)) return false;
  if (kind === 'banknote' && !/\b(?:banknotes?|paper money)\b/i.test(branch)) return false;
  if (kind === 'token' && !/\b(?:tokens?|jetons?)\b/i.test(branch)) return false;
  if (kind === 'medal' && !/\b(?:medals?|medallions?)\b/i.test(branch)) return false;
  // Country/period leaves such as Italy or Roman need their actual Coins ancestry.
  return hasAncestry && rootIsCoins || /\b(?:coins?|banknotes?|paper money|tokens?|jetons?|medals?|medallions?)\b/i.test(name);
}
/** AI copy is not taxonomy evidence. Retain the RPC-required specifics object, populated only by live enrichment. */
export function discardGeneratedCoinCategory(generated: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...generated };
  for (const key of ['category', 'category_id', 'category_name', 'category_path', 'condition_id', 'item_specifics']) delete copy[key];
  return { ...copy, item_specifics: {} };
}
