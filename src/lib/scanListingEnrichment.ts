import type { SupabaseClient } from '@supabase/supabase-js';
import { callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { lookupScopedListingCategory } from '@/lib/scopedCategoryLookup';
import { asRecord } from '@/lib/itemPhotos';
import { normalizeEbayAspects, type EbayAspect } from '@/lib/ebayMusicContract';

export interface EbaySpecific { name: string; value: string; }
export interface ScanListingEnrichment {
  category: { id: string; name: string } | null;
  aspects: EbayAspect[];
  specifics: EbaySpecific[];
  missingRequired: string[];
  marketRefreshed: boolean;
  marketError: string | null;
  categoryError: string | null;
  specificsError: string | null;
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
  mpn: ['mpn', 'model_number', 'model', 'sku', 'reference'],
  manufacturerpartnumber: ['mpn', 'model_number', 'model', 'sku', 'reference'],
  type: ['category', 'object_type', 'objecttype', 'product_type', 'producttype', 'item_type', 'itemtype'],
  colour: ['colour', 'color', 'colour_description', 'color_description'],
  color: ['colour', 'color', 'colour_description', 'color_description'],
  material: ['material', 'materials', 'composition', 'fiber_composition', 'fibre_composition'],
  size: ['size', 'tagged_size', 'labelled_size', 'dimensions'],
  department: ['gender_category', 'department'],
  year: ['year', 'issue_year', 'release_year'],
  yearmanufactured: ['year', 'issue_year', 'release_year'],
  countryregionofmanufacture: ['country_manufacture', 'country_of_manufacture', 'country'],
  countryofmanufacture: ['country_manufacture', 'country_of_manufacture', 'country'],
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
    let value = candidate.slice(0, 65);
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

  if (input.title.trim().length >= 3) {
    await ensureScope();
    const market = await callEdgeFunction<Record<string, unknown>>('swish-market-value', {
      tenantId: input.tenantId,
      itemId: input.itemId,
      title: input.title.trim(),
      specialistId: input.specialistId,
      attributes: input.attributes,
      condition: input.condition,
      imageUrls: input.imageUrls,
      applyToItem: true,
    }, input.client);
    if (market.error) result.marketError = market.error.displayMessage;
    else if (market.data?.success === true && Object.keys(asRecord(market.data.valuation)).length) result.marketRefreshed = true;
    else result.marketError = String(market.data?.error || 'No verified market valuation was returned.');
  } else {
    result.marketError = 'Add a more specific item title before researching market value.';
  }

  try {
    await ensureScope();
    result.category = await lookupScopedListingCategory({
      client: input.client,
      userId: input.userId,
      tenantId: input.tenantId,
      nicheId: input.nicheId,
      title: input.title,
      attributes: input.attributes,
      isCurrent,
    });
  } catch (error) {
    result.categoryError = error instanceof Error ? error.message : 'eBay category lookup was unavailable.';
    return result;
  }

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

  await ensureScope();
  const current = await input.client.from('items').select('id,attributes,updated_at').eq('id', input.itemId).eq('tenant_id', input.tenantId).maybeSingle();
  if (current.error || !current.data?.id || !current.data.updated_at) throw new Error(current.error?.message || 'Saved item could not be read before applying eBay preparation.');
  const currentAttributes = asRecord(current.data.attributes);
  const prepared = {
    ...currentAttributes,
    ...(result.category ? { ebay_category_id: result.category.id, ebay_category_name: result.category.name } : {}),
    ...(result.aspects.length ? {
      ebay_item_specifics: result.specifics,
      ebay_required_specifics_missing: result.missingRequired,
    } : {}),
    ebay_listing_media: input.imageUrls,
  };
  const saved = await input.client.from('items').update({ attributes: prepared }).eq('id', input.itemId).eq('tenant_id', input.tenantId).eq('updated_at', current.data.updated_at).select('id').maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Item changed while saving eBay preparation. Open the saved item and retry preparation.');
  return result;
}
