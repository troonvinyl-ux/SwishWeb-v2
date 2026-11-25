interface AcceptedPublication { externalId: string; }
const memory = new Map<string, AcceptedPublication>();
const storageKey = (scope: string) => `swish:accepted-publication:${scope}`;
/** Only an eBay-confirmed item number is retained, not tokens or a browser publish claim. */
export function readAcceptedPublication(scope: string): string | null {
  if (memory.has(scope)) return memory.get(scope)!.externalId;
  try {
    const value = localStorage.getItem(storageKey(scope)) || sessionStorage.getItem(storageKey(scope));
    return value && /^\d{6,20}$/.test(value) ? value : null;
  } catch { return null; }
}
export function retainAcceptedPublication(scope: string, externalId: string): void {
  if (!/^\d{6,20}$/.test(externalId)) return;
  memory.set(scope, { externalId });
  try { localStorage.setItem(storageKey(scope), externalId); } catch { /* Rapid queue journal and backend original claim still prevent re-publication. */ }
  try { sessionStorage.setItem(storageKey(scope), externalId); } catch { /* Keep in-memory recovery as a last resort. */ }
}
export function clearAcceptedPublication(scope: string): void {
  memory.delete(scope);
  try { localStorage.removeItem(storageKey(scope)); } catch { /* An uncleared journal is conservative: it cannot allow re-publication. */ }
  try { sessionStorage.removeItem(storageKey(scope)); } catch { /* Storage may be blocked. */ }
}
