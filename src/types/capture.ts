import type { SupabaseClient } from '@supabase/supabase-js';
import type { SwishNicheId } from '@/lib/niche';
import type { NumistaReference } from '@/types/numista';
import type { ScanListingEnrichment } from '@/lib/scanListingEnrichment';
export interface CaptureSlot { id: string; label: string; description: string; required: boolean; }
export interface CaptureField { key: string; label: string; }
export interface CaptureMode { id: string; label: string; }
export interface NativeCaptureProfile { slots: CaptureSlot[]; fields: CaptureField[]; modes: CaptureMode[]; focus: string; barcode: 'start' | 'optional' | 'disabled'; }
export interface CapturePhoto { slotId: string; label: string; file: File; preview: string; }
export interface CaptureScope { client: SupabaseClient; userId: string; tenantId: string; nicheId: SwishNicheId; sessionId: string; isCurrent: () => boolean; }
export interface CaptureCheckpoint { envelopeReadAttempted?: boolean; envelopeReadError?: string; coinStudio?: { prepared: boolean; photos: string[]; warnings: string[] }; itemAttempted?: boolean; draftAttempted?: boolean; draftFailure?: { outcome: 'rejected' | 'uncertain'; code: string; message: string }; identification?: Record<string, unknown>; itemId?: string; photos?: Record<string, string>; generated?: Record<string, unknown>; preparation?: ScanListingEnrichment; listingId?: string; }
export interface CaptureDraft { itemId: string; listingId: string; title: string; description: string; price: number | null; photos: string[]; warnings: string[]; numistaReference?: NumistaReference | null; numistaResearch?: Record<string, unknown>; }
