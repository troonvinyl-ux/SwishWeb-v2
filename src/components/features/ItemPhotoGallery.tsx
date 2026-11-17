import { useState } from 'react';
import { Sparkles, ImageIcon } from 'lucide-react';
import ItemPhotoPreview from '@/components/features/ItemPhotoPreview';
import { itemPhotos } from '@/lib/itemPhotos';
import { useItemStudio } from '@/hooks/useItemStudio';
import CoinPresentation from '@/components/features/CoinPresentation';
interface ItemPhotoGalleryProps { item: Record<string, unknown> | null; }
export default function ItemPhotoGallery({ item }: ItemPhotoGalleryProps) {
  const photos = itemPhotos(item), studio = useItemStudio(item);
  const [original, setOriginal] = useState(false), [preview, setPreview] = useState<number | null>(null);
  return <section className="swish-card p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Photos &amp; Smart Studio</h2><button type="button" className="btn-secondary" aria-pressed={original} onClick={() => setOriginal(value => !value)}><ImageIcon className="h-4 w-4" />{original ? 'Show prepared photos' : 'Show originals'}</button></div>
    <p className="text-muted-foreground leading-relaxed">BackgroundErase removes the background without redrawing the coin, its patina, holes or rim. Prepared photos are centered; originals remain available as evidence. This does not change a live eBay listing.</p>
    {photos.length === 0 && <p className="text-muted-foreground">No saved original photographs are attached to this item.</p>}
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">{photos.map((photo, index) => <div key={photo.original} className="space-y-2">
      <button type="button" className="block w-full rounded-2xl focus-visible:ring-2 focus-visible:ring-primary" onClick={() => setPreview(index)} aria-label={`Preview photo ${index + 1}`}><CoinPresentation item={item} index={index} original={original} alt={`Photo ${index + 1}`} className="aspect-square" /></button>
      <p className="text-sm text-muted-foreground">Photo {index + 1} · {photo.prepared ? 'Prepared + original' : 'Original'}</p>
      {!photo.prepared && <button type="button" className="btn-secondary w-full justify-center" disabled={studio.isPending} onClick={() => studio.mutate(photo.original)}><Sparkles className="h-4 w-4 shrink-0" />{studio.isPending && studio.variables === photo.original ? 'Preparing…' : 'Remove background'}</button>}
    </div>)}</div>
    {studio.isPending && <div role="status" className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Preparing a separate cutout. Your original is safe.</p><button type="button" className="btn-ghost" onClick={studio.cancel}>Cancel</button></div>}
    {studio.error && <p role="alert" className="text-destructive text-sm">{studio.error.message}</p>}
    <ItemPhotoPreview item={item} index={preview} original={original} onClose={() => setPreview(null)} onToggle={() => setOriginal(value => !value)} />
  </section>;
}
