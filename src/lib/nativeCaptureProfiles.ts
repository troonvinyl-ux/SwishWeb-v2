import { parseNativeLiteral, sourceArray, sourceBlock } from '@/lib/nativeSourceLiteral';
import type { CaptureSlot, NativeCaptureProfile } from '@/types/capture';
import type { SwishNicheId } from '@/lib/niche';
export const CAPTURE_SOURCE_COMMIT = '07bd9ef360bdea053cd9dae29c12b2a54424582b';
const ROOT = `https://raw.githubusercontent.com/troonvinyl-ux/SWISH/${CAPTURE_SOURCE_COMMIT}`;
const sources = new Map<string, Promise<string>>();
function publicSource(path: string): Promise<string> {
  const existing = sources.get(path);
  if (existing) return existing;
  const request = fetch(`${ROOT}/${path}`, { credentials: 'omit', signal: AbortSignal.timeout(20000) }).then(response => {
    if (!response.ok) throw new Error('Mobile capture configuration could not be loaded. Retry; no replacement workflow has been selected.');
    return response.text();
  }).catch((cause: unknown) => { sources.delete(path); throw cause; });
  sources.set(path, request);
  return request;
}
export function parseCaptureProfile(specialists: string, intelligence: string, nicheId: SwishNicheId, specialistId: string): NativeCaptureProfile {
  const configuration = sourceBlock(specialists, specialistId);
  const raw = parseNativeLiteral(sourceArray(configuration, 'captureRequirements'));
  if (!Array.isArray(raw) || !raw.length) throw new Error('Mobile evidence requirements are unavailable.');
  const slots = raw.map((entry: unknown): CaptureSlot => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid mobile evidence view.');
    const row = entry as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.label !== 'string' || typeof row.description !== 'string' || typeof row.required !== 'boolean') throw new Error('Invalid mobile evidence requirement.');
    return { id: row.id, label: row.label, description: row.description, required: row.required };
  });
  const back = slots.find(slot => ['back', 'reverse', 'non_drive_side', 'right_side', 'back_sleeve'].includes(slot.id));
  if (back) back.required = true;
  else if (nicheId !== 'coins') slots.push({ id: 'back', label: 'Back / reverse', description: 'Photograph the reverse and physical condition', required: true });
  const profile = sourceBlock(intelligence, nicheId);
  const fieldsSource = sourceArray(profile, 'fields');
  const fields = [...fieldsSource.matchAll(/field\(\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*,\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/g)].map(match => ({ key: String(parseNativeLiteral(match[1])), label: String(parseNativeLiteral(match[2])) }));
  const modes = parseNativeLiteral(sourceArray(profile, 'modes')) as NativeCaptureProfile['modes'];
  if (!Array.isArray(modes) || !modes.every(mode => typeof mode.id === 'string' && typeof mode.label === 'string')) throw new Error('Mobile capture modes are unavailable.');
  const focus = /\bfocus\s*:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")/.exec(profile);
  return { slots, fields, modes, focus: focus ? String(parseNativeLiteral(focus[1])) : 'Capture the physical evidence before reviewing a listing.', barcode: nicheId === 'stamps' ? 'disabled' : nicheId === 'collectibles' ? 'start' : 'optional' };
}
export async function loadCaptureProfile(nicheId: SwishNicheId, specialistId: string): Promise<NativeCaptureProfile> {
  const [specialists, intelligence] = await Promise.all([publicSource('constants/specialists.ts'), publicSource('shared/specialistIntelligence.ts')]);
  return parseCaptureProfile(specialists, intelligence, nicheId, specialistId);
}
export function modeCaptureSlots(profile: NativeCaptureProfile, nicheId: SwishNicheId, mode: string, discCount = '1'): CaptureSlot[] {
  if (mode === 'part' && ['bicycles', 'motocross'].includes(nicheId)) return [
    { id: 'main', label: 'Complete component', description: 'Show shape, mounting points and all included hardware', required: true },
    { id: 'part_number', label: 'Part number / label', description: 'Read the exact printed or stamped identifier', required: true },
    { id: 'back', label: 'Reverse / connections', description: 'Show the reverse, connectors and wear', required: true },
    { id: 'mounts', label: 'Mounts and connections', description: 'Show mounts, connectors and scale', required: false },
    { id: 'condition', label: 'Wear / damage', description: 'Show defects and missing parts', required: false },
  ];
  if (nicheId === 'tunes_flip' && mode === 'cd_box_set') return [
    { id: 'front_sleeve', label: 'Front cover / box', description: 'Show the full title, artist and edition branding', required: true },
    { id: 'back_sleeve', label: 'Rear cover / barcode', description: 'Show track list, label, catalogue number and barcode clearly', required: true },
    { id: 'disc_count', label: 'All discs / contents', description: 'Lay out the discs with case, booklet and inserts', required: true },
    ...Array.from({ length: Math.min(5, Math.max(1, Number(discCount) || 1)) }, (_, index) => ({ id: `disc_${index + 1}`, label: `Disc ${index + 1} label`, description: 'Show printed disc number, title, label and catalogue reference', required: true })),
  ];
  return profile.slots;
}
