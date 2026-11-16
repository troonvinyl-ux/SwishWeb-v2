import type { NumistaReference } from '@/types/numista';
export default function NumistaCaptureReview({ reference }: { reference: NumistaReference | null }) {
  if (!reference) return null;
  return <section className="swish-card p-4 space-y-2"><h2 className="font-semibold">Numista reference</h2><a className="text-primary underline" href={reference.url} target="_blank" rel="noreferrer">{reference.numistaN}</a><p className="text-sm text-muted-foreground">{reference.source === 'seller_reference' ? 'Seller supplied reference' : 'Identification candidate'}. Compare both coin faces, weight and diameter with the catalogue entry.</p></section>;
}
