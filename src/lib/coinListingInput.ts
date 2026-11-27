import { prefillCoinListingFacts } from '@/lib/coinListingFacts';
import { coinFieldKey } from '@/lib/coinFactNormalization';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Seller-edited live specifics take precedence over OCR, including old nested identification fields. */
export function coinListingInput(item: Record<string, unknown>, specifics?: unknown, title = ''): Record<string, unknown> {
  const attrs = record(item.attributes);
  const attributes: Record<string, unknown> = { ...item, ...attrs, attributesConfirmed: { ...record(attrs.attributesConfirmed), ...record(item.attributesConfirmed) } };
  const supplied = specifics === undefined ? attrs.ebay_item_specifics : specifics;
  const entries = Array.isArray(supplied) ? supplied.map(raw => { const row = record(raw); return [String(row.name || ''), row.value] as const; }) : Object.entries(record(supplied));
  for (const [name, value] of entries) {
    const key = name.toLowerCase().replace(/[^a-z]/g, '');
    const field = coinFieldKey(key);
    if (field && typeof value === 'string' && value.trim()) {
      attributes[field] = value.trim();
      attributes._coin_specific_overrides = { ...record(attributes._coin_specific_overrides), [field]: value.trim() };
      attributes.attributesConfirmed = { ...record(attributes.attributesConfirmed), [field]: value.trim() };
    }
  }
  return prefillCoinListingFacts(attributes, title || String(item.canonical_title || ''));
}
