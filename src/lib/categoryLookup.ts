import { numismaticKind, usesNumismaticCategories, isNumismaticCategory } from '@/lib/coinCategoryPolicy';
import { coinCategoryContext, coinCategoryMismatch, coinCategoryRank, coinSearchPrefix } from '@/lib/coinCategoryContext';
import { taxonomyPayload, taxonomyRows, type TaxonomyRow } from '@/lib/ebayTaxonomyResponse';
export const CATEGORY_LOOKUP_VERSION = 'shared-quick-requirements-2026-11-26';
export interface CategorySuggestion { id: string; name: string; categoryPath?: string; }
export interface LookupResponse { data: unknown; error: { message: string; displayMessage?: string; status?: number } | null; }
export type InvokeCategory = (endpoint: string, body: Record<string, unknown>) => Promise<LookupResponse>;
export interface CategoryLookupContext { nicheId?: string; specialistId?: string; title?: string; attributes?: Record<string, unknown>; selectedCategory?: CategorySuggestion; isCurrent?: () => boolean; }
type MusicFormat = 'cd' | 'vinyl' | 'cassette' | null;
export function musicFormat(attributes: Record<string, unknown> = {}, title = ''): MusicFormat {
  const value = [attributes.format, attributes.formats, attributes.media_format, attributes.media_type, title]
    .map(value => typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')).join(' ');
  if (/\bvinyl\b|\blp\b|\b(?:7|12)[ -]?inch\b/i.test(value)) return 'vinyl';
  if (/\bcds?\b|compact discs?/i.test(value)) return 'cd';
  if (/cassette/i.test(value)) return 'cassette';
  return null;
}
/** A band's merchandise is not a recorded-music listing. */
export function isRecordedMusicCategory(row: Record<string, unknown>, format: MusicFormat): boolean {
  const name = String(row.name || '').trim(), path = `${String(row.categoryPath || '')} > ${name}`;
  if (/cloth|t[ -]?shirts?|apparel|memorabilia|merchandise|posters?|instruments?|sheet music|dvd|blu[ -]?ray|video games?|accessories|storage|cases|sleeves|cleaning|players?|turntables?|equipment/i.test(path)) return false;
  if (String(row.categoryPath || '').includes('>') && !/(?:^|>)\s*music\s*(?:>|$)/i.test(String(row.categoryPath))) return false;
  const categoryFormat = /\bcds?\b|compact discs?/i.test(name) ? 'cd' : /vinyl|\brecords?\b/i.test(name) ? 'vinyl' : /cassette/i.test(name) ? 'cassette' : null;
  if (categoryFormat) return !format || categoryFormat === format;
  return !format && /(?:^|>)\s*music\s*(?:>|$)/i.test(String(row.categoryPath || '')) && /^other (?:music )?formats?$/i.test(name);
}
/** Native quickRequirements searches the actual item title, not a second coin classification prompt. */
export function categorySearchQuery(title: string, niche: string, attributes: Record<string, unknown> = {}, specialistId = ''): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (usesNumismaticCategories(niche, specialistId, attributes) || niche !== 'tunes_flip') return clean.slice(0, 100);
  const format = musicFormat(attributes, clean);
  return `${format === 'vinyl' ? 'vinyl record' : format === 'cd' ? 'music CD' : format === 'cassette' ? 'music cassette' : 'recorded music album'} ${clean}`.slice(0, 100);
}
/** One lookup path for normal listing, capture and batch coins: selected category or title suggestions, then live requirements. */
export async function lookupListingCategory(tenantId: string | null, query: string, invoke: InvokeCategory, context: CategoryLookupContext = {}): Promise<CategorySuggestion> {
  if (!tenantId) throw new Error('Your SWISH workspace is not ready.');
  const text = query.trim();
  if (text.length < 2) throw new Error('Enter an item title before suggesting a category.');
  const coins = usesNumismaticCategories(context.nicheId, context.specialistId, context.attributes), music = context.nicheId === 'tunes_flip';
  const scope = coinCategoryContext(context.title || text, context.attributes), kind = numismaticKind(context.attributes, context.specialistId), format = musicFormat(context.attributes, context.title);
  const relevant = (row: TaxonomyRow) => (!music || isRecordedMusicCategory({ ...row }, format)) && (!coins || isNumismaticCategory({ ...row }, kind, scope.lot ? 'lot' : 'single') && !coinCategoryMismatch({ ...row }, scope));
  const project = (row: CategorySuggestion): CategorySuggestion => ({ id: row.id, name: row.name, ...(coins && row.categoryPath ? { categoryPath: row.categoryPath } : {}) });
  const request = async (endpoint: string, body: Record<string, unknown>) => {
    if (context.isCurrent?.() === false) throw new Error('Your workspace or category search changed. Retry from the active item.');
    const response = await invoke(endpoint, { tenantId, ...(context.nicheId ? { nicheId: context.nicheId } : {}), ...body });
    if (context.isCurrent?.() === false) throw new Error('Your workspace or category search changed. Retry from the active item.');
    if (response.error?.status === 401 || response.error?.status === 403) throw new Error(response.error.displayMessage || response.error.message);
    return response;
  };
  const failures: string[] = [], selected = context.selectedCategory;
  if (selected && /^[1-9]\d*$/.test(selected.id) && selected.name.trim() && relevant({ ...selected, categoryPath: selected.categoryPath || '' })) {
    const checked = await request('swish-ebay-category', { route: 'get_category_aspects', categoryId: selected.id, forceLive: true });
    const metadata = taxonomyPayload(checked.data);
    if (!checked.error && !metadata.error && metadata.success === true && metadata.isLeaf === true && metadata.marketplaceId === 'EBAY_GB' && String(metadata.categoryId) === selected.id) return project(selected);
    failures.push(checked.error?.displayMessage || checked.error?.message || String(metadata.error || 'Saved category could not be verified.'));
  }
  const fallback = coins ? scope.period !== 'ancient' && scope.country ? `${scope.country} ${kind}s${scope.lot ? ' lot' : ''}` : `${coinSearchPrefix(scope, kind)}s`
    : music ? format === 'cd' ? 'music CDs' : format === 'vinyl' ? 'vinyl records' : format === 'cassette' ? 'music cassettes' : 'recorded music albums' : '';
  const searches = [...new Set([coins ? (context.title || text).trim() : text, ...(fallback ? [fallback] : [])])];
  for (const search of searches) for (const endpoint of ['swish-ebay-category', 'swish-ebay-list']) {
    const response = await request(endpoint, { route: 'get_category_suggestions', query: search.slice(0, 100) });
    if (response.error) { failures.push(response.error.displayMessage || response.error.message); continue; }
    const payload = taxonomyPayload(response.data), rows = taxonomyRows(payload, 'suggestions').filter(row => row.isLeaf === true && relevant(row));
    if (coins) rows.sort((a, b) => coinCategoryRank({ ...b }, scope) - coinCategoryRank({ ...a }, scope));
    // Preserve eBay ranking when semantic scores tie, as the normal SWISH generator does.
    if (rows[0]) return project(rows[0]);
    failures.push(typeof payload.error === 'string' ? payload.error : coins ? 'No matching eBay coin category was returned by the shared listing service.' : music ? 'No matching recorded-music category was returned. Clothing and merchandise suggestions were rejected.' : 'No matching eBay leaf category was returned.');
  }
  throw new Error(`Category lookup unavailable. ${failures[failures.length - 1] || 'Retry from the saved draft.'}`);
}
