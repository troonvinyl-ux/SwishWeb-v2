import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useListingStudioSession } from '@/contexts/ListingStudioContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useNicheAccess } from '@/hooks/useNicheAccess';
import { useStudioPhotos } from '@/hooks/useStudioPhotos';
import { useStudioObservation } from '@/hooks/useStudioObservation';
import { activateModuleScope } from '@/lib/moduleScope';
import { getSupabaseClient } from '@/lib/supabase';
import { normaliseNicheId, type SwishNicheId } from '@/lib/niche';
import { nextStudioSlot, studioInstruction } from '@/lib/listingStudioGuidance';
import SharedCaptureCamera from '@/components/features/SharedCaptureCamera';
import StudioNicheSelector from '@/components/features/StudioNicheSelector';
import StudioResearchNotes from '@/components/features/StudioResearchNotes';
export default function ListingStudio() {
  const { niche: route } = useParams(), navigate = useNavigate(), { user } = useAuth(), { tenantId } = useCurrentTenantId(), access = useNicheAccess(), { session, retain } = useListingStudioSession();
  const [niche, setNiche] = useState<SwishNicheId | null>(() => normaliseNicheId(route) || session?.niche || null), [selected, setSelected] = useState(''), [verified, setVerified] = useState(false), [opening, setOpening] = useState(false), [selectionError, setSelectionError] = useState('');
  const identity = `${user?.id}:${tenantId}:${niche}`, current = useRef(identity); current.current = identity;
  useEffect(() => () => { current.current = ''; }, []);
  const activate = useCallback(async (value: SwishNicheId | null) => {
    setNiche(value); setVerified(false); setOpening(false); setSelectionError(''); setSelected('');
    if (!value) return; if (!access.nicheIds.includes(value)) { setSelectionError('Select a currently authorised specialist workspace.'); return; }
    const client = getSupabaseClient(); if (!client || !user || !tenantId) return;
    setOpening(true); const expected = `${user.id}:${tenantId}:${value}`;
    await activateModuleScope(client, user.id, tenantId, value).then(() => { if (current.current === expected) setVerified(true); }).catch((cause: unknown) => { if (current.current === expected) { const text = cause instanceof Error ? cause.message : 'Workspace activation unavailable.'; setSelectionError(text); toast.error(text); } }).finally(() => { if (current.current === expected) setOpening(false); });
  }, [user?.id, tenantId, access.nicheIds]);
  useEffect(() => { if (niche && !access.isLoading && !access.error) void activate(niche); }, [user?.id, tenantId, access.isLoading, access.error]);
  const captured = useStudioPhotos({ session, niche, userId: user?.id || '', tenantId: tenantId || '', selected, retain, onAdded: () => setSelected('') });
  const client = getSupabaseClient(), scope = verified && niche && client && user && tenantId ? { client, userId: user.id, tenantId, nicheId: niche, sessionId: 'studio-camera', isCurrent: () => current.current === identity } : null;
  const research = useStudioObservation(scope, session?.photos || [], session?.notes || ''), slot = nextStudioSlot(niche, session?.photos || [], selected);
  const done = () => { if (!session?.photos.length) return; if (!niche || !verified || !access.nicheIds.includes(niche)) { toast.info('Choose an authorised niche in the camera selector before specialist review. Auto-detect observation is awaiting the shared Studio route.'); return; } retain({ ...session, niche, handedOff: true, updatedAt: Date.now() }); navigate(niche === 'tunes_flip' ? '/scan/tunes_flip' : `/quick-list/${niche}`); };
  return <SharedCaptureCamera autoStart label={slot.label} detail={niche ? 'Add only useful evidence. Done prepares market research and a complete editable eBay draft. Missing details stay unknown.' : 'Photograph now. Choose an authorised workspace before saving; automatic recommendation awaits the shared Studio route.'} guidance={studioInstruction(niche, session?.photos || [], slot, research.observation)} processing={research.processing} disabled={false} coin={niche === 'coins'} record={niche === 'tunes_flip'} photos={captured.photos} canReview={captured.photos.length > 0} onPhoto={file => captured.replace([file])} onImport={captured.replace} onSelectPhoto={setSelected} onRemovePhoto={captured.remove} onMovePhoto={captured.move} onDone={done} onClose={() => navigate(niche ? `/workspace/${niche}` : '/niches')} selector={<StudioNicheSelector niche={niche} allowed={access.nicheIds} disabled={opening || access.isLoading} onSelect={value => void activate(value)} />} tools={<>{niche === 'coins' && <Link to="/rapid/coins" className="btn-secondary min-h-11">Rapid Listing · Collector’s Envelope Mode</Link>}<StudioResearchNotes key={identity} niche={niche} notes={session?.notes || ''} onNotes={notes => { if (session) retain({ ...session, notes, updatedAt: Date.now() }); }} />{(selectionError || access.error || research.error) && <p role="alert">{selectionError || access.error?.message || research.error}</p>}{research.observation?.title && <p>Image suggestion: {research.observation.title}. Not a confirmed attribution.</p>}</>} />;
}
