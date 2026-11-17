import { useState } from 'react';
import { Package } from 'lucide-react';
import { itemPhotos } from '@/lib/itemPhotos';
interface CoinPresentationProps { item: Record<string, unknown> | null; original?: boolean; index?: number; alt?: string; className?: string; }
export default function CoinPresentation({ item, original = false, index = 0, alt = 'Item photograph', className = '' }: CoinPresentationProps) {
  const photo = itemPhotos(item)[index];
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const intended = photo ? original ? photo.original : photo.presentation : undefined;
  const source = intended && !failedUrls.includes(intended) ? intended : photo && !failedUrls.includes(photo.original) ? photo.original : undefined;
  const prepared = !!photo?.prepared && !original && source === photo.presentation;
  return <div className={`coin-presentation ${prepared ? 'is-prepared' : ''} ${className}`}>
    {source ? <img key={source} src={source} alt={alt} loading="lazy" onError={() => setFailedUrls(previous => [...previous, source])} /> : <Package aria-label="No saved photo" className="h-10 w-10 text-muted-foreground" />}
  </div>;
}
