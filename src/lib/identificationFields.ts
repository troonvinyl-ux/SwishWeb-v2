export interface IdentificationField { key: string; label: string; aliases: readonly string[]; column?: string; }
export const IDENTIFICATION_FIELDS: readonly IdentificationField[] = [
  { key: 'title', label: 'Title', aliases: ['canonicalTitle', 'canonical_title', 'title', 'name'], column: 'canonical_title' },
  { key: 'denomination', label: 'Denomination', aliases: ['denomination'], column: 'denomination' },
  { key: 'issuer', label: 'Issuer', aliases: ['issuer', 'issuingAuthority', 'issuing_authority'] },
  { key: 'ruler', label: 'Ruler / maker', aliases: ['ruler', 'monarch', 'manufacturer', 'maker', 'brand'], column: 'ruler' },
  { key: 'period', label: 'Period', aliases: ['period', 'era', 'datePeriod', 'date_period'], column: 'period' },
  { key: 'year', label: 'Year / date range', aliases: ['year', 'yearMade', 'year_made', 'yearRange', 'year_range', 'date'], column: 'year_made' },
  { key: 'mint', label: 'Mint', aliases: ['mint', 'mintLocation', 'mint_location'], column: 'mint' },
  { key: 'country', label: 'Country', aliases: ['country', 'countryOfOrigin', 'country_of_origin'], column: 'country_of_origin' },
  { key: 'metal', label: 'Material / composition', aliases: ['metal', 'composition', 'material', 'alloy'], column: 'material' },
  { key: 'reference', label: 'Catalogue reference / hint', aliases: ['reference', 'catalogueNumber', 'catalogue_number', 'catalogueHint', 'catalogue_hint', 'catalogue'], column: 'catalogue_number' },
  { key: 'condition', label: 'Visible condition', aliases: ['condition', 'conditionGrade', 'condition_grade'], column: 'condition' },
  { key: 'conditionNotes', label: 'Condition notes', aliases: ['conditionNotes', 'condition_notes'], column: 'condition_notes' },
  { key: 'obverseDescription', label: 'Obverse', aliases: ['obverseDescription', 'obverse_description', 'obverse'] },
  { key: 'reverseDescription', label: 'Reverse', aliases: ['reverseDescription', 'reverse_description', 'reverse'] },
  { key: 'legendFragment', label: 'Visible inscription', aliases: ['legendFragment', 'legend_fragment', 'visibleInscription', 'inscription'] },
  { key: 'description', label: 'Description', aliases: ['description', 'listingDescription', 'listing_description'], column: 'description' },
];
export function identificationText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
  const text = String(value).trim();
  return text && !/^(unknown|not (?:established|recorded|known|legible)|n\/a|none|null|undefined|unavailable|[-—])$/i.test(text) ? text : undefined;
}
