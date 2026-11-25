import type { SwishNicheId } from '@/lib/niche';
import type { CapturePhoto } from '@/types/capture';
export interface StudioRetainedPhoto { slotId: string; label: string; file: File; }
export interface StudioSession { userId: string; tenantId: string; niche: SwishNicheId | null; photos: StudioRetainedPhoto[]; notes: string; updatedAt: number; handedOff: boolean; }
export interface StudioObservation { title: string; next: string; warnings: string[]; result: Record<string, unknown>; }
export interface StudioCameraExtras { photos?: CapturePhoto[]; processing?: boolean; guidance?: string; onSelectPhoto?: (id: string) => void; onRemovePhoto?: (id: string) => void; onMovePhoto?: (id: string, direction: number) => void; }
