export interface CategorySuggestion { id: string; name: string; }
interface LookupResponse { data: unknown; error: { message: string; displayMessage?: string; status?: number } | null; }
type InvokeCategory = (endpoint: string, body: Record<string, unknown>) => Promise<LookupResponse>;
export interface CategoryLookupContext { nicheId?: string; title?: string; attributes?: Record<string, unknown>; }
type MusicFormat = 'cd' | 'vinyl' | 'cassette' | null;
export function musicFormat(attributes: Record<string, unknown> = {}, title = ''): MusicFormat {
  const value = String(attributes.format || attributes.media_format || attributes.media_type || title);
  if (/\bvinyl\b|\blp\b|\b(?:7|12)[ -]?inch\b/i.test(value)) return 'vinyl';
  if (/\bcds?\b|compact discs?/i.test(value)) return 'cd';
  if (/cassette/i.test(value)) return 'cassette';
  return null;
}
/** Band names also return merchandise. Leaf status alone is not music relevance. */
export function isRecordedMusicCategory(row: Record<string, unknown>, format: MusicFormat): boolean {
  const name = String(row.name || '').trim();
  const path = `${String(row.categoryPath || '')} > ${name}`;
  if (/cloth|t[ -]?shirts?|apparel|memorabilia|merchandise|posters?|instruments?|sheet music|dvd|blu[ -]?ray|video games?|accessories|storage|cases|sleeves|cleaning|players?|turntables?|equipment/i.test(path)) return false;
  if (String(row.categoryPath || '').includes('>') && !/(?:^|>)\s*music\s*(?:>|$)/i.test(String(row.categoryPath))) return false;
  const categoryFormat = /\bcds?\b|compact discs?/i.test(name) ? 'cd' : /vinyl|\brecords?\b/i.test(name) ? 'vinyl' : /cassette/i.test(name) ? 'cassette' : null;
  if (categoryFormat) return !format || categoryFormat === format;
  return !format && /(?:^|>)\s*music\s*(?:>|$)/i.test(String(row.categoryPath || '')) && /^other (?:music )?formats?$/i.test(name);
}

/** Retain the title and add only the music format actually recorded by the seller. */
export function categorySearchQuery(title: string, niche: string, attributes: Record<string, unknown> = {}): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (niche !== 'tunes_flip') return clean.slice(0, 100);
  const format = musicFormat(attributes, clean);
  const context = format === 'vinyl' ? 'vinyl record' : format === 'cd' ? 'music CD' : format === 'cassette' ? 'music cassette' : 'music';
  return `${context} ${clean}`.slice(0, 100);
}

/** Shared read-only service fallback. Never invent category IDs or relax leaf checks. */
export async function lookupListingCategory(tenantId: string | null, query: string, invoke: InvokeCategory, context: CategoryLookupContext = {}): Promise<CategorySuggestion> {
  if (!tenantId) throw new Error('Your SWISH workspace is not ready.');
  const text = query.trim();
  if (text.length < 2) throw new Error('Enter an item title before suggesting a category.');
  const failures: string[] = [];
  const music = context.nicheId === 'tunes_flip';
  const format = musicFormat(context.attributes, context.title);
  const formatQuery = format === 'cd' ? 'music CDs' : format === 'vinyl' ? 'vinyl records' : format === 'cassette' ? 'music cassettes' : null;
  const queries = music && formatQuery && text.toLowerCase() !== formatQuery.toLowerCase() ? [text, formatQuery] : [text];
  for (const search of queries) {
  for (const endpoint of ['swish-ebay-category', 'swish-ebay-list']) {
    let result: LookupResponse;
    try { result = await invoke(endpoint, { route: 'get_category_suggestions', tenantId, query: search.slice(0, 100) }); }
    catch (error) { failures.push(error instanceof Error ? error.message : 'Category service could not be reached.'); continue; }
    if (result.error) {
      if (result.error.status === 401 || result.error.status === 403) throw new Error(result.error.displayMessage || result.error.message);
      failures.push(result.error.displayMessage || result.error.message); continue;
    }
    const payload = result.data && typeof result.data === 'object' ? result.data as Record<string, unknown> : {};
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
    if (payload.success === true) {
      for (const entry of suggestions) {
        if (!entry || typeof entry !== 'object') continue;
        const row = entry as Record<string, unknown>;
        const id = String(row.id ?? '').trim();
        if (/^[1-9]\d*$/.test(id) && typeof row.name === 'string' && row.name.trim() && row.isLeaf === true && (!music || isRecordedMusicCategory(row, format))) return { id, name: row.name.trim() };
      }
    }
    failures.push(typeof payload.error === 'string' ? payload.error : music ? 'No matching recorded-music category was returned. Clothing and merchandise suggestions were rejected.' : 'No matching eBay leaf category was returned.');
  }
  }
  throw new Error(`Category lookup unavailable. ${failures[failures.length - 1] || 'Try again with the artist, title and music format.'}`);
}
