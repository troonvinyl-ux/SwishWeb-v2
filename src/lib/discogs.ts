import type { QueryClient } from '@tanstack/react-query';
import { assertCaptureScope, captureRecord } from '@/lib/captureRequest';
import { musicRequest } from '@/lib/musicApi';
import { isFreshMusicRelease, parseMusicCandidate, parseMusicRelease } from '@/lib/musicRelease';
import { musicSearchPlan, rankMusicCandidate } from '@/lib/musicMatching';
import type { CaptureScope } from '@/types/capture';
import type { MusicFields, MusicMatch, MusicRelease } from '@/types/music';
interface DiscogsQuery {query:string;mode:'text'|'barcode'|'catalogue'|'artist_title';artist?:string;}
export async function getDiscogsRelease(qc:QueryClient,scope:CaptureScope,id:number):Promise<MusicRelease> {
 await assertCaptureScope(scope);
 const release=await qc.fetchQuery({queryKey:['music_discogs',scope.userId,scope.tenantId,'release',id],staleTime:6*3600000,gcTime:6*3600000,retry:false,queryFn:async({signal})=>parseMusicRelease((await musicRequest(scope,'swish-discogs',{action:'release',releaseId:id},signal)).release)});
 await assertCaptureScope(scope);if(!isFreshMusicRelease(release)) {qc.removeQueries({queryKey:['music_discogs',scope.userId,scope.tenantId,'release',id],exact:true});throw new Error('Catalogue cache expired. Search and confirm a fresh release.');}return release;
}
export async function searchMusicReleases(qc:QueryClient,scope:CaptureScope,fields:MusicFields,manual?:DiscogsQuery):Promise<MusicMatch[]> {
 const plan=manual||musicSearchPlan(fields);if(!plan)return [];
 const search=async(query:string)=>{await assertCaptureScope(scope);const data=await qc.fetchQuery({queryKey:['music_discogs',scope.userId,scope.tenantId,'search',plan.mode,query,plan.artist||''],staleTime:6*3600000,gcTime:6*3600000,retry:false,queryFn:({signal})=>musicRequest(scope,'swish-discogs',{action:'search',query,mode:plan.mode,artist:plan.artist||'',page:1},signal)});await assertCaptureScope(scope);return Array.isArray(data.results)?data.results.map(parseMusicCandidate):[];};
 let candidates=await search(plan.query.slice(0,120));
 if(!candidates.length&&plan.mode==='catalogue'){const clean=plan.query.replace(/[\s.\-_/]+/g,'');if(clean.length>=2&&clean!==plan.query)candidates=await search(clean);}
 const ranked=candidates.map(candidate=>rankMusicCandidate(candidate,fields)).sort((a,b)=>b.score-a.score).slice(0,3),results:MusicMatch[]=[];
 // Bounded sequential detail requests respect the existing gateway budget. No provider-wide crawl.
 for(const match of ranked){const release=await getDiscogsRelease(qc,scope,match.candidate.id);results.push(rankMusicCandidate(release,fields,release));}
 return results.sort((a,b)=>b.score-a.score);
}
export function discogsSetupError(input:unknown):string {return String(captureRecord(input).message||'Discogs is unavailable. Keep your photos and use manual identification.');}
