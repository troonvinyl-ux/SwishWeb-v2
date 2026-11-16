import type { SwishNicheId } from '@/lib/niche';

export interface ModuleScope { tenant_id: string; niche_id: SwishNicheId; }
export interface EbaySyncIssue { code?: string; listingId?: string; externalListingId?: string; error?: string; message?: string; }
export interface EbaySyncProgress {
  processed: number; updated: number; failed: number; imagesFetched: number;
  titlesFixed: number; blocked: number; issues: EbaySyncIssue[]; partial: boolean;
}
export interface EbaySyncResult { data: EbaySyncProgress | null; error: string | null; requiresReauth: boolean; }
export interface EbayBatchResponse { data: Record<string, unknown> | null; error: string | null; requiresReauth: boolean; }
export interface EbaySyncOptions { isCurrent?: () => boolean; onProgress?: (data: EbaySyncProgress) => void; }
export interface EbayBatchRunnerOptions extends EbaySyncOptions {
  tenantId: string; nicheId: SwishNicheId;
  invoke: (body: Record<string, unknown>) => Promise<EbayBatchResponse>;
}
