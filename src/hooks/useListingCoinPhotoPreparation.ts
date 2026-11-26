import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { prepareSavedCoinPhotos } from '@/lib/itemStudio';
import type { useListingEditorDraft } from '@/hooks/useListingEditorDraft';
/** The existing shared engine: no second renderer, generated coin pixels or marketplace writes. */
export function useListingCoinPhotoPreparation(draft: ReturnType<typeof useListingEditorDraft>, userId: string | undefined, tenantId: string | null) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const working = useRef(false), identity = `${userId}:${tenantId}:${draft.form.item_id}`, current = useRef(identity); current.current = identity;
  useEffect(() => { current.current = identity; setMessage(''); setBusy(working.current); return () => { current.current = ''; }; }, [identity]);
  const prepare = async () => {
    if (working.current || !userId || !tenantId || !draft.item || draft.item.specialist_id !== 'coins') return;
    const itemId = String(draft.item.id), photos = itemPhotos(draft.item);
    const roles = Array.isArray(asRecord(draft.item.attributes)._rapid_photo_roles) ? (asRecord(draft.item.attributes)._rapid_photo_roles as unknown[]).map(asRecord) : [];
    const originals = ['obverse', 'reverse'].map(side => String(roles.find(role => role.slotId === side)?.original || '')).filter(Boolean);
    const faces = originals.length === 2 ? originals : photos.filter(photo => !roles.some(role => role.original === photo.original && role.role === 'evidence')).slice(0, 2).map(photo => photo.original);
    if (faces.length !== 2) { toast.info('Attach both original coin faces before preparing the white-background pair.'); return; }
    working.current = true; setBusy(true); setMessage('Preparing centred 1600px photographs. Original colour, wear and damage are preserved.');
    try {
      const result = await prepareSavedCoinPhotos(userId, tenantId, itemId, faces);
      if (current.current !== identity) return;
      if (result.prepared) {
        if (!result.item) throw new Error('Prepared photograph readback is missing. Reload this same draft to inspect the saved images.');
        draft.adoptItem(result.item);
        draft.setPhotos(selected => selected.map(url => faces.includes(url) ? result.photos[faces.indexOf(url)] : url));
        setMessage('Centred white-background coin photographs selected. Save your photo choice in this draft.');
        toast.success('Coin Snap photographs prepared; the originals remain available.');
        await draft.refresh();
      } else { const detail = result.warnings.join(' '); setMessage(detail); toast.warning(detail || 'Original photographs retained.'); }
    } catch (cause) {
      if (current.current === identity) { const detail = cause instanceof Error ? cause.message : 'Photo readback is unavailable. Reload this draft to inspect the saved photographs.'; setMessage(detail); toast.error(detail); }
    } finally { working.current = false; setBusy(false); }
  };
  return { busy, message, prepare };
}
