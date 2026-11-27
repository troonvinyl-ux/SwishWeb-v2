import type { CaptureCheckpoint, CaptureDraft } from '@/types/capture';
export type RapidMode = 'standard' | 'envelope';
export type RapidProcessing = 'captured' | 'processing' | 'ready' | 'needs_attention';
export type RapidPublication = 'none' | 'draft_saved' | 'publishing' | 'published' | 'accepted_pending' | 'uncertain';
export type EvidenceSource = 'visual' | 'collector' | 'catalogue' | 'seller' | 'unresolved';
export interface CoinEvidenceField { name: string; value: string; source: EvidenceSource; note: string; }
export interface CollectorEvidence { transcription: string; fields: CoinEvidenceField[]; discrepancies: string[]; transcriptionAvailable: boolean; }
export interface RapidPhoto { id: string; slotId: string; label: string; role: 'coin' | 'evidence'; name: string; type: string; }
export interface RapidCoinJob {
  id: string; scope: string; userId: string; tenantId: string; batchId: string; sequence: number; mode: RapidMode;
  createdAt: number; updatedAt: number; photos: RapidPhoto[]; answers: Record<string, string>; enqueued: boolean;
  processing: RapidProcessing; publication: RapidPublication; checkpoint: CaptureCheckpoint; draft?: CaptureDraft;
  evidence?: CollectorEvidence; message: string; externalId?: string; lease?: { owner: string; until: number };
  deferred?: boolean; feedbackId?: string;
  publicationAttempt?: { id: string; startedAt: number; outcome: 'pending' | 'rejected' | 'uncertain' | 'accepted'; error?: string };
}
export const RAPID_STATUS: Record<RapidProcessing | RapidPublication, string> = {
  captured: 'Captured', processing: 'Processing', ready: 'Ready to review', needs_attention: 'Needs attention',
  none: 'Captured', draft_saved: 'Draft saved', publishing: 'Publishing', published: 'Published',
  accepted_pending: 'Publication accepted — reconciliation pending', uncertain: 'Needs attention · check original submission',
};
export function rapidJobStatus(job: RapidCoinJob): string { return RAPID_STATUS[job.publication !== 'none' ? job.publication : job.processing]; }
export function rapidCanPublish(job: RapidCoinJob): boolean {
  return job.processing === 'ready' && Boolean(job.checkpoint.listingId) && !job.externalId && ['none', 'draft_saved'].includes(job.publication);
}
