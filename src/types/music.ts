import type { CapturePhoto, CaptureScope } from '@/types/capture';
export interface MusicPhoto extends CapturePhoto { analysisFile?: File; analysisNote?: string; }
export type MusicSource = 'image_extracted' | 'ai_inferred' | 'discogs' | 'user';
export interface MusicField { value: string; source: MusicSource; confidence: number | null; reviewed?: boolean; }
export type MusicFields = Record<string, MusicField>;
export interface MusicCandidate { id: number; title: string; year: string; country: string; format: string[]; labels: string[]; catalogueNumbers: string[]; url: string; }
export interface MusicIdentifier { type: string; value: string; description: string; }
export interface MusicTrack { position: string; title: string; duration: string; }
export interface MusicRelease extends MusicCandidate { artist: string; releaseTitle: string; released: string; masterId: number | null; discCount?: number | null; genres: string[]; styles: string[]; identifiers: MusicIdentifier[]; tracks: MusicTrack[]; fetchedAt: string; expiresAt: string; }
export interface MusicMatch { candidate: MusicCandidate; release?: MusicRelease; score: number; agreements: string[]; contradictions: string[]; }
export interface MusicAnalysis { fields: MusicFields; warnings: string[]; followUp: string; }
export interface MusicPrice { market: number; quick: number; minimum: number; confidence: string; basis: 'sold_supported_estimate' | 'asking_context_estimate' | 'ai_only_estimate'; explanation: string; warnings: string[]; researchedAt: string; }
export interface MusicValues { artist: string; release_title: string; format: string; barcode: string; catalogue_number: string; label: string; year: string; country: string; matrix_runout: string; media_grade: string; sleeve_grade: string; condition_notes: string; edition: string; record_size: string; speed: string; observed_disc_count: string; genre: string; style: string; rights_society: string; label_code: string; features: string; title: string; description: string; price: string; location: string; play_tested: boolean; reviewed: boolean; pressing_reviewed: boolean; }
export interface MusicSnapshot { values: MusicValues; fields: MusicFields; photos: MusicPhoto[]; release: MusicRelease | null; pricing: MusicPrice | null; }
export interface MusicSaveCheckpoint { itemId: string; inserted?: boolean; photos?: Record<string, string>; listingId?: string; draftAttempted?: boolean; snapshot?: MusicSnapshot; }
export interface MusicSaveInput { scope: CaptureScope; snapshot: MusicSnapshot; checkpoint: MusicSaveCheckpoint; draft: boolean; progress: (message: string) => void; }
