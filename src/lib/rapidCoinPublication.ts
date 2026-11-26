import { rapidJobs, changeRapidJob } from '@/lib/rapidCoinDatabase';
import { rapidCanPublish } from '@/types/rapidCoin';
import type { RapidPublication } from '@/types/rapidCoin';
async function linkedJob(userId: string, tenantId: string, listingId: string) {
  return (await rapidJobs(`${userId}:${tenantId}`)).find(job => job.checkpoint.listingId === listingId);
}
/** Journal an original submission BEFORE sending it. Uncertain publication is never automatically retryable. */
export async function beginRapidPublication(userId: string, tenantId: string, listingId: string): Promise<boolean> {
  const job = await linkedJob(userId, tenantId, listingId); if (!job) return false;
  await changeRapidJob(job.id, job.scope, current => {
    if (!rapidCanPublish(current)) throw new Error('This coin has an earlier or uncertain submission. Refresh its original status; do not republish.');
    return { ...current, publication: 'publishing', message: 'Original eBay submission in progress. Do not submit this coin again.' };
  });
  return true;
}
export async function rapidPublicationBlocked(userId: string, tenantId: string, listingId: string): Promise<boolean> {
  const job = await linkedJob(userId, tenantId, listingId); return Boolean(job && !rapidCanPublish(job));
}
export async function recordRapidPublication(userId: string, tenantId: string, listingId: string, publication: RapidPublication, externalId?: string): Promise<void> {
  const job = await linkedJob(userId, tenantId, listingId); if (!job) return;
  if (externalId && !/^\d{6,20}$/.test(externalId)) throw new Error('Invalid accepted eBay item number.');
  await changeRapidJob(job.id, job.scope, current => {
    if (externalId && current.externalId && externalId !== current.externalId) throw new Error('Accepted marketplace identity changed. Stop and inspect the original claim.');
    if (publication === 'draft_saved' && !['none', 'draft_saved'].includes(current.publication)) return current;
    if (publication === 'published' && !externalId) throw new Error('Verified marketplace identity is required for reconciliation.');
    return { ...current, publication: current.externalId && publication === 'uncertain' ? 'accepted_pending' : publication,
      externalId: externalId || current.externalId,
      message: publication === 'published' ? 'Existing eBay listing and canonical stock reconciled.' : publication === 'draft_saved' ? 'Saved in SWISH; not submitted to eBay.' : 'Check the original submission. No automatic republish is permitted.' };
  });
}
