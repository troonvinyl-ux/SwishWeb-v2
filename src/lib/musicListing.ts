import type { MusicFields, MusicSnapshot, MusicValues } from '@/types/music';
export function musicListingTitle(values:MusicValues):string {
 const parts=[values.artist,values.release_title,values.format,values.year,values.label,values.catalogue_number,values.edition].filter(Boolean),words=parts.join(' ').replace(/\s+/g,' ').trim();
 if(words.length<=80)return words;const trimmed=words.slice(0,81);return trimmed.slice(0,trimmed.lastIndexOf(' ')).trim()||words.slice(0,80);
}
export function musicSpecifics(values:MusicValues):Record<string,string> {
 const map:Record<string,string>={artist:'Artist',release_title:'Release Title',label:'Record Label',format:'Format',genre:'Genre',style:'Style',year:'Release Year',speed:'Speed',record_size:'Record Size',edition:'Edition',features:'Features',catalogue_number:'Catalog Number',barcode:'EAN',media_grade:'Record Grading',sleeve_grade:'Sleeve Grading'};
 return Object.fromEntries(Object.entries(map).flatMap(([key,label])=>{const value=String(values[key as keyof MusicValues]||'').trim();return value&&value.length<=65?[[key==='barcode'&&value.length===12?'UPC':label,value]]:[];}));
}
export function musicListingDescription(snapshot:MusicSnapshot):string {
 const {values:v,release}=snapshot,lines=[`${v.artist}${v.artist&&v.release_title?' — ':''}${v.release_title}`,'','Release details'];
 const pairs=[['Format',v.format],['Label',v.label],['Catalogue number',v.catalogue_number],['Release year',v.year],['Release country (not proof of manufacture)',v.country],['Edition',v.edition],['Speed',v.speed],['Record size',v.record_size],['Discs physically present',v.observed_disc_count]];
 for(const[label,value]of pairs)if(value)lines.push(`${label}: ${value}`);
 lines.push('','Condition',`Media: ${v.media_grade||'Not graded'}`,`Sleeve: ${v.sleeve_grade||'Not graded / not applicable'}`,v.play_tested?'Seller confirms this item has been play-tested.':'Not play-tested. Photographs cannot establish sound quality or hidden playback defects.');
 if(v.condition_notes)lines.push(v.condition_notes);if(v.features)lines.push(`Features / contents: ${v.features}`);if(v.matrix_runout)lines.push(`Seller-observed matrix / identifiers: ${v.matrix_runout}`);
 if(release){lines.push('',`Discogs individual release: ${release.id}`,release.url,'Data provided by Discogs. Seller checked this catalogue selection against the physical item.');if(release.tracks.length){lines.push('','Tracklisting');for(const track of release.tracks)lines.push([track.position,track.title,track.duration?`(${track.duration})`:''].filter(Boolean).join(' '));}}
 if(!release)lines.push('','Provisional identification — no Discogs release has been confirmed.');
 lines.push('','Please review the seller’s own photographs for condition and included components.');return lines.join('\n');
}
export function reviewedMusicFields(values:MusicValues,fields:MusicFields):MusicFields {
 return Object.fromEntries(Object.entries(fields).map(([key,field])=>{const value=String(values[key as keyof MusicValues]??field.value);return [key,{...field,value,reviewed:values.reviewed}];}));
}
export function musicInventoryAttributes(snapshot:MusicSnapshot):Record<string,unknown> {
 const {values,release,pricing}=snapshot,{title:_title,description:_description,price:_price,reviewed,...details}=values;
 return {...details,niche_id:'tunes_flip',_music_evidence:reviewedMusicFields(values,snapshot.fields),_music_quick_sale:pricing,ebay_item_specifics:musicSpecifics(values),...(release?{discogs_release_id:String(release.id),discogs_release_url:release.url,discogs_master_id:release.masterId,discogs_release_selected:true,discogs_release_selected_at:new Date().toISOString(),discogs_catalogue_checked_at:release.fetchedAt,discogs_pressing_confirmed:values.pressing_reviewed,discogs_selection_note:'Seller selected and reviewed this individual release; catalogue data is not independent proof of a physical pressing.',discogs_attribution:'Data provided by Discogs.',expected_disc_count:release.discCount?String(release.discCount):'',_music_tracklisting:release.tracks,_music_catalogue_identifiers:release.identifiers}:{discogs_release_selected:false,discogs_pressing_confirmed:false}),_music_reviewed:reviewed};
}
