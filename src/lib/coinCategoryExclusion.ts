/** Category labels only, never coin titles or catalogue references used as evidence. */
export function coinCategoryExclusion(row: Record<string, unknown>): string | null {
  const labels = `${String(row.categoryPath ?? '')} > ${String(row.name ?? '')}`;
  if (/\b(?:publications?|literature|catalog(?:ue)?s?|price[ -]?guides?|reference (?:books?|works?|guides?|material)|magazines?|journals?|periodicals?|newsletters?|manuals?)\b/i.test(labels)) {
    return 'Publications and reference-material categories are for books about coins, not the physical numismatic item being sold.';
  }
  if (/\b(?:art|prints?|paintings?|posters?|photographs?|photography|drawings?|sculptures?|books?|jewellery|jewelry|clothing|supplies|equipment|holders?|albums?|capsules?|storage|accessories|replica moulds?)\b/i.test(labels)) {
    return 'This category is for artwork, reference material or accessories, not the physical numismatic item being sold.';
  }
  return null;
}
