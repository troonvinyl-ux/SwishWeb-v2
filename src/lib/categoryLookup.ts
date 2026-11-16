export interface CategorySuggestion { id: string; name: string; }
interface LookupResponse { data: unknown; error: { message: string; displayMessage?: string; status?: number } | null; }
type InvokeCategory = (endpoint: string, body: Record<string, unknown>) => Promise<LookupResponse>;

/** Retain the title and add only the music format actually recorded by the seller. */
export function categorySearchQuery(title: string, niche: string, attributes: Record<string, unknown> = {}): string {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (niche !== 'tunes_flip') return clean.slice(0, 100);
  const format = String(attributes.format || attributes.media_format || '').trim();
  const context = /\bvinyl\b|\blp\b/i.test(format) ? 'vinyl record' : /\bcd\b|compact disc/i.test(format) ? 'music CD' : /cassette/i.test(format) ? 'music cassette' : 'music';
  return `${context} ${clean}`.slice(0, 100);
}

/** Shared read-only service fallback. Never invent category IDs or relax leaf checks. */
export async function lookupListingCategory(tenantId: string | null, query: string, invoke: InvokeCategory): Promise<CategorySuggestion> {
  if (!tenantId) throw new Error('Your SWISH workspace is not ready.');
  const text = query.trim();
  if (text.length < 2) throw new Error('Enter an item title before suggesting a category.');
  const failures: string[] = [];
  for (const endpoint of ['swish-ebay-category', 'swish-ebay-list']) {
    let result: LookupResponse;
    try { result = await invoke(endpoint, { route: 'get_category_suggestions', tenantId, query: text.slice(0, 100) }); }
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
        if (/^[1-9]\d*$/.test(id) && typeof row.name === 'string' && row.name.trim() && row.isLeaf === true) return { id, name: row.name.trim() };
      }
    }
    failures.push(typeof payload.error === 'string' ? payload.error : 'No matching eBay leaf category was returned.');
  }
  throw new Error(`Category lookup unavailable. ${failures[failures.length - 1] || 'Try again with the artist, title and music format.'}`);
}
