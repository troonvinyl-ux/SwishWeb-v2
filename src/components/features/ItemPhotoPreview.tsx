import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import CoinPresentation from '@/components/features/CoinPresentation';
interface ItemPhotoPreviewProps { item: Record<string, unknown> | null; index: number | null; original: boolean; onClose: () => void; onToggle: () => void; }
export default function ItemPhotoPreview({ item, index, original, onClose, onToggle }: ItemPhotoPreviewProps) {
  return <Dialog.Root open={index !== null} onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal>
    <Dialog.Overlay className="item-photo-backdrop" />
    <Dialog.Content className="item-photo-overlay"><Dialog.Title className="sr-only">Original and prepared item photograph</Dialog.Title><Dialog.Description className="sr-only">Compare the prepared cutout with the preserved original evidence photo.</Dialog.Description>
      <Dialog.Close className="btn-secondary self-end"><X className="h-5 w-5" />Close</Dialog.Close>
      <CoinPresentation item={item} index={index ?? 0} original={original} alt={`Full photo ${(index ?? 0) + 1}`} className="item-photo-full" />
      <button type="button" className="btn-secondary" onClick={onToggle}>{original ? 'Show prepared photo' : 'Show original evidence'}</button>
    </Dialog.Content>
  </Dialog.Portal></Dialog.Root>;
}
