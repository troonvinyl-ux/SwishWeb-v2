import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, AlertCircle, Camera, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useQuickCapture } from '@/hooks/useQuickCapture';
import { useCaptureEvidence } from '@/hooks/useCaptureEvidence';
import { getSupabaseClient } from '@/lib/supabase';
import { getSpecialistIdsForNiche, type SwishNicheId } from '@/lib/niche';
import { PRODUCTS } from '@/lib/productContext';
import CaptureCamera from '@/components/features/CaptureCamera';
import CapturePhotoRail from '@/components/features/CapturePhotoRail';
import CaptureObservations from '@/components/features/CaptureObservations';
import CaptureDraftReview from '@/components/features/CaptureDraftReview';
import BarcodeCapture from '@/components/features/BarcodeCapture';
import NumistaReferenceEntry from '@/components/features/NumistaReferenceEntry';
import '@/components/features/captureCamera.css';
interface QuickCaptureWorkspaceProps { nicheId: SwishNicheId; }
export default function QuickCaptureWorkspace({ nicheId }: QuickCaptureWorkspaceProps) {
  const { user } = useAuth(), { tenantId } = useCurrentTenantId(), flow = useQuickCapture(nicheId);
  const locked = flow.busy || flow.captureLocked, evidence = useCaptureEvidence(nicheId, flow.sessionId, locked);
  const { profile, form, activeSlot, slots, photos, missing, captureMode } = evidence;
  const client = getSupabaseClient(), key = `${user?.id}:${tenantId}:${nicheId}:${flow.sessionId}`, current = useRef(key); current.current = key;
  const scope = client && user && tenantId ? { client, userId: user.id, tenantId, nicheId, sessionId: flow.sessionId, isCurrent: () => current.current === key } : null;
  useEffect(() => { localStorage.setItem('swish_active_niche', nicheId); document.documentElement.dataset.niche = nicheId; }, [nicheId]);
  useEffect(() => () => { current.current = ''; }, []);
  const next = form.handleSubmit(answers => { if (!missing.length) void flow.next({ photos: slots.flatMap(slot => photos.filter(photo => photo.slotId === slot.id)), specialistId: evidence.specialistId, mode: evidence.mode, answers, lead: evidence.lead }); });
  if (profile.isPending) return <section role="status" className="swish-card p-6">Loading specialist capture…</section>;
  if (profile.error || !profile.data || !activeSlot) return <section role="alert" className="swish-card space-y-4 p-6"><h1 className="text-xl font-semibold">Scanner configuration unavailable</h1><p>{profile.error?.message || 'No registered evidence views returned.'}</p><Button variant="outline" onClick={() => void profile.refetch()}>Retry</Button></section>;
  const name = PRODUCTS.find(product => product.id === nicheId)?.shortName || 'Quick List';
  return <div className="quick-capture mx-auto w-full max-w-5xl space-y-4 pb-4">
    <header className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"><Link to={`/workspace/${nicheId}`} aria-label="Close scanner" className="btn-ghost min-h-12 min-w-12"><ArrowLeft size={24} /></Link><div className="flex-1"><h1 className="text-xl font-semibold">{name}</h1><p className="mt-1 text-muted-foreground">{flow.draft ? 'Ready to list' : captureMode === 'barcode' ? 'Scan barcode · AI identification' : 'Photograph your item'}</p></div><span className="font-semibold text-primary">{flow.draft ? '2 / 2' : '1 / 2'}</span></header>
    {flow.error && <section role="alert" className="swish-card space-y-3 p-4"><p className="flex items-start gap-2 leading-7 text-destructive"><AlertCircle className="mt-1 h-5 w-5 shrink-0" />{flow.error}</p>{flow.itemId && <Link to={`/inventory/${flow.itemId}`} className="btn-secondary min-h-11">Inspect saved item</Link>}{flow.listingId && <Link to={`/listings/${flow.listingId}`} className="btn-secondary min-h-11">Inspect saved listing</Link>}</section>}
    {flow.draft && scope ? <CaptureDraftReview draft={flow.draft} scope={scope} /> : <>
      {profile.data.barcode !== 'disabled' && <div role="tablist" aria-label="Capture method" className="capture-methods">{['photo', 'barcode'].map(value => <Button key={value} type="button" role="tab" aria-selected={captureMode === value} variant="outline" disabled={locked} onClick={() => evidence.setCaptureMode(value)}>{value === 'photo' ? <Camera size={20} className="mr-2" /> : <ScanLine size={20} className="mr-2" />}{value === 'photo' ? 'Photo' : 'Scan barcode'}</Button>)}</div>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><section className="space-y-4">{captureMode === 'barcode' && scope ? <BarcodeCapture scope={scope} disabled={locked} onLead={evidence.chooseLead} /> : <CaptureCamera slot={activeSlot} disabled={locked} onPhoto={evidence.addPhoto} complete={slots.filter(slot => photos.some(photo => photo.slotId === slot.id)).length} total={slots.length} thumbnail={photos[photos.length - 1]?.preview} />}<div className="swish-card space-y-2 p-4"><h2 className="text-lg font-semibold">{activeSlot.label}</h2><p className="leading-7 text-muted-foreground">{activeSlot.description}</p><p className="text-primary">{missing.length ? `${missing.length} required ${missing.length === 1 ? 'view' : 'views'} remaining` : 'Required views captured'}</p></div>{nicheId === 'coins' && <NumistaReferenceEntry form={form} disabled={locked} />}</section><aside className="space-y-4"><CapturePhotoRail slots={evidence.railSlots} photos={photos} selected={activeSlot.id} disabled={locked} onSelect={evidence.setSelected} onRemove={evidence.remove} />{evidence.lead && <div className="swish-card p-4"><strong className="text-primary">Barcode product found</strong><p className="mt-2 leading-7">{String(evidence.lead.title || '')}</p><p className="mt-2 text-muted-foreground">Confirm the physical item, edition and condition in your photographs.</p></div>}<p className="px-2 leading-7 text-muted-foreground">{profile.data.focus}</p></aside></div>
      <details className="swish-card p-4"><summary className="min-h-12 cursor-pointer py-2 font-semibold">More options</summary><div className="mt-4 space-y-4">{!photos.length && <div className="flex flex-wrap gap-2" aria-label="Specialist">{getSpecialistIdsForNiche(nicheId).map(id => <Button key={id} type="button" variant="outline" className="min-h-12" disabled={locked} aria-pressed={evidence.specialistId === id} onClick={() => { evidence.setSpecialistId(id); evidence.setSelected(''); }}>{id.replace(/_/g, ' ')}</Button>)}</div>}{!photos.length && profile.data.modes.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Specialist capture mode">{profile.data.modes.map(value => <Button key={value.id} type="button" variant="outline" className="min-h-12" aria-pressed={evidence.mode === value.id} disabled={locked} onClick={() => evidence.setMode(value.id)}>{value.label}</Button>)}</div>}<CaptureObservations fields={profile.data.fields.filter(field => nicheId !== 'coins' || !['weight', 'diameter', 'numista_number'].includes(field.key))} form={form} disabled={locked} nicheId={nicheId} /></div></details>
      {nicheId === 'tunes_flip' && evidence.mode === 'cd_box_set' && <div><label htmlFor="disc-count" className="mb-2 block">Discs physically present</label><input id="disc-count" type="number" min="1" max="5" className="input-field" disabled={locked} {...form.register('observed_disc_count')} /></div>}
      {form.formState.errors.numista_number && <p role="alert" className="text-destructive">{form.formState.errors.numista_number.message}</p>}
      <div className="capture-next"><p className="mb-3 leading-7 text-muted-foreground" role="status">{flow.busy ? flow.message || 'Preparing your listing…' : missing.length ? `Still needed: ${missing.map(slot => slot.label).join(', ')}.` : 'Next prepares your listing for review.'}</p><Button type="button" disabled={flow.busy || missing.length > 0 || !scope} onClick={() => void next()}>{flow.busy ? 'Preparing your listing…' : flow.error ? 'Retry preparation' : 'Next'}<ArrowRight size={20} className="ml-2" /></Button></div>
    </>}
    <Button type="button" variant="ghost" className="min-h-12" disabled={flow.busy} onClick={flow.reset}>New item</Button>
  </div>;
}
