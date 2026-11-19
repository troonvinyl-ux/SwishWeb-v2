import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { identifyMusicPhotos } from '@/lib/musicApi';
import { searchMusicReleases, getDiscogsRelease } from '@/lib/discogs';
import { releaseMusicFields } from '@/lib/musicRelease';
import { musicFollowUp } from '@/lib/musicMatching';
import { MUSIC_DEFAULTS } from '@/constants/music';
import type { MusicValues } from '@/types/music';
import { useMusicSession } from '@/hooks/useMusicSession';
import type { CaptureScope } from '@/types/capture';
import type { MusicMatch, MusicRelease, MusicFields } from '@/types/music';
interface ManualSearch {query:string;mode:'text'|'barcode'|'catalogue'|'artist_title';artist?:string;}
export function useMusicResearch(session:ReturnType<typeof useMusicSession>,scope:CaptureScope|null,locked:boolean) {
 const qc=useQueryClient(),[matches,setMatches]=useState<MusicMatch[]>([]),[release,setRelease]=useState<MusicRelease|null>(null),[message,setMessage]=useState('Add a front-cover photograph to start.'),[warnings,setWarnings]=useState<string[]>([]),[error,setError]=useState(''),[timing,setTiming]=useState<number|null>(null);
 const generation=useRef(0),controller=useRef<AbortController|null>(null),latest=useRef({session,scope});latest.current={session,scope};
 const live=(token:number)=>token===generation.current&&Boolean(latest.current.scope?.isCurrent());
 const lookup=async(fields:MusicFields,token:number,manual?:ManualSearch)=>{const current=latest.current.scope;if(!current)throw new Error('Open your verified Tunes Flip workspace.');setMessage('Checking individual Discogs releases…');const results=await searchMusicReleases(qc,current,fields,manual);if(!live(token))return;setMatches(results);setMessage(musicFollowUp(results,fields));};
 const identify=useMutation({mutationFn:async()=>{const {scope:current,session:source}=latest.current;if(!current)throw new Error('Open your verified Tunes Flip workspace.');const token=++generation.current,flight=new AbortController();controller.current?.abort();controller.current=flight;const started=performance.now(),timer=setTimeout(()=>flight.abort(),85000);setError('');setMessage('Reading the music packaging and identifiers…');
  return identifyMusicPhotos(current,source.photos,source.fields,flight.signal).then(async(result)=>{if(!live(token))return;source.applyFields(result.fields);setWarnings(result.warnings);setMessage(result.followUp||'Photo details recognised.');await lookup(result.fields,token);if(live(token))setTiming(Math.round(performance.now()-started));}).catch((cause:unknown)=>{if(live(token))throw cause;}).finally(()=>clearTimeout(timer));},retry:false,onError:(cause:Error)=>{if(latest.current.scope?.isCurrent()){setError(cause.message);toast.error(cause.message);}}});
 const search=useMutation({mutationFn:async(manual:ManualSearch)=>{const token=++generation.current;controller.current?.abort();setRelease(null);session.form.setValue('reviewed',false);setError('');await lookup(session.fields,token,manual);},retry:false,onError:(cause:Error)=>{if(latest.current.scope?.isCurrent()){setError(cause.message);toast.error(cause.message);}}});
 const confirm=useMutation({mutationFn:async(id:number)=>{if(!scope)throw new Error('Your Tunes Flip workspace is unavailable.');const token=++generation.current;controller.current?.abort();const selected=await getDiscogsRelease(qc,scope,id);if(!live(token))return;setRelease(selected);session.applyFields(releaseMusicFields(selected));setMessage('Release selected. Check the populated details, grades and physical contents.');setError('');toast.success('Individual Discogs release selected for review.');},retry:false,onError:(cause:Error)=>{if(latest.current.scope?.isCurrent()){setError(cause.message);toast.error(cause.message);}}});
 const mutation=useRef(identify);mutation.current=identify;
 useEffect(()=>{if(locked)return;generation.current++;controller.current?.abort();setRelease(null);setMatches([]);setTiming(null);const source=latest.current.session;for(const[key,field]of Object.entries(source.fields)){if(field.source!=='user'&&key in MUSIC_DEFAULTS)source.form.setValue(key as keyof MusicValues,MUSIC_DEFAULTS[key as keyof MusicValues]);}source.setFields(previous=>Object.fromEntries(Object.entries(previous).filter(([,field])=>field.source==='user')));if(!session.photos.length){setMessage('Add a front-cover photograph or search manually.');return;}const timer=setTimeout(()=>{if(latest.current.scope?.isCurrent())mutation.current.mutate();},1500);return()=>{clearTimeout(timer);generation.current++;controller.current?.abort();};},[session.photos,session.sessionId,locked]);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 const readBarcode=useCallback((value:string)=>{session.form.setValue('barcode',value);session.markUser('barcode',value);search.mutate({query:value,mode:'barcode'});},[session,search]);
 return {matches,release,message,warnings,error,timing,identify,search,confirm,readBarcode,busy:identify.isPending||search.isPending||confirm.isPending};
}
