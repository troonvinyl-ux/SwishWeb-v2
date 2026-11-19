import { captureRecord } from '@/lib/captureRequest';
import { MUSIC_DEFAULTS } from '@/constants/music';
import { z } from 'zod';
import type { MusicPrice, MusicSnapshot, MusicValues, MusicField } from '@/types/music';
const priceSchema=z.object({market:z.number().positive(),quick:z.number().positive(),minimum:z.number().positive(),confidence:z.string(),basis:z.enum(['sold_supported_estimate','asking_context_estimate','ai_only_estimate']),explanation:z.string(),warnings:z.array(z.string()),researchedAt:z.string()});
export function savedMusicPrice(item:Record<string,unknown>|null):MusicPrice|null {const result=priceSchema.safeParse(captureRecord(item?.attributes)._music_quick_sale);return result.success?result.data as MusicPrice:null;}
export function musicSnapshotFromItem(item:Record<string,unknown>):MusicSnapshot {
 const attrs=captureRecord(item.attributes),values={...MUSIC_DEFAULTS};
 for(const key of Object.keys(values)as Array<keyof MusicValues>){const value=attrs[key];if(typeof values[key]==='string'&&(typeof value==='string'||typeof value==='number'))Object.assign(values,{[key]:String(value)});}
 values.play_tested=attrs.play_tested===true;values.reviewed=attrs._music_reviewed===true;values.pressing_reviewed=attrs.pressing_reviewed===true||attrs.discogs_pressing_confirmed===true;
 const sources=captureRecord(attrs._music_evidence),fields:MusicSnapshot['fields']={};
 for(const[key,raw]of Object.entries(sources)){const field=captureRecord(raw);if(typeof field.value==='string'&&['discogs','user','ai_inferred','image_extracted'].includes(String(field.source)))fields[key]={value:field.value,source:field.source as MusicField['source'],confidence:typeof field.confidence==='number'?field.confidence:null,reviewed:field.reviewed===true};}
 return {values,fields,photos:[],release:null,pricing:savedMusicPrice(item)};
}
