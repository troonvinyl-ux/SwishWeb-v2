import { asRecord } from '@/lib/itemPhotos';
export interface ItemPricing { market: number | null; suggested: number | null; actual: number | null; cost: number | null; low: number | null; high: number | null; }
export function positiveMoney(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}
export function savedMarketData(item: Record<string, unknown> | null): Record<string, unknown> {
  const attrs = asRecord(item?.attributes), scan = asRecord(attrs.source_scan);
  return asRecord(attrs.valuation_data ?? attrs.market_value_result ?? attrs.market_value ?? attrs._market_value ?? scan.valuation);
}
/** Native three-layer pricing: unknown is not zero, and a recommendation is not an eBay price. */
export function itemPricing(item: Record<string, unknown> | null, listing?: Record<string, unknown> | null, fresh?: Record<string, unknown> | null): ItemPricing {
  const data = fresh ?? savedMarketData(item), valuation = asRecord(data.valuation), recommendation = asRecord(data.recommendation);
  return {
    market: positiveMoney(valuation.fairMarketValue, valuation.valuationMid, item?.valuation_mid, data.median, data.estimated_value, item?.valuation),
    suggested: positiveMoney(valuation.recommendedListingPrice, recommendation.recommendedPrice, item?.expected_selling_price),
    actual: positiveMoney(listing?.price), cost: positiveMoney(item?.acquired_cost, item?.cost_price),
    low: positiveMoney(valuation.valuationLow, item?.valuation_low, data.low), high: positiveMoney(valuation.valuationHigh, item?.valuation_high, data.high),
  };
}
export function displayValue(value: unknown): string {
  if (value == null || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.filter(entry => typeof entry === 'string' || typeof entry === 'number').join(' · ') || 'Not recorded';
  return typeof value === 'object' ? 'Not recorded' : String(value);
}
