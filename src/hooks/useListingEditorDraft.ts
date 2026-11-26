import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { useTableRow } from '@/hooks/useSupabaseQuery';
import { asRecord, availableItemPhotos, itemPhotos } from '@/lib/itemPhotos';
import { hydrateListingEditor } from '@/lib/listingEditorData';
export function useListingEditorDraft(id: string | undefined, tenantId: string | null) {
  const listing = useTableRow('listings', id, '*', tenantId);
  const stock = useTableRow('items', String(listing.data?.item_id || '') || null, '*', tenantId);
  const [form, setForm] = useState<Record<string, unknown>>({ status: 'draft', marketplace_id: 'ebay' });
  const [photos, setPhotosState] = useState<string[]>([]), [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false), loaded = useRef(''), revisionRef = useRef(''), editRef = useRef(0);
  const formRef = useRef(form), photosRef = useRef(photos), itemRef = useRef<Record<string, unknown> | null>(null);
  const committed = useRef<{ listing: Record<string, unknown>; item: Record<string, unknown> } | null>(null);
  const item = stock.data?.id === listing.data?.item_id && stock.data?.tenant_id === tenantId ? stock.data : null;
  const updateRevision = () => { revisionRef.current = JSON.stringify({ form: formRef.current, photos: photosRef.current, itemVersion: itemRef.current?.updated_at }); };
  useEffect(() => {
    if (!listing.data || !item) return;
    const identity = `${tenantId}:${listing.data.id}`, changed = loaded.current !== identity;
    if (!changed && dirtyRef.current) return;
    if (changed) { loaded.current = identity; committed.current = null; itemRef.current = null; dirtyRef.current = false; setDirty(false); }
    if (!changed && committed.current) {
      const newer = (incoming: unknown, saved: unknown) => incoming === saved || (Number.isFinite(Date.parse(String(incoming))) && Date.parse(String(incoming)) > Date.parse(String(saved)));
      const snapshot = committed.current;
      if (!newer(listing.data.updated_at, snapshot.listing.updated_at) || !newer(item.updated_at, snapshot.item.updated_at)) return;
      if (listing.data.updated_at === snapshot.listing.updated_at && String(listing.data.category_id || '') !== String(snapshot.listing.category_id || '')) return;
      if (item.updated_at === snapshot.item.updated_at && (item.condition !== snapshot.item.condition || JSON.stringify(item.attributes) !== JSON.stringify(snapshot.item.attributes))) return;
    }
    const attrs = asRecord(item.attributes), allowed = new Set(availableItemPhotos(item));
    const saved = Array.isArray(attrs.ebay_listing_media) ? attrs.ebay_listing_media.filter((value): value is string => typeof value === 'string' && allowed.has(value)) : [];
    // Clean refetches adopt prepared photos and explicit empty selections; dirty edits stay protected.
    const nextPhotos = Array.isArray(attrs.ebay_listing_media) ? saved : itemPhotos(item).map(photo => photo.presentation);
    formRef.current = hydrateListingEditor(listing.data, item); itemRef.current = item; photosRef.current = nextPhotos;
    setForm(formRef.current); setPhotosState(nextPhotos); updateRevision();
  }, [listing.data, item, tenantId]);
  const change = (key: string, value: unknown) => { editRef.current += 1; dirtyRef.current = true; setDirty(true); formRef.current = { ...formRef.current, [key]: value }; setForm(formRef.current); updateRevision(); };
  const setPhotos = (value: SetStateAction<string[]>) => { editRef.current += 1; dirtyRef.current = true; setDirty(true); photosRef.current = typeof value === 'function' ? value(photosRef.current) : value; setPhotosState(photosRef.current); updateRevision(); };
  const commit = (value: Record<string, unknown>, savedItem?: Record<string, unknown>) => {
    if (savedItem) { itemRef.current = savedItem; committed.current = { listing: value, item: savedItem }; }
    formRef.current = savedItem ? hydrateListingEditor(value, savedItem) : { ...formRef.current, ...value };
    dirtyRef.current = false; setDirty(false); setForm(formRef.current); updateRevision();
  };
  // A verified studio readback adds allowed derivatives without clearing unsaved listing copy.
  const adoptItem = (value: Record<string, unknown>) => {
    if (value.id !== formRef.current.item_id || value.tenant_id !== tenantId) throw new Error('The prepared photos belong to a different stock item. Reload the current draft.');
    itemRef.current = value; updateRevision(); setForm({ ...formRef.current });
  };
  const refresh = async () => { await Promise.all([listing.refetch(), stock.refetch()]); };
  const revision = revisionRef.current;
  return { form, formRef, item: itemRef.current?.id === listing.data?.item_id && itemRef.current?.tenant_id === tenantId ? itemRef.current : item, photos, setPhotos, dirty, dirtyRef, editRef, change, commit, adoptItem, refresh, revision, revisionRef, loading: listing.isLoading || stock.isLoading || Boolean(listing.data && item && form.id !== listing.data.id), error: listing.error || stock.error };
}
