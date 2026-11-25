import type { StudioSession, StudioRetainedPhoto } from '@/types/listingStudio';
export const STUDIO_SESSION_TTL = 2 * 60 * 60 * 1000;
export const STUDIO_MAX_ORIGINAL_BYTES = 80 * 1024 * 1024;
export function isStudioSessionCurrent(session: StudioSession | null, userId: string, tenantId: string, now = Date.now()): session is StudioSession {
  return Boolean(userId && tenantId && session && session.userId === userId && session.tenantId === tenantId && now - session.updatedAt < STUDIO_SESSION_TTL && now >= session.updatedAt);
}
export function moveStudioPhoto(photos: StudioRetainedPhoto[], slotId: string, direction: number): StudioRetainedPhoto[] {
  const from = photos.findIndex(photo => photo.slotId === slotId), to = from + Math.sign(direction);
  if (from < 0 || to < 0 || to >= photos.length) return photos;
  const next = [...photos]; [next[from], next[to]] = [next[to], next[from]]; return next;
}
export function assertStudioPhotoBudget(photos: StudioRetainedPhoto[]): void {
  if (photos.length > 8) throw new Error('Keep at most eight original photos in this capture session.');
  if (photos.reduce((sum, photo) => sum + photo.file.size, 0) > STUDIO_MAX_ORIGINAL_BYTES) throw new Error('This session exceeds the 80 MB temporary photo limit. Remove a photo before importing more.');
}
