import { useEffect, useState } from 'react';
import { rapidPhotoFile } from '@/lib/rapidCoinDatabase';
import type { CapturePhoto } from '@/types/capture';
import type { RapidCoinJob } from '@/types/rapidCoin';
export function useRapidCoinPhotoPreviews(job: RapidCoinJob | null) {
  const [snapshot, setSnapshot] = useState<{ id: string; photos: CapturePhoto[] }>({ id: '', photos: [] });
  const signature = job?.photos.map(p => p.id).join(':') || '';
  useEffect(() => {
    if (!job) { setSnapshot({ id: '', photos: [] }); return; }
    let active = true; const urls: string[] = [];
    void Promise.all(job.photos.map(async photo => { const file = await rapidPhotoFile(job, photo.id), preview = URL.createObjectURL(file); urls.push(preview); return { ...photo, file, preview }; })).then(photos => { if (active) setSnapshot({ id: job.id, photos }); else urls.forEach(url => URL.revokeObjectURL(url)); }, () => { if (active) setSnapshot({ id: job.id, photos: [] }); });
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [job?.id, signature]);
  return snapshot.id === job?.id ? snapshot.photos : [];
}
