import { rapidDatabase } from '@/lib/rapidCoinDatabase';
import type { RapidCoinJob } from '@/types/rapidCoin';
export const RAPID_CONCURRENCY = 2;
const LEASE_MS = 180_000;
/** One atomic browser-wide claim limits active identification jobs across tabs. Never a marketplace claim. */
export async function claimRapidJob(scope: string, owner: string): Promise<RapidCoinJob | null> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite'), store = tx.objectStore('jobs'), r = store.index('scope').getAll(scope); let claimed: RapidCoinJob | null = null;
    r.onsuccess = () => {
      const jobs = r.result as RapidCoinJob[], now = Date.now();
      if (jobs.filter(job => job.processing === 'processing' && (job.lease?.until || 0) > now).length >= RAPID_CONCURRENCY) return;
      const next = jobs.sort((a, b) => a.createdAt - b.createdAt).find(job => job.enqueued && job.publication === 'none' && (job.processing === 'captured' || job.processing === 'processing' && (job.lease?.until || 0) <= now));
      if (!next) return;
      claimed = { ...next, processing: 'processing', lease: { owner, until: now + LEASE_MS }, updatedAt: now }; store.put(claimed);
    };
    tx.oncomplete = () => resolve(claimed); tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
export async function renewRapidClaim(id: string, scope: string, owner: string): Promise<boolean> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite'), store = tx.objectStore('jobs'), r = store.get(id); let renewed = false;
    r.onsuccess = () => { const job = r.result as RapidCoinJob | undefined; if (job?.scope === scope && job.lease?.owner === owner && job.processing === 'processing') { renewed = true; store.put({ ...job, lease: { owner, until: Date.now() + LEASE_MS } }); } };
    tx.oncomplete = () => resolve(renewed); tx.onerror = tx.onabort = () => reject(tx.error);
  });
}
