import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { identifyMusicPhotos } from '@/lib/musicApi';
import { musicRecognitionError } from '@/lib/musicRecognitionErrors';
import { searchMusicReleases, getDiscogsRelease } from '@/lib/discogs';
import { releaseMusicFields } from '@/lib/musicRelease';
import { musicFollowUp } from '@/lib/musicMatching';
import { MUSIC_DEFAULTS } from '@/constants/music';
import { useMusicSession } from '@/hooks/useMusicSession';
import type { CaptureScope } from '@/types/capture';
import type { MusicMatch, MusicRelease, MusicFields, MusicValues } from '@/types/music';
interface ManualSearch { query: string; mode: 'text'|'barcode'|'catalogue'|'artist_title'; artist?: string; }
export function useMusicResearch(session: ReturnType<typeof useMusicSession>, scope: CaptureScope|null, locked: boolean) {
 const qc=useQueryClient(),[matches,setMatches]=useState<MusicMatch[]>([]),[release,setRelease]=useState<MusicRelease|null>(null);
 const [message,setMessage]=useState('Add a front-cover photograph to start.'),[warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[timing,setTiming]=useState<number|null>(null);
 const generation=useRef(0),controller=useRef<AbortController|null>(null),latest=useRef({session,scope});latest.current={session,scope};
 const live=(token:number)=>token===generation.current&&Boolean(latest.current.scope?.isCurrent());
 const report=(cause:unknown)=>{const text=musicRecognitionError(cause);setError(text);toast.error(text);};
 const lookup=async(fields:MusicFields,token:number,manual?:ManualSearch)=>{
  const current=latest.current.scope;if(!current)throw new Error('Open your verified Tunes Flip workspace.');
  setMessage('Checking individual Discogs releases…');const results=await searchMusicReleases(qc,current,fields,manual);
  if(!live(token))return;setMatches(results);setMessage(musicFollowUp(results,fields));
 };
 const identify=useMutation({retry:false,mutationFn:async()=>{
  const {scope:current,session:source}=latest.current;if(!current)throw new Error('Open your verified Tunes Flip workspace.');
  const token=++generation.current,flight=new AbortController();controller.current?.abort();controller.current=flight;
  const started=performance.now(),timer=setTimeout(()=>flight.abort(),85000);setError('');setWarnings([]);setTiming(null);setMessage('Reading the music packaging and identifiers…');
  return identifyMusicPhotos(current,source.photos,source.fields,flight.signal,(partial,progress)=>{
   if(!live(token))return;
   if(partial){source.applyFields(partial.fields);setWarnings(partial.warnings);}setMessage(progress);
  }).then(async(result)=>{
   if(!live(token))return;source.applyFields(result.fields);setWarnings(result.warnings);setMessage(result.followUp||'Photo details recognised.');
   await lookup(result.fields,token).catch((cause:unknown)=>{
    if(!live(token))return;setMessage('Photo details recognised. The Discogs check could not finish; use manual catalogue search.');report(cause);
   });
   if(live(token))setTiming(Math.round(performance.now()-started));
  }).catch((cause:unknown)=>{if(live(token))throw cause;}).finally(()=>clearTimeout(timer));
 },onError:(cause:Error)=>{
  if(!latest.current.scope?.isCurrent())return;
  setMessage('Recognition paused. Your photos and edits are retained. Retry recognition or search the catalogue manually.');report(cause);
 }});
 const search=useMutation({retry:false,mutationFn:async(manual:ManualSearch)=>{
  const token=++generation.current;controller.current?.abort();setRelease(null);session.form.setValue('reviewed',false);setError('');
  await lookup(session.fields,token,manual);
 },onError:(cause:Error)=>{if(latest.current.scope?.isCurrent())report(cause);}});
 const confirm=useMutation({retry:false,mutationFn:async(id:number)=>{
  if(!scope)throw new Error('Your Tunes Flip workspace is unavailable.');const token=++generation.current;controller.current?.abort();
  const selected=await getDiscogsRelease(qc,scope,id);if(!live(token))return;setRelease(selected);session.applyFields(releaseMusicFields(selected));
  setMessage('Release selected. Check the populated details, grades and physical contents.');setError('');toast.success('Individual Discogs release selected for review.');
 },onError:(cause:Error)=>{if(latest.current.scope?.isCurrent())report(cause);}});
 const mutation=useRef(identify);mutation.current=identify;
 useEffect(()=>{
  if(locked)return;generation.current++;controller.current?.abort();setMatches([]);setTiming(null);setError('');setWarnings([]);
  // Retaking evidence never overwrites the seller-selected catalogue release.
  // The session invalidates physical review; catalogue facts remain reference data.
  const source=latest.current.session;
  for(const[key,field]of Object.entries(source.fields)){
   if(field.source!=='user'&&field.source!=='discogs'&&key in MUSIC_DEFAULTS)source.form.setValue(key as keyof MusicValues,MUSIC_DEFAULTS[key as keyof MusicValues]);
  }
  source.setFields(previous=>Object.fromEntries(Object.entries(previous).filter(([,field])=>field.source==='user'||field.source==='discogs')));
  if(!session.photos.length){setMessage('Add a front-cover photograph or search manually.');return;}
  const timer=setTimeout(()=>{if(latest.current.scope?.isCurrent())mutation.current.mutate();},1500);
  return()=>{clearTimeout(timer);generation.current++;controller.current?.abort();};
 },[session.photos,session.sessionId,locked]);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 const readBarcode=useCallback((value:string)=>{session.form.setValue('barcode',value);session.markUser('barcode',value);search.mutate({query:value,mode:'barcode'});},[session,search]);
 return {matches,release,message,warnings,error,timing,identify,search,confirm,readBarcode,busy:identify.isPending||search.isPending||confirm.isPending};
}
