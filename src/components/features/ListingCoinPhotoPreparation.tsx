import { ScanLine } from 'lucide-react';
interface ListingCoinPhotoPreparationProps { busy: boolean; disabled: boolean; message: string; onPrepare: () => void; }
export default function ListingCoinPhotoPreparation({ busy, disabled, message, onPrepare }: ListingCoinPhotoPreparationProps) {
  return <section className="space-y-3 rounded-xl border border-primary/30 p-4">
    <h2 className="flex items-center gap-2 text-lg font-semibold"><ScanLine className="h-5 w-5 text-primary" />Coin Snap photographs</h2>
    <p className="text-base leading-7 text-muted-foreground">Centred coins on a white 1600 × 1600 canvas. Genuine colour, patina, worn lettering and irregular edges stay unchanged.</p>
    <button type="button" className="btn-secondary min-h-11" disabled={disabled || busy} onClick={onPrepare}>{busy ? 'Preparing both faces…' : 'Prepare white-background photos'}</button>
    {message && <p role="status" className="text-base leading-7 text-muted-foreground">{message}</p>}
  </section>;
}
