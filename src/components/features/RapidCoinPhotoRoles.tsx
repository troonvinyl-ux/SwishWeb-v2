import { toast } from 'sonner';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import type { RapidCoinJob } from '@/types/rapidCoin';
interface RapidCoinPhotoRolesProps { job: RapidCoinJob; }
export default function RapidCoinPhotoRoles({ job }: RapidCoinPhotoRolesProps) {
  return <section className="space-y-3"><h3 className="font-semibold">Correct photograph roles</h3><p className="leading-7">Obverse and reverse must show the coin. An envelope or ticket is internal evidence; use the existing Photos editor to explicitly include it after a draft exists.</p>
    {job.photos.map(photo => <label key={photo.id} className="flex flex-wrap items-center gap-3"><span className="flex-1">{photo.label}</span><select className="input-field max-w-xs" value={photo.role} disabled={photo.slotId === 'envelope'} onChange={event => { const role = event.target.value === 'coin' ? 'coin' as const : 'evidence' as const; void changeRapidJob(job.id, job.scope, current => ({ ...current, photos: current.photos.map(p => p.id === photo.id ? { ...p, role } : p) })).catch((cause: unknown) => toast.error(cause instanceof Error ? cause.message : 'Photo role was not saved.')); }}><option value="coin">Coin · buyer photograph</option><option value="evidence">Internal identification evidence</option></select></label>)}
  </section>;
}
