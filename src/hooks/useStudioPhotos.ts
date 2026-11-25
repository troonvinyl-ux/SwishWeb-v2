import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { assertStudioPhotoBudget, moveStudioPhoto } from '@/lib/listingStudioSession';
import { nextStudioSlot } from '@/lib/listingStudioGuidance';
import type { StudioSession } from '@/types/listingStudio';
import type { SwishNicheId } from '@/lib/niche';
interface StudioPhotosOptions { session: StudioSession | null; niche: SwishNicheId | null; userId: string; tenantId: string; selected: string; retain: (session: StudioSession) => void; onAdded: () => void; }
export function useStudioPhotos(options: StudioPhotosOptions) {
  const latest = useRef(options); latest.current = options;
  const retained = options.session?.photos;
  const photos = useMemo(() => (retained || []).map(photo => ({ ...photo, preview: URL.createObjectURL(photo.file) })), [retained]);
  useEffect(() => () => photos.forEach(photo => URL.revokeObjectURL(photo.preview)), [photos]);
  const replace = useCallback((files: File[]) => {
    const value = latest.current; if (!value.userId || !value.tenantId) { toast.error('Your account and workspace must be ready before retaining photos.'); return; }
    let next = [...(value.session?.photos || [])];
    for (const file of files) {
      if (!file.size || file.type && !file.type.startsWith('image/')) { toast.error('Choose a non-empty original image.'); continue; }
      const slot = nextStudioSlot(value.niche, next, files.length === 1 ? value.selected : '');
      const candidate = [...next.filter(photo => photo.slotId !== slot.id), { slotId: slot.id, label: slot.label, file }];
      try { assertStudioPhotoBudget(candidate); next = candidate; } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Photo limit reached.'); break; }
    }
    value.retain({ userId: value.userId, tenantId: value.tenantId, niche: value.niche, photos: next, notes: value.session?.notes || '', updatedAt: Date.now(), handedOff: false }); value.onAdded();
  }, []);
  const remove = useCallback((id: string) => { const value = latest.current; if (value.session) value.retain({ ...value.session, photos: value.session.photos.filter(photo => photo.slotId !== id), updatedAt: Date.now() }); }, []);
  const move = useCallback((id: string, direction: number) => { const value = latest.current; if (value.session) value.retain({ ...value.session, photos: moveStudioPhoto(value.session.photos, id, direction), updatedAt: Date.now() }); }, []);
  return { photos, replace, remove, move };
}
