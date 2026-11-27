import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { asRecord } from '@/lib/itemPhotos';
export interface ScanMarketInput { client: SupabaseClient; userId: string; tenantId: string; nicheId: string; itemId: string; specialistId: string; title: string; attributes: Record<string, unknown>; condition: string; imageUrls: string[]; }
export interface ScanMarketResult { data: Record<string, unknown> | null; error: string | null; }
/** Store a bounded summary of the real response, never a fabricated comparable or offline catalogue. */
export function scanMarketSnapshot(raw: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, string[]> = {
    valuation: ['fairMarketValue', 'valuationMid', 'valuationLow', 'valuationHigh', 'recommendedListingPrice', 'valuationConfidence', 'listingPriceRationale', 'valuationWarnings'],
    recommendation: ['recommendedPrice', 'quickSaleRatio', 'reasoning'],
    soldMarket: ['verifiedSoldCount', 'relevantSoldCount', 'medianPrice', 'dataQualityReason', 'source', 'sourceDate'],
    activeAskingPrices: ['relevantCount', 'medianAskingPrice', 'source', 'sourceDate'],
  };
  return Object.fromEntries(Object.entries(fields).map(([key, names]) => {
    const source = asRecord(raw[key]);
    return [key, Object.fromEntries(names.flatMap<[string, unknown]>(name => {
      const value = source[name];
      if (typeof value === 'number' && Number.isFinite(value)) return [[name, value]];
      if (typeof value === 'string') return [[name, value.slice(0, 2000)]];
      if (Array.isArray(value)) return [[name, value.filter(entry => typeof entry === 'string').slice(0, 16).map(entry => entry.slice(0, 500))]];
      return [];
    }))];
  }));
}
export async function researchScanMarket(input: ScanMarketInput): Promise<ScanMarketResult> {
  if (input.title.trim().length < 3) return { data: null, error: 'Add an identifiable title before researching market value.' };
  const result = await callEdgeFunction<Record<string, unknown>>('swish-market-value', {
    tenantId: input.tenantId, itemId: input.itemId, title: input.title.trim(), specialistId: input.specialistId,
    attributes: input.attributes, condition: input.condition, imageUrls: input.imageUrls, applyToItem: true,
    ...(input.nicheId === 'coins' ? { quickList: true, numistaTypeId: Number(input.attributes.numista_type_id || input.attributes.numistaTypeId) || undefined,
      valuationInstructions: 'Prioritise verified completed sales, catalogue and specialist auction evidence; distinguish active asking prices. Use established metal/condition and seller pricing preferences. Never reduce a price solely because visual identification confidence is low.' } : {}),
  }, input.client);
  if (result.error) return { data: null, error: result.error.displayMessage };
  if (result.data?.success !== true || !Object.keys(asRecord(result.data.valuation)).length) return { data: null, error: String(result.data?.error || 'No market valuation was returned. Enter your own price or retry research.') };
  return { data: scanMarketSnapshot(result.data), error: null };
}
