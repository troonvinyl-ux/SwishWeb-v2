/** Carry seller-edited coin identity across category changes; discard the previous branch's unrelated specifics. */
export function retainedCoinIdentitySpecifics(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([name, entry]) => {
    const key = name.toLowerCase().replace(/[^a-z]/g, '');
    return /^(?:country|countryregionoforigin|countryoforigin|year|date|yearofissue|denomination|ruler|monarch|sovereign|composition|metal|material|alloy|mint|mintlocation)$/.test(key) && typeof entry === 'string' && Boolean(entry.trim());
  })) as Record<string, string>;
}
