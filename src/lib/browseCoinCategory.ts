import { coinCategoryContext, coinCategoryMismatch, coinCategoryRank } from '@/lib/coinCategoryContext';
import { isNumismaticCategory } from '@/lib/coinCategoryPolicy';
import { taxonomyPayload, taxonomyRows } from '@/lib/ebayTaxonomyResponse';
import type { CoinCategoryContext } from '@/lib/coinCategoryContext';
import type { NumismaticKind } from '@/lib/coinCategoryPolicy';
import type { CategorySuggestion, InvokeCategory } from '@/lib/categoryLookup';
interface BrowseInput { tenantId: string; nicheId?: string; context: CoinCategoryContext; kind: NumismaticKind; invoke: InvokeCategory; isCurrent?: () => boolean; onServiceError?: (message: string) => void; }
interface Branch { id: string; path: string[]; priority: number; }
const EUROPE = new Set(['Russia', 'Hungary', 'Austria', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Poland', 'Netherlands', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Switzerland', 'Greece', 'Ireland', 'Britain']);
/** Bounded live-tree traversal. Root sentinel is never returned as a listing category. */
export async function browseCoinCategory(input: BrowseInput): Promise<CategorySuggestion | null> {
  if (!input.context.country || input.context.lot || input.kind !== 'coin' || input.context.period === 'ancient') return null;
  const assertCurrent = () => { if (input.isCurrent?.() === false) throw new Error('Your workspace or category search changed. Retry from the active item.'); };
  const queue: Branch[] = [{ id: '0', path: [], priority: 0 }], visited = new Set<string>();
  const leaves: Array<{ id: string; name: string; categoryPath: string }> = [];
  let requests = 0;
  while (queue.length && requests < 10) {
    queue.sort((a, b) => b.priority - a.priority);
    const parent = queue.shift()!;
    if (visited.has(parent.id) || parent.path.length > 6) continue;
    visited.add(parent.id);
    let children: ReturnType<typeof taxonomyRows> = [];
    // Existing service revisions may represent root by zero or null. Try null only for an empty root response.
    for (const root of parent.id === '0' ? ['0', null] : [parent.id]) {
      for (const endpoint of ['swish-ebay-category', 'swish-ebay-list']) {
        if (requests >= 10) break;
        assertCurrent(); requests++;
        const response = await input.invoke(endpoint, { route: 'get_category_children', tenantId: input.tenantId, ...(input.nicheId ? { nicheId: input.nicheId } : {}), parentId: root });
        assertCurrent();
        if (response.error?.status === 401 || response.error?.status === 403) throw new Error(response.error.displayMessage || response.error.message);
        const payload = taxonomyPayload(response.data);
        if (response.error || payload.success === false || payload.error) { input.onServiceError?.(response.error?.displayMessage || response.error?.message || String(payload.error || 'Category tree unavailable.')); continue; }
        children = taxonomyRows(payload, 'children');
        if (children.length) break;
      }
      if (children.length) break;
    }
    for (const node of children) {
      const path = [...parent.path, node.name], row = { id: node.id, name: node.name, categoryPath: node.categoryPath || path.join(' > ') };
      if (node.isLeaf === true) {
        if (isNumismaticCategory(row, input.kind) && !coinCategoryMismatch(row, input.context)) leaves.push(row);
        continue;
      }
      if (!parent.path.length && !/^coins?\b/i.test(node.name)) continue;
      if (/\b(?:ancient|banknotes?|tokens?|medals?|supplies|accessories|collections?|lots?)\b/i.test(node.name)) continue;
      const country = coinCategoryContext('', { country: node.name }).country;
      if (country && country !== input.context.country) continue;
      if (EUROPE.has(input.context.country) && /\b(?:Asian|African|American|Oceanian|Australasian)\b/i.test(node.name)) continue;
      if (input.context.country !== 'Britain' && /\b(?:British|Commonwealth)\b/i.test(node.name)) continue;
      if (/hammered|medieval/i.test(node.name) && input.context.period !== 'hammered') continue;
      const priority = country === input.context.country ? 100 : /European/i.test(node.name) && EUROPE.has(input.context.country) ? 50 : /^coins?$/i.test(node.name) ? 40 : 0;
      queue.push({ id: node.id, path, priority });
    }
    if (leaves.length) break;
  }
  leaves.sort((a, b) => coinCategoryRank(b, input.context) - coinCategoryRank(a, input.context));
  const chosen = leaves[0];
  if (!chosen || leaves.some(row => row.id !== chosen.id && coinCategoryRank(row, input.context) === coinCategoryRank(chosen, input.context))) return null;
  console.log('[SWISH coin taxonomy] country branch resolved', { country: input.context.country, categoryId: chosen.id, requests });
  return chosen;
}
