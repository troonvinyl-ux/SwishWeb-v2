import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronRight } from 'lucide-react';
const PRICE_SCHEMA = z.object({ price: z.string().refine(value => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0, 'Enter a price above zero.') });
interface ListingQuickPriceProps { value: unknown; auction: boolean; disabled: boolean; onChange: (value: string) => void; onOpen: () => void; }
export default function ListingQuickPrice({ value, auction, disabled, onChange, onOpen }: ListingQuickPriceProps) {
  const form = useForm<z.infer<typeof PRICE_SCHEMA>>({ resolver: zodResolver(PRICE_SCHEMA), mode: 'onChange', defaultValues: { price: String(value ?? '') } });
  useEffect(() => { const next = String(value ?? ''); if (form.getValues('price') !== next) form.reset({ price: next }); }, [value, form.reset, form.getValues]);
  const field = form.register('price');
  return <section className="swish-card space-y-3 p-4">
    <label htmlFor="quick-listing-price" className="block font-semibold">{auction ? 'Auction start price (£)' : 'Listing price (£)'}</label>
    <input id="quick-listing-price" className="input-field min-h-12 text-2xl font-bold" type="number" inputMode="decimal" min="0.01" step="0.01" disabled={disabled} aria-invalid={Boolean(form.formState.errors.price)} aria-describedby={form.formState.errors.price ? 'quick-price-error' : undefined} {...field} onChange={event => { void field.onChange(event); onChange(event.target.value); }} />
    {form.formState.errors.price && <p id="quick-price-error" role="alert" className="flex items-center gap-2 text-destructive"><AlertCircle size={18} />{form.formState.errors.price.message}</p>}
    <button type="button" className="btn-ghost min-h-11 w-full justify-between" onClick={onOpen}>Format, quantity and pricing options <ChevronRight size={18} /></button>
  </section>;
}
