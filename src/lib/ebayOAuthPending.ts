// Recovery metadata only: no JWT, eBay nonce, credentials or tenant authorization.
const LIFETIME_MS = 15 * 60 * 1000;
export function ebayOAuthKey(userId: string, tenantId: string): string {
  return `swish_ebay_oauth_started:${userId}:${tenantId}`;
}
export function isEbayOAuthPending(userId: string, tenantId: string): boolean {
  const value = sessionStorage.getItem(ebayOAuthKey(userId, tenantId));
  if (!value) return false;
  const started = Number(value);
  const elapsed = Date.now() - started;
  return Number.isFinite(started) && elapsed >= 0 && elapsed < LIFETIME_MS;
}
/** Timestamp of the particular fresh eBay consent attempt. A pre-existing
 * tenant connection or older member binding is NOT completion evidence. */
export function ebayOAuthStartedAt(userId: string, tenantId: string): number | null {
  if (!isEbayOAuthPending(userId, tenantId)) return null;
  const started = Number(sessionStorage.getItem(ebayOAuthKey(userId, tenantId)));
  return Number.isFinite(started) ? started : null;
}
export function beginEbayOAuth(userId: string, tenantId: string): void {
  sessionStorage.setItem(ebayOAuthKey(userId, tenantId), String(Date.now()));
}
export function clearEbayOAuth(userId: string, tenantId: string): void {
  sessionStorage.removeItem(ebayOAuthKey(userId, tenantId));
}
