import { captureRecord, captureText, captureStrings } from '@/lib/captureRequest';
import { MUSIC_EDIT_FIELDS } from '@/constants/music';
import type { MusicAnalysis, MusicFields, MusicField } from '@/types/music';
const ALIASES:Record<string,string[]>={condition_notes:['damage_notes','damageNotes'],release_title:['releaseTitle','album','album_title','title'],catalogue_number:['catalogueNumber','catalogNumber','catno'],label:['record_label','recordLabel'],matrix_runout:['matrix','runout','matrixRunout'],year:['release_year','releaseYear'],media_grade:[],sleeve_grade:[],record_size:['size'],observed_disc_count:['disc_count','discCount'],rights_society:['rightsSociety'],label_code:['labelCode']};
const scalar=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?String(value):captureText(value);
function confidence(value:unknown):number|null { const number=typeof value==='number'?value:NaN;return Number.isFinite(number)&&number>=0&&number<=1?number:null; }
export function extractMusicAnalysis(input:unknown):MusicAnalysis {
 const envelope=captureRecord(input), nested=captureRecord(envelope.result),result=captureRecord(envelope.identification??nested.identification??envelope.result??input);
 if(envelope.success===false||envelope.error||result.unable_to_identify===true)throw new Error(captureText(envelope.message??envelope.error)||'Photo recognition failed. Your originals and edits are retained.');
 const confirmed=captureRecord(result.attributesConfirmed),attrs=captureRecord(result.attributes),inferred=captureRecord(result.attributesInferred),structured=captureRecord(captureRecord(result.specialistAnalysis).fields),music=captureRecord(result.musicFields);
 const fields:MusicFields={};
 for(const [key] of MUSIC_EDIT_FIELDS){
  for(const alias of [key,...(ALIASES[key]??[])]){
   const entries:Array<[unknown,MusicField['source']]>=[[confirmed[alias],'image_extracted'],[structured[alias],'ai_inferred'],[music[alias],'image_extracted'],[attrs[alias],'ai_inferred'],[inferred[alias],'ai_inferred']];
   const found=entries.find(([raw])=>{const row=captureRecord(raw);return usable(scalar(row.value??raw));});if(!found)continue;
   const row=captureRecord(found[0]),value=scalar(row.value??found[0]).slice(0,500);fields[key]={value,source:found[1],confidence:confidence(row.confidence)};break;
  }
 }
 if(!Object.keys(fields).length&&!captureText(result.canonicalTitle??result.title))throw new Error('No readable music details were returned. Photograph the cover or enter the artist and title.');
 const missing=captureStrings(result.missingInformation),warnings=[...captureStrings(result.warnings),...captureStrings(result.evidenceContradictory)];
 return {fields,warnings,followUp:missing[0]||(!fields.artist||!fields.release_title?'Please photograph the front cover so the artist and title are readable.':'')};
}
function usable(value:string):boolean {return Boolean(value)&&! /^(unknown|unreadable|not legible|not established|n\/a|none)$/i.test(value);}
export function mergeMusicFields(previous:MusicFields,incoming:MusicFields):MusicFields {
 const output={...previous};for(const [key,next]of Object.entries(incoming)){const old=output[key];if(old?.source==='user'||old?.reviewed)continue;if(old?.source==='discogs'&&next.source!=='discogs')continue;if(old?.confidence!=null&&next.confidence!=null&&old.confidence>next.confidence)continue;output[key]=next;}return output;
}
