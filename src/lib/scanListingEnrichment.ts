import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { lookupScopedListingCategory } from '@/lib/scopedCategoryLookup';
import { asRecord } from '@/lib/itemPhotos';
import { normalizeEbayAspects, normalizeEbayConditionPolicy, ebayConditionId, vinylRecordConditionPolicy, type EbayAspect } from '@/lib/ebayMusicContract';
import { researchScanMarket } from '@/lib/scanMarketResearch';
import { listingSpecifics } from '@/lib/listingEditorData';
import { coinListingFactPatch, prefillCoinListingFacts } from '@/lib/coinListingFacts';
import { usesNumismaticCategories } from '@/lib/coinCategoryPolicy';
import { coinListingInput } from '@/lib/coinListingInput';

export interface EbaySpecific { name: string; value: string; }
export interface ScanListingEnrichment {
  category: { id: string; name: string; categoryPath?: string } | null;
  aspects: EbayAspect[];
  specifics: EbaySpecific[];
  missingRequired: string[];
  marketRefreshed: boolean;
  marketError: string | null;
  categoryError: string | null;
  specificsError: string | null;
  market?: Record<string, unknown> | null;
  conditionId?: string;
  conditionError?: string | null;
}

interface ScanListingEnrichmentInput {
  client: SupabaseClient;
  userId: string;
  tenantId: string;
  nicheId: string;
  itemId: string;
  specialistId: string;
  title: string;
  attributes: Record<string, unknown>;
  condition: string;
  imageUrls: string[];
  isCurrent?: () => boolean;
}

const absent = /^(?:unknown|not established|not legible|n\/?a|none|not applicable|unverified)$/i;
const aspectAliases: Record<string, string[]> = {
  brand: ['brand', 'brand_name', 'maker', 'manufacturer', 'make'],
  manufacturer: ['brand', 'brand_name', 'maker', 'manufacturer', 'make'],
  make: ['brand', 'brand_name', 'maker', 'manufacturer', 'make'],
  model: ['model', 'model_number', 'model_name', 'product_model', 'reference'],
  mpn: ['mpn', 'model_number', 'manufacturer_part_number'],
  manufacturerpartnumber: ['mpn', 'model_number', 'manufacturer_part_number'],
  type: ['category', 'object_type', 'objecttype', 'product_type', 'producttype', 'item_type', 'itemtype'],
  colour: ['colour', 'color', 'colour_description', 'color_description'],
  color: ['colour', 'color', 'colour_description', 'color_description'],
  material: ['material', 'materials', 'composition', 'fiber_composition', 'fibre_composition'],
  size: ['size', 'tagged_size', 'labelled_size', 'dimensions'],
  department: ['gender_category', 'department'],
  year: ['year', 'year_made', 'yearMade', 'issue_year', 'date', 'release_year'],
  yearofissue: ['year', 'issue_year', 'date'],
  ruler: ['ruler', 'monarch', 'sovereign'],
  monarch: ['ruler', 'monarch', 'sovereign'],
  composition: ['composition', 'metal', 'material'],
  metal: ['composition', 'metal', 'material'],
  mint: ['mint', 'mint_location', 'mintLocation'],
  date: ['year', 'year_made', 'yearMade', 'issue_year', 'date'],
  denomination: ['denomination', 'face_value'],
  country: ['country', 'country_of_origin', 'countryOfOrigin', 'issuing_country'],
  countryregionoforigin: ['country', 'country_of_origin', 'countryOfOrigin', 'issuing_country'],
  countryoforigin: ['country', 'country_of_origin', 'countryOfOrigin', 'issuing_country'],
  yearmanufactured: ['year', 'issue_year', 'release_year'],
  countryregionofmanufacture: ['country_manufacture', 'country_of_manufacture'],
  countryofmanufacture: ['country_manufacture', 'country_of_manufacture'],
  condition: ['condition', 'condition_assessment', 'conditionassessment'],
};

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function text(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const result = String(value).replace(/\s+/g, ' ').trim();
  return result && !absent.test(result) ? result : '';
}

function candidateForAspect(name: string, attributes: Record<string, unknown>): string {
  const exact = Object.entries(attributes).find(([key]) => normalized(key) === normalized(name));
  const aliases = aspectAliases[normalized(name)] || [];
  const keyed = aliases.map(key => attributes[key]).find(value => text(value));
  return text(exact?.[1]) || text(keyed);
}

/**
 * Keep capture data evidence-led: a selection-only eBay aspect is populated
 * only when its live localized value exactly supports the captured value.
 */
export function prefillEbaySpecifics(attributes: Record<string, unknown>, aspects: EbayAspect[]): { specifics: EbaySpecific[]; missingRequired: string[] } {
  const specifics: EbaySpecific[] = [];
  const missingRequired: string[] = [];
  for (const aspect of aspects) {
    const candidate = candidateForAspect(aspect.name, attributes);
    let value = candidate.length <= 65 && aspect.name.length <= 65 ? candidate : '';
    if (value && aspect.selectionOnly) {
      value = aspect.values.find(option => option.localeCompare(value, undefined, { sensitivity: 'accent' }) === 0) || '';
    }
    if (value) specifics.push({ name: aspect.name, value });
    else if (aspect.required) missingRequired.push(aspect.name);
  }
  return { specifics, missingRequired };
}

/**
 * Reuses the existing shared research and eBay metadata services. It never
 * guesses a category, invents an item-specific value, or submits to eBay.
 */
export async function enrichScannedItemForListing(input: ScanListingEnrichmentInput): Promise<ScanListingEnrichment> {
  const numismatic = usesNumismaticCategories(input.nicheId, input.specialistId, input.attributes);
  if (numismatic) input = { ...input, attributes: prefillCoinListingFacts(input.attributes, input.title) };
  const isCurrent = input.isCurrent || (() => true);
  const ensureScope = async () => {
    if (!isCurrent()) throw new Error('The capture workspace changed. Reopen the scanner and try again.');
    await verifyModuleScope(input.client, input.userId, input.tenantId, input.nicheId);
    if (!isCurrent()) throw new Error('The capture workspace changed. Reopen the scanner and try again.');
  };
  const result: ScanListingEnrichment = {
    category: null, aspects: [], specifics: [], missingRequired: [], marketRefreshed: false,
    marketError: null, categoryError: null, specificsError: null,
  };

  await ensureScope();
  // Independent research is concurrent; photography and partial drafts never depend on market latency.
  const [market, category] = await Promise.all([
    researchScanMarket(input),
    lookupScopedListingCategory({ ...input, isCurrent }).then(value => ({ value, error: null as string | null }))
      .catch((cause: unknown) => ({ value: null, error: cause instanceof Error ? cause.message : 'eBay category lookup unavailable.' })),
  ]);
  await ensureScope();
  result.market = market.data; result.marketError = market.error; result.marketRefreshed = Boolean(market.data);
  result.category = category.value; result.categoryError = category.error;
  if (!result.category) return result;

  try {
    await ensureScope();
    const metadata = await callEdgeFunction<Record<string, unknown>>('swish-ebay-category', {
      route: 'get_category_aspects', tenantId: input.tenantId, nicheId: input.nicheId, categoryId: result.category.id,
    }, input.client);
    if (metadata.error) throw metadata.error;
    if (metadata.data?.success !== true) throw new Error(String(metadata.data?.error || 'Category item specifics were unavailable.'));
    result.aspects = normalizeEbayAspects(metadata.data?.aspects);
    const prefilled = prefillEbaySpecifics(input.attributes, result.aspects);
    result.specifics = prefilled.specifics;
    result.missingRequired = prefilled.missingRequired;
  } catch (error) {
    result.specificsError = error instanceof Error ? error.message : 'Category item specifics were unavailable.';
  }

  try {
    await ensureScope();
    const vinyl = vinylRecordConditionPolicy(result.category.id, input.specialistId);
    const response = vinyl ? null : await callEdgeFunction<Record<string, unknown>>('swish-ebay-list', {
      route: 'get_condition_policies', tenantId: input.tenantId, nicheId: input.nicheId, categoryId: result.category.id,
    }, input.client);
    if (response?.error) throw response.error;
    if (!vinyl && response?.data?.success !== true) throw new Error('Current eBay condition choices are unavailable.');
    const policy = vinyl ? { conditions: vinyl.conditions, required: true } : normalizeEbayConditionPolicy(asRecord(response?.data).policy, result.category.id);
    const candidate = ebayConditionId(input.condition);
    result.conditionId = policy.conditions.some(row => row.id === candidate) ? candidate : '';
    if (policy.required && !result.conditionId) result.conditionError = 'Choose a supported eBay condition after checking the physical item. Photos do not establish testing, grading or sealed-new status.';
  } catch (cause) { result.conditionError = cause instanceof Error ? cause.message : 'Current eBay condition policy unavailable.'; }

  await ensureScope();
  const current = await input.client.from('items').select('id,attributes,updated_at').eq('id', input.itemId).eq('tenant_id', input.tenantId).maybeSingle();
  if (current.error || !current.data?.id || !current.data.updated_at) throw new Error(current.error?.message || 'Saved item could not be read before applying eBay preparation.');
  const currentAttributes = asRecord(current.data.attributes);
  const sameCategory = String(currentAttributes.ebay_category_id || '') === result.category.id;
  if (result.aspects.length) {
    const existingSpecifics = listingSpecifics(currentAttributes.ebay_item_specifics);
    const basis = numismatic ? coinListingInput({ ...current.data, attributes: { ...input.attributes, ...currentAttributes } }, existingSpecifics, input.title) : { ...input.attributes, ...existingSpecifics };
    const filled = prefillEbaySpecifics(basis, result.aspects);
    result.specifics = filled.specifics; result.missingRequired = filled.missingRequired;
  }
  const prepared = {
    ...currentAttributes,
    ...(numismatic ? coinListingFactPatch({ ...input.attributes, ...currentAttributes }, input.title) : {}),
    ...(result.market ? { market_value_result: result.market } : {}),
    _scan_listing_preparation: { market_error: result.marketError, category_error: result.categoryError, specifics_error: result.specificsError, condition_error: result.conditionError, reviewed: false },
    ...(result.category ? { ebay_category_id: result.category.id, ebay_category_name: result.category.name, ebay_category_path: result.category.categoryPath || '' } : {}),
    ebay_condition_id: sameCategory && currentAttributes.ebay_condition_id ? currentAttributes.ebay_condition_id : result.conditionId || '',
    ...(!sameCategory || result.aspects.length ? {
      ebay_item_specifics: result.specifics,
      ebay_required_specifics_missing: result.missingRequired,
    } : {}),
    ebay_listing_media: input.imageUrls,
  };
  const saved = await input.client.from('items').update({ attributes: prepared }).eq('id', input.itemId).eq('tenant_id', input.tenantId).eq('updated_at', current.data.updated_at).select('id').maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Item changed while saving eBay preparation. Open the saved item and retry preparation.');
  return result;
}
