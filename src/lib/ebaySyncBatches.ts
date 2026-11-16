import type { EbayBatchRunnerOptions, EbaySyncProgress, EbaySyncResult } from '@/types/ebaySync';
export async function runEbaySyncBatches(options: EbayBatchRunnerOptions): Promise<EbaySyncResult> {
  const totals: EbaySyncProgress = {processed:0,updated:0,failed:0,imagesFetched:0,titlesFixed:0,blocked:0,issues:[],partial:false};
  const seen = new Set<string>(); let afterListingId: string | undefined; let previousIssues = false;
  const result = (error: string | null, requiresReauth = false): EbaySyncResult => ({data:totals,error,requiresReauth});
  for (let page = 0; page < 500; page++) {
    if (options.isCurrent?.() === false) return result('Workspace changed; completed work is retained.');
    let response;
    try { response = await options.invoke({tenantId:options.tenantId,nicheId:options.nicheId,mode:'full',batch:true,...(afterListingId ? {afterListingId} : {}),...(previousIssues ? {previousIssues:true} : {})}); }
    catch (error) { return result(error instanceof Error ? error.message : 'Sync could not be confirmed.'); }
    const data = response.data;
    const issues = Array.isArray(data?.issues) ? data.issues as EbaySyncProgress['issues'] : [];
    const accountedPolicy = Boolean(data?.success === true && data.batchComplete === true && Number(data.failed) > 0 && Number(data.failed) === Number(data.blocked) && issues.length === Number(data.blocked) && issues.every(issue => String(issue.code) === '21920397'));
    if (!data || data.success !== true || response.requiresReauth || (response.error && !accountedPolicy) || (Number(data.failed) > 0 && !accountedPolicy)) return result(response.error || 'Sync was not confirmed. Refresh saved status before retrying.',response.requiresReauth);
    for (const key of ['processed','updated','failed','imagesFetched','titlesFixed','blocked'] as const) { const count = Number(data[key] || 0); if (!Number.isFinite(count) || count < 0) return result('Invalid sync counts returned.'); totals[key] += count; }
    totals.issues.push(...issues); if (accountedPolicy) {totals.partial = true; previousIssues = true;}
    options.onProgress?.({...totals,issues:[...totals.issues]});
    if (options.isCurrent?.() === false) return result('Workspace changed; completed work is retained.');
    const next = data.nextAfterListingId;
    if (next == null || next === '') return result(previousIssues ? 'Some listings were restricted by eBay policy 21920397. Review the reported issues.' : null);
    if (typeof next !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(next) || seen.has(next) || Number(data.processed) <= 0) return result('Sync continuation was invalid or repeated. Completed work is retained.');
    seen.add(next); afterListingId = next;
  }
  return result('Sync batch limit reached. Review saved status.');
}
