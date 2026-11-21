import { asRecord } from '@/lib/itemPhotos';
export interface EbayAspect { name: string; values: string[]; selectionOnly: boolean; }
export interface EbayCondition { id: string; label: string; }
export const EBAY_MUSIC_GRADES = [
  ['M', 'Mint (M)'], ['NM', 'Near Mint (NM or M-)'], ['EX', 'Excellent (EX)'],
  ['VG+', 'Very Good Plus (VG+)'], ['VG', 'Very Good (VG)'], ['G+', 'Good Plus (G+)'],
  ['G', 'Good (G)'], ['F', 'Fair (F)'], ['W', 'Worn (W)'],
] as const;
/** Legacy labels for displaying already-saved IDs only; these are NOT category permission rules. */
export const EBAY_MUSIC_CONDITIONS: EbayCondition[] = [{ id: '1000', label: 'Brand New' }, { id: '3000', label: 'Used' }, { id: '2750', label: 'Like New' }, { id: '4000', label: 'Very Good' }, { id: '5000', label: 'Good' }, { id: '6000', label: 'Acceptable' }];
/** Never assume a grade such as VG is a valid eBay item condition.
 * The live Sell Metadata condition policy is authoritative for each leaf category. */
export function normalizeEbayConditionPolicy(input: unknown, categoryId: string): { conditions: EbayCondition[]; required: boolean } {
  const policy = asRecord(input);
  if (String(policy.categoryId ?? '') !== categoryId || typeof policy.itemConditionRequired !== 'boolean' || !Array.isArray(policy.itemConditions)) {
    throw new Error('eBay did not return a valid condition policy for this category. Retry the lookup.');
  }
  const seen = new Set<string>();
  const conditions: EbayCondition[] = [];
  for (const value of policy.itemConditions) {
    const row = asRecord(value), id = String(row.conditionId ?? ''), label = String(row.conditionDescription ?? '').trim();
    if (!/^\d+$/.test(id) || !label || seen.has(id)) continue;
    seen.add(id); conditions.push({ id, label });
  }
  if (policy.itemConditionRequired && !conditions.length) throw new Error('eBay requires a condition but returned no choices. Retry the lookup.');
  return { conditions, required: policy.itemConditionRequired };
}
export function supportedEbayCondition(selected: unknown, choices: EbayCondition[], required: boolean): boolean {
  const id = String(selected ?? '').trim();
  return !required && !id ? true : choices.some(choice => choice.id === id);
}
/** Fallback for the ONE category whose live backend response was observed
 * rejecting Very Good and naming New / Used (EBAY_GB Vinyl Records 176985).
 * Not a fresh policy lookup. May display while metadata is pending, disabled,
 * or failed, and must never automatically select a condition. The backend
 * validates the true current policy again before any marketplace publication. */
export function vinylConditionRecovery(
  categoryId: string, specialistId: string, livePolicyUnavailable: boolean,
): { conditions: EbayCondition[]; conditionRequired: boolean; source: 'observed-recovery' } | null {
  if (!livePolicyUnavailable || categoryId !== '176985' || specialistId !== 'vinyl_records') return null;
  return {
    conditions: [{ id: '1000', label: 'New' }, { id: '3000', label: 'Used' }],
    conditionRequired: true,
    source: 'observed-recovery',
  };
}
export function musicGradeCode(value: unknown): string {
  const text = String(value ?? '').trim();
  const found = EBAY_MUSIC_GRADES.find(([code, label]) => code === text.toUpperCase() || label.toLowerCase() === text.toLowerCase());
  if (found) return found[0];
  if (/^(near mint|nm|m-)(?:\s*\([^)]*\))?$/i.test(text)) return 'NM';
  if (/^(poor|p)(?:\s*\(p\))?$/i.test(text)) return 'P';
  return text;
}
export function ebayMusicGrade(value: unknown, allowed: string[] = []): string {
  const code = musicGradeCode(value), target = code === 'P' ? 'W' : code;
  const label = EBAY_MUSIC_GRADES.find(([key]) => key === target)?.[1] || String(value ?? '').trim();
  if (!allowed.length) return label;
  return allowed.find(entry => entry.toLowerCase() === label.toLowerCase() || musicGradeCode(entry) === target) || label;
}
export function ebayConditionId(value: unknown): string {
  const text = String(value ?? '').trim().replace(/[–—]/g, '-').replace(/^used\s*-\s*/i, '').toLowerCase();
  if (/^\d+$/.test(text)) return text;
  if (/^(new|brand new|new\/factory sealed)$/.test(text)) return '1000';
  if (text === 'for parts' || text === 'for parts or not working') return '7000';
  if (text === 'used' || text === 'pre-owned') return '3000';
  return EBAY_MUSIC_CONDITIONS.find(row => row.label.toLowerCase() === text)?.id || '';
}
export function normalizeEbayAspects(input: unknown): EbayAspect[] {
  if (!Array.isArray(input)) return [];
  return input.map(raw => { const row = asRecord(raw), constraint = asRecord(row.aspectConstraint); return { name: String(row.localizedAspectName || row.aspectName || row.name || '').trim(), values: (Array.isArray(row.aspectValues) ? row.aspectValues.map(value => String(asRecord(value).localizedValue || '')) : Array.isArray(row.values) ? row.values.map(String) : []).filter(Boolean), selectionOnly: (constraint.aspectMode || row.mode) === 'SELECTION_ONLY' }; }).filter(row => row.name);
}
export function musicGradeAspects(format: unknown): { media: string; sleeve: string } {
  const text = String(format ?? '');
  return /cassette/i.test(text) ? { media: 'Cassette Condition', sleeve: 'Case Condition' } : /\bcd\b|compact disc/i.test(text) ? { media: 'CD Grading', sleeve: 'Case Condition' } : { media: 'Record Grading', sleeve: 'Sleeve Grading' };
}
/** Preserve unrelated seller specifics; only translate condition vocabulary, never re-grade an item. */
export function normalizeMusicSpecifics(input: Record<string, string>, aspects: EbayAspect[] = []): Record<string, string> {
  return Object.fromEntries(Object.entries(input).map(([name, value]) => { const aspect = aspects.find(row => row.name.toLowerCase() === name.toLowerCase()); const grading = /^(record grading|sleeve grading|cd grading|cassette condition|case condition|inlay condition)$/i.test(name); return [aspect?.name || name, grading ? ebayMusicGrade(value, aspect?.values) : value]; }));
}
