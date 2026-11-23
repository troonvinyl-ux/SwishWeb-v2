import type { MusicFields, MusicSnapshot, MusicValues, MusicRelease } from '@/types/music';
import { musicContentsEvidence, protectMusicListingCopy } from '@/lib/listingEvidence';
import { ebayMusicGrade, musicGradeAspects } from '@/lib/ebayMusicContract';
export function musicListingTitle(values:MusicValues,release?:MusicRelease|null):string {
 const parts=[values.artist,values.release_title,values.format,values.year,values.label,values.catalogue_number,values.edition].filter(Boolean);
 const words=parts.join(' ').replace(/\s+/g,' ').trim();
 const truncated=words.length<=80?words:(words.slice(0,81).split(/\s+/).slice(0,-1).join(' ')||words.slice(0,80));
 const contents=musicContentsEvidence(release?.discCount,values.observed_disc_count,values.format);
 return protectMusicListingCopy(truncated,'',contents).title;
}
export function musicSpecifics(values:MusicValues):Record<string,string> {
 const grades = musicGradeAspects(values.format);
 const map:Record<string,string>={artist:'Artist',release_title:'Release Title',label:'Record Label',format:'Format',genre:'Genre',style:'Style',year:'Release Year',speed:'Speed',record_size:'Record Size',edition:'Edition',features:'Features',catalogue_number:'Catalog Number',barcode:'EAN',media_grade:grades.media,sleeve_grade:grades.sleeve};
 return Object.fromEntries(Object.entries(map).flatMap(([key,label])=>{const raw=String(values[key as keyof MusicValues]||'').trim(),value=key==='media_grade'||key==='sleeve_grade'?ebayMusicGrade(raw):raw;return value&&value.length<=65?[[key==='barcode'&&value.length===12?'UPC':label,value]]:[];}));
}
export function musicListingDescription(snapshot:MusicSnapshot):string {
 const {values:v,release}=snapshot;
 const contents=musicContentsEvidence(release?.discCount,v.observed_disc_count,v.format);
 const lines=[
  'Item',`${v.artist||'Artist unknown'}${v.artist&&v.release_title?' — ':''}${v.release_title||'Release title unknown'}`,
  '', 'Included contents',contents.disclosure,
  'Seller photographs show the physical copy. Sleeve, inserts and disc identities must be checked individually.',
  '', 'Condition and faults',
  `Media: ${v.media_grade||'Not graded'}`,
  `Sleeve: ${v.sleeve_grade||'Not graded / not applicable'}`,
  v.play_tested?'Playback: Seller reports play-testing; refer to the seller notes. This is not proof of defect-free audio.':'Playback not tested. Photographs cannot establish sound quality.',
 ];
 if(v.condition_notes)lines.push(`Faults / condition notes: ${v.condition_notes}`);
 if(v.features)lines.push(`Seller-reported contents / features: ${v.features}`);
 if(v.matrix_runout)lines.push(`Seller-observed matrix / identifiers: ${v.matrix_runout}`);
 lines.push('','Measurements and identifiers');
 const pairs=[['Format',v.format],['Label',v.label],['Catalogue number',v.catalogue_number],['Release year',v.year],['Release country (catalogue, not proof of manufacture)',v.country],['Edition',v.edition],['Speed',v.speed],['Record size',v.record_size]];
 for(const [label,value] of pairs)if(value)lines.push(`${label}: ${value}`);
 if(release){
  lines.push('','Catalogue reference',`Discogs individual release: ${release.id}`,release.url,
    'Data provided by Discogs. This selection does not prove the exact physical pressing or which discs are included.');
  if(release.tracks.length && contents.status==='count_matches' && v.pressing_reviewed){
   lines.push('','Catalogue reference tracklisting (NOT verified as physically included)');
   for(const track of release.tracks)lines.push([track.position,track.title,track.duration?`(${track.duration})`:''].filter(Boolean).join(' '));
  }
 }else lines.push('','Catalogue reference','Provisional identification — no Discogs individual release has been confirmed.');
 lines.push('','Unknowns');
 if(contents.status==='incomplete')lines.push('Incomplete set. Which record is missing and which catalogue tracks are physically included remain unconfirmed.');
 else if(contents.status==='unknown')lines.push('Physical disc count and completeness are not established.');
 else lines.push('Exact disc identities are not independently authenticated by the catalogue match.');
 if(!v.play_tested)lines.push('Playback performance remains unknown.');
 lines.push('Inspect the actual seller photographs; no catalogue image replaces the physical evidence.');
 return protectMusicListingCopy('',lines.join('\n'),contents).description;
}
export function reviewedMusicFields(values:MusicValues,fields:MusicFields):MusicFields {
 return Object.fromEntries(Object.entries(fields).map(([key,field])=>{const value=String(values[key as keyof MusicValues]??field.value);return [key,{...field,value,reviewed:values.reviewed}];}));
}
export function musicInventoryAttributes(snapshot:MusicSnapshot):Record<string,unknown> {
 const {values,release,pricing}=snapshot,{title:_title,description:_description,price:_price,reviewed,...details}=values;
 const contents=musicContentsEvidence(release?.discCount,values.observed_disc_count,values.format);
 return {...details,niche_id:'tunes_flip',_music_contents_status:contents.status,_music_contents_disclosure:contents.disclosure,_music_evidence:reviewedMusicFields(values,snapshot.fields),_music_quick_sale:pricing,ebay_item_specifics:musicSpecifics(values),...(release?{discogs_release_id:String(release.id),discogs_release_url:release.url,discogs_master_id:release.masterId,discogs_release_selected:true,discogs_release_selected_at:new Date().toISOString(),discogs_catalogue_checked_at:release.fetchedAt,discogs_pressing_confirmed:false,discogs_seller_reviewed:values.pressing_reviewed,discogs_selection_note:'Seller selected and reviewed this individual release; catalogue data is not independent proof of a physical pressing.',discogs_attribution:'Data provided by Discogs.',expected_disc_count:release.discCount?String(release.discCount):'',_music_tracklisting:release.tracks,_music_catalogue_identifiers:release.identifiers}:{discogs_release_selected:false,discogs_pressing_confirmed:false}),_music_reviewed:reviewed};
}
