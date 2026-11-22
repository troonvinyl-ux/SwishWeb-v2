import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { getDefaultSpecialistForNiche, type SwishNicheId } from '@/lib/niche';
import { loadCaptureProfile, modeCaptureSlots } from '@/lib/nativeCaptureProfiles';
import { parseNumistaNumber } from '@/lib/numistaCapture';
import type { CapturePhoto, CaptureSlot } from '@/types/capture';
export function useCaptureEvidence(nicheId: SwishNicheId, sessionId: string, locked: boolean) {
  const [specialistId, setSpecialistId] = useState(() => getDefaultSpecialistForNiche(nicheId)), [mode, setMode] = useState('item');
  const [captureMode, setCaptureMode] = useState(nicheId === 'collectibles' ? 'barcode' : 'photo'), [selected, setSelected] = useState('');
  const [photos, setPhotos] = useState<CapturePhoto[]>([]), [lead, setLead] = useState<Record<string, unknown> | null>(null);
  const photosRef = useRef(photos); photosRef.current = photos;
  const form = useForm<Record<string, string>>({ resolver: zodResolver(z.record(z.string().max(2000, 'Shorten this observation.')).superRefine((values, ctx) => {
    const typeId = parseNumistaNumber(values.numista_number);
    if (nicheId === 'coins' && !typeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numista_number'], message: 'Enter a valid Numista N# or coin catalogue URL before pulling a draft.' });
    else if (values.numista_number && !typeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['numista_number'], message: 'Enter a valid Numista N# or coin catalogue URL.' });
    if (nicheId === 'coins' && !(Number(values.weight) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weight'], message: 'Enter the actual coin weight in grams.' });
    if (nicheId === 'coins' && !(Number(values.diameter) > 0)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['diameter'], message: 'Enter the actual coin diameter in millimetres.' });
  })), defaultValues: {} });
  const profile = useQuery({ queryKey: ['native_capture_profile', nicheId, specialistId], queryFn: () => loadCaptureProfile(nicheId, specialistId), staleTime: Infinity, retry: false });
  const discCount = form.watch('observed_disc_count') || '1';
  const slots = useMemo(() => profile.data ? modeCaptureSlots(profile.data, nicheId, mode, discCount) : [], [profile.data, nicheId, mode, discCount]);
  const activeSlot = slots.find(slot => slot.id === selected) || slots.find(slot => !photos.some(photo => photo.slotId === slot.id)) || slots[0];
  const missing = slots.filter(slot => slot.required && !photos.some(photo => photo.slotId === slot.id));
  const railSlots = [...slots, ...photos.filter(photo => !slots.some(slot => slot.id === photo.slotId)).map(photo => ({ id: photo.slotId, label: photo.label, description: 'Retained original', required: false }))];
  useEffect(() => { photosRef.current.forEach(photo => URL.revokeObjectURL(photo.preview)); setPhotos([]); setSelected(''); setLead(null); form.reset({}); }, [sessionId, form]);
  useEffect(() => () => photosRef.current.forEach(photo => URL.revokeObjectURL(photo.preview)), []);
  const addPhoto = useCallback((slot: CaptureSlot, file: File) => {
    if (locked) return;
    if (!file.type.startsWith('image/') || !file.size) { toast.error('Choose a readable image file.'); return; }
    const before = photosRef.current;
    if (before.length >= 8 && !before.some(photo => photo.slotId === slot.id)) { toast.error('Use at most eight analysis photos.'); return; }
    const previous = before.find(photo => photo.slotId === slot.id); if (previous) URL.revokeObjectURL(previous.preview);
    const next = [...before.filter(photo => photo.slotId !== slot.id), { slotId: slot.id, label: slot.label, file, preview: URL.createObjectURL(file) }]; photosRef.current = next; setPhotos(next);
    setSelected(slots.find(view => view.required && !next.some(photo => photo.slotId === view.id))?.id || slot.id);
    toast.success(`${slot.label} captured.`);
  }, [locked, slots]);
  const remove = useCallback((id: string) => { if (locked) return; const photo = photosRef.current.find(value => value.slotId === id); if (photo) URL.revokeObjectURL(photo.preview); const next = photosRef.current.filter(value => value.slotId !== id); photosRef.current = next; setPhotos(next); setSelected(id); }, [locked]);
  const chooseLead = useCallback((value: Record<string, unknown>) => { if (locked) return; setLead(value); setCaptureMode('photo'); }, [locked]);
  return { specialistId, setSpecialistId, mode, setMode, captureMode, setCaptureMode, selected, setSelected, photos, lead, chooseLead, profile, form, slots, activeSlot, missing, railSlots, addPhoto, remove };
}
