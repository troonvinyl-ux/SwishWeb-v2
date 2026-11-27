import { toast } from 'sonner';
import { coinListingInput } from '@/lib/coinListingInput';
import { assembleCoinAttributionCopy } from '@/lib/coinAttributionCopy';
import CoinAttributionSummary from '@/components/features/CoinAttributionSummary';
interface ListingCoinIdentityProps { item: Record<string, unknown> | null; title: string; form?: Record<string, unknown>; disabled?: boolean; onChange?: (key: string, value: unknown) => void; }
export default function ListingCoinIdentity({ item, title, form, disabled, onChange }: ListingCoinIdentityProps) {
  if (!item) return null;
  const attributes = coinListingInput(item, form?.item_specifics, title);
  const apply = () => {
    if (!form || !onChange) return;
    const copy = assembleCoinAttributionCopy(form, attributes);
    onChange('title', copy.title); onChange('description', copy.description);
    toast.success('Assembled attribution added to this draft. Review the title and description before saving.');
  };
  return <section className="swish-card space-y-4 p-4 sm:p-5" aria-label="Coin identification for listing">
    <CoinAttributionSummary attributes={attributes} title={title}/>
    {form && onChange && <button type="button" disabled={disabled} onClick={apply} className="btn-secondary min-h-11">Use assembled attribution in buyer copy</button>}
  </section>;
}
