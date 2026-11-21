import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSupabaseClientAsync } from '@/lib/supabase';
interface UploadedPhoto { side: string; url: string; }
export function useListingPhotoUploads(itemId: string, onAdded: (urls: string[]) => void) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]), [busy, setBusy] = useState(false);
  const currentItem = useRef(itemId); currentItem.current = itemId;
  useEffect(() => { setPhotos([]); }, [itemId]);
  const store = async (blob: Blob, name: string): Promise<UploadedPhoto> => {
    const client = await getSupabaseClientAsync(); if (!client || !itemId) throw new Error('Open the linked SWISH stock item before adding photos.');
    const path = `${itemId}/listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const result = await client.storage.from('item-images').upload(path, blob, { upsert: false, contentType: blob.type || 'image/jpeg' });
    if (result.error || !result.data) throw new Error(result.error?.message || 'Photo upload failed');
    return { side: name, url: client.storage.from('item-images').getPublicUrl(result.data.path).data.publicUrl };
  };
  const add = async (files: FileList | null) => {
    if (!files?.length || busy) return; setBusy(true); const added: UploadedPhoto[] = [];
    try { for (const file of Array.from(files)) { if (!file.type.startsWith('image/')) continue; added.push(await store(file, file.name)); } }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Photo upload unavailable'); }
    finally { if (added.length && currentItem.current === itemId) { setPhotos(current => [...current, ...added]); onAdded(added.map(photo => photo.url)); toast.success(`${added.length} photo(s) uploaded. Save to attach them to this same item.`); } setBusy(false); }
  };
  const edit = async (url: string, rotation: number, brightness: number, contrast: number): Promise<string | null> => {
    if (busy) return null; setBusy(true);
    try {
      const response = await fetch(url); if (!response.ok) throw new Error('Could not load the original photo');
      const bitmap = await createImageBitmap(await response.blob()), canvas = document.createElement('canvas'), rotated = Math.abs(rotation % 180) === 90;
      canvas.width = rotated ? bitmap.height : bitmap.width; canvas.height = rotated ? bitmap.width : bitmap.height;
      const context = canvas.getContext('2d'); if (!context) throw new Error('Photo editor is unavailable');
      context.filter = `brightness(${brightness}%) contrast(${contrast}%)`; context.translate(canvas.width / 2, canvas.height / 2); context.rotate(rotation * Math.PI / 180); context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2); bitmap.close();
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not export the edited copy')), 'image/jpeg', 0.94));
      const saved = await store(blob, 'Edited-photo.jpg'); if (currentItem.current !== itemId) return null; setPhotos(current => [...current, saved]); toast.success('Edited copy uploaded. Save the listing to attach it; the original is retained.'); return saved.url;
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Could not save photo edits'); return null; }
    finally { setBusy(false); }
  };
  return { photos, busy, add, edit };
}
