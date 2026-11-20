export const SCAN_TO_LIVE_TARGET_SECONDS = 69;
export interface ScanToLiveTiming { startedAt: number; liveAt?: number; externalId?: string; }
const PREFIX = 'swish-scan-to-live:';
function read(key: string): ScanToLiveTiming | null {
  try { const raw = sessionStorage.getItem(PREFIX + key), value = raw ? JSON.parse(raw) as ScanToLiveTiming : null; return value && Number.isFinite(value.startedAt) ? value : null; } catch { return null; }
}
function write(key: string, value: ScanToLiveTiming) { try { sessionStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* Timing is optional; never block stock or publication on browser storage. */ } }
export function beginScanToLive(sessionKey: string) { if (!read(sessionKey)) write(sessionKey, { startedAt: Date.now() }); }
export function linkScanToLive(sessionKey: string, listingKey: string) { const timing = read(sessionKey); if (timing && !read(listingKey)) write(listingKey, timing); }
export function readScanToLive(listingKey: string) { return read(listingKey); }
/** Record live only after the same eBay ID and active status have been confirmed by readback. */
export function completeScanToLive(listingKey: string, externalId: string) { const timing = read(listingKey); if (timing && /^\d+$/.test(externalId) && !timing.liveAt) write(listingKey, { ...timing, liveAt: Date.now(), externalId }); }
