import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBarcodeLookup } from '@/hooks/useBarcodeLookup';
import { normalizeProductBarcode } from '@/lib/productBarcode';
import { captureText } from '@/lib/captureRequest';
import type { CaptureScope } from '@/types/capture';
import type { BarcodeReading } from '@/types/camera';
import SharedCaptureCamera from '@/components/features/SharedCaptureCamera';
const schema = z.object({ barcode: z.string().refine(value => Boolean(normalizeProductBarcode(value)), 'Invalid EAN/UPC/ISBN check digit. Rescan or edit the barcode.') });
interface BarcodeCaptureProps { scope: CaptureScope; disabled: boolean; onLead: (lead: Record<string, unknown>) => void; }
export default function BarcodeCapture({ scope, disabled, onLead }: BarcodeCaptureProps) {
  const lookup = useBarcodeLookup(scope);
  const autoBarcodeAvailable = typeof window !== 'undefined' && 'BarcodeDetector' in window;
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { barcode: '' } });
  const read = useCallback((reading: BarcodeReading) => {
    if (disabled) return;
    const code = normalizeProductBarcode(reading.value, reading.format);
    if (code) { form.setValue('barcode', code, { shouldValidate: true }); void lookup.lookup(reading); }
  }, [disabled, form, lookup.lookup]);
  const submit = form.handleSubmit(values => { if (!disabled) void lookup.lookup({ value: values.barcode, format: '' }); });
  return <section className="space-y-4" aria-label="Scan barcode">
    {autoBarcodeAvailable
      ? <SharedCaptureCamera label="Scan barcode" detail="Point the camera at the product barcode" barcode scanning={!lookup.busy && !lookup.code} resolved={Boolean(lookup.code)} disabled={disabled || lookup.busy} onBarcode={read} />
      : <p role="status" className="swish-card p-4 text-sm text-muted-foreground">This browser cannot decode barcodes automatically. Enter the printed EAN, UPC or ISBN below to look up real product information.</p>}
    <div className="swish-card space-y-4 p-4"><h2 className="flex items-center gap-2 text-lg font-semibold"><ScanLine size={20} className="text-primary" />{lookup.busy ? 'Asking AI…' : lookup.products.length ? 'Choose the matching product' : lookup.code ? 'Barcode read' : autoBarcodeAvailable ? 'Point the camera at the product barcode' : 'Enter the printed barcode'}</h2><div role="status" aria-live="polite">{lookup.code && <p className="break-all font-semibold text-primary">Barcode {lookup.code} · Catalogue + AI</p>}{lookup.message && <p className="mt-2 leading-7 text-muted-foreground">{lookup.message}</p>}</div>
      {lookup.error && <p role="alert" className="flex gap-2 leading-7 text-destructive"><AlertCircle className="mt-1 h-5 w-5 shrink-0" />{lookup.error}</p>}
      {lookup.products.map((lead, index) => <Button key={captureText(lead.id) || index} type="button" variant="outline" disabled={disabled || lookup.busy} className="h-auto min-h-12 w-full flex-col items-start gap-1 whitespace-normal py-3 text-left" onClick={() => onLead(lead)}><span className="text-base font-semibold">{captureText(lead.title)}</span><span className="text-sm text-muted-foreground">{captureText(lead.source)} · Choose this product</span></Button>)}
      <details open={!autoBarcodeAvailable || Boolean(form.formState.errors.barcode || lookup.error)}><summary className="min-h-11 cursor-pointer py-2 font-semibold">Enter barcode manually</summary><form onSubmit={submit} className="mt-3 space-y-3"><label htmlFor="product-barcode" className="block">EAN / UPC / ISBN</label><input id="product-barcode" inputMode="numeric" autoComplete="off" className="input-field" {...form.register('barcode')} disabled={disabled || lookup.busy} />{form.formState.errors.barcode && <p role="alert" className="flex gap-2 text-destructive"><AlertCircle size={20} />{form.formState.errors.barcode.message}</p>}<Button type="submit" variant="outline" className="min-h-12" disabled={disabled || lookup.busy}>{lookup.busy ? 'Asking AI…' : 'Find product match'}</Button></form></details>
      {lookup.code && <Button type="button" variant="ghost" className="min-h-12" disabled={disabled || lookup.busy} onClick={lookup.reset}>Try another barcode</Button>}
      <p className="leading-7 text-muted-foreground">Choose the matching product and edition, then photograph your item. Barcode metadata never proves condition, contents or authenticity.</p>
    </div>
  </section>;
}
