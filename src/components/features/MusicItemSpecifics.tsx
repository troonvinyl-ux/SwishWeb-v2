import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { musicSnapshotFromItem } from '@/lib/musicSavedItem';
import { musicFormSchema } from '@/lib/musicValidation';
import { MUSIC_EDIT_FIELDS, MUSIC_GRADES } from '@/constants/music';
import { ebayMusicGrade, musicGradeCode, musicGradeAspects, type EbayAspect } from '@/lib/ebayMusicContract';
import type { MusicValues } from '@/types/music';
interface MusicItemSpecificsProps { item: Record<string, unknown> | null; values?: MusicValues; aspects?: EbayAspect[]; disabled: boolean; onChanged: (values: MusicValues) => void; }
export default function MusicItemSpecifics({ item, values, aspects = [], disabled, onChanged }: MusicItemSpecificsProps) {
  const version = useRef(''), form = useForm<MusicValues>({ resolver: zodResolver(musicFormSchema), defaultValues: values || musicSnapshotFromItem(item || {}).values });
  useEffect(() => { const key = `${item?.id}:${item?.updated_at}`; if (item && version.current !== key) { version.current = key; form.reset(values || musicSnapshotFromItem(item).values); } }, [item, values, form, form.formState.isDirty]);
  if (item?.specialist_id !== 'vinyl_records') return null;
  const emit = () => onChanged(form.getValues()), grades = musicGradeAspects(form.watch('format'));
  return <details className="swish-card p-4"><summary className="min-h-11 cursor-pointer py-2 text-lg font-semibold">Music item specifics</summary><p className="mt-3 text-base leading-7 text-muted-foreground">Changes are saved with this draft when you choose Save draft or Submit to eBay. Media and packaging are graded separately.</p><fieldset disabled={disabled} className="mt-4 grid gap-4 sm:grid-cols-2"><legend className="sr-only">Release details and eBay grades</legend>
    {(['media_grade', 'sleeve_grade'] as const).map(key => { const name = key === 'media_grade' ? grades.media : grades.sleeve, live = aspects.find(row => row.name === name)?.values || [], options: ReadonlyArray<readonly [string, string]> = live.length ? live.map(label => [musicGradeCode(label), label] as const) : MUSIC_GRADES; const current = form.watch(key); return <div key={key}><label htmlFor={`saved-${key}`}>{name}</label><select id={`saved-${key}`} className="input-field mt-2" {...form.register(key, { onChange: emit })}><option value="">Not graded / not applicable</option>{current && !options.some(([code]) => code === current) && <option value={current}>{ebayMusicGrade(current)} (saved)</option>}{options.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></div>; })}
    {MUSIC_EDIT_FIELDS.filter(([key]) => key !== 'location' && key !== 'condition_notes').map(([key, label]) => <div key={key}><label htmlFor={`saved-music-${key}`}>{label}</label><input id={`saved-music-${key}`} className="input-field mt-2" {...form.register(key, { onChange: emit })} /></div>)}
    <label className="flex min-h-11 items-center gap-3 sm:col-span-2"><input type="checkbox" {...form.register('play_tested', { onChange: emit })} />I personally confirm play-testing.</label>
  </fieldset><p className="mt-4 text-base leading-7 text-muted-foreground">Write wear, missing sleeves and playback findings in Condition description below. Poor (P) is retained in your description and represented as Worn (W) in eBay’s grading fields.</p></details>;
}
