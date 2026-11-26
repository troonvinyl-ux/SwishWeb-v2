import { asRecord } from '@/lib/itemPhotos';
import { positiveMoney } from '@/lib/itemPricing';
import type { ScanListingEnrichment } from '@/lib/scanListingEnrichment';
/** Flatten useful scan suggestions for category research without changing their provenance. */
export function scanListingAttributes(result: Record<string, unknown>, answers: Record<string, string>): Record<string, unknown> {
  return { ...result, ...asRecord(result.attributesInferred), ...asRecord(result.attributes), ...asRecord(result.attributesConfirmed), ...answers };
}
/** The shared valuation's explicit recommendation can prefill price; a market midpoint is not a selling price. */
export function enrichedScanListing(generated: Record<string, unknown>, preparation: ScanListingEnrichment): Record<string, unknown> {
  const market = asRecord(preparation.market), valuation = asRecord(market.valuation), recommendation = asRecord(market.recommendation);
  const suggested = positiveMoney(valuation.recommendedListingPrice, recommendation.recommendedPrice);
  return { ...generated, ...(preparation.category ? { category_id: preparation.category.id, category: preparation.category.name, category_path: preparation.category.categoryPath || '' } : {}),
    ...(suggested !== null ? { recommended_price: suggested } : {}),
    ...(preparation.specifics.length ? { item_specifics: Object.fromEntries(preparation.specifics.map(row => [row.name, row.value])) } : {}),
  };
}
export function scanPreparationWarnings(preparation: ScanListingEnrichment): string[] {
  return [preparation.marketError, preparation.categoryError, preparation.specificsError, preparation.conditionError,
    ...(preparation.missingRequired || []).map(name => `Confirm the required eBay specific: ${name}.`),
    'Scan-filled fields are suggestions. Confirm identity, contents, condition and price against your actual item before submitting.',
  ].filter((value): value is string => typeof value === 'string' && Boolean(value));
}
