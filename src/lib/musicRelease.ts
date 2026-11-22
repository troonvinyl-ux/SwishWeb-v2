import type { MusicCandidate, MusicRelease, MusicFields, MusicIdentifier, MusicTrack } from '@/types/music';
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown):string=>typeof value==='string'?value:'';
function list(value:unknown):string[] {if(!Array.isArray(value)||value.some(entry=>typeof entry!=='string'))throw new Error('Discogs returned invalid catalogue fields. Retry or search manually.');return value as string[];}
export function musicReleaseUrl(id:number):string {if(!Number.isSafeInteger(id)||id<1)throw new Error('An individual Discogs release ID is required.');return `https://www.discogs.com/release/${id}`;}
export function parseMusicCandidate(input:unknown):MusicCandidate {
 const row=object(input),id=typeof row.id==='number'?row.id:NaN;
 if(row.type==='master')throw new Error('Discogs master records are not individual release matches.');
 const url=musicReleaseUrl(id);if(row.url!==url||typeof row.title!=='string'||typeof row.year!=='string'||typeof row.country!=='string')throw new Error('Discogs returned an invalid individual-release reference.');
 return {id,url,title:row.title,year:row.year,country:row.country,format:list(row.format),labels:list(row.labels),catalogueNumbers:list(row.catalogueNumbers)};
}
export function parseMusicRelease(input:unknown):MusicRelease {
 const base=parseMusicCandidate(input),row=object(input);
 if(!text(row.artist).trim()||!text(row.releaseTitle).trim())throw new Error('Discogs returned incomplete artist/title data. No release was confirmed.');
 if(!Array.isArray(row.identifiers)||row.identifiers.length>60||!Array.isArray(row.tracks)||row.tracks.length>150)throw new Error('Discogs returned invalid identifiers or tracklisting.');
 const identifiers:MusicIdentifier[]=row.identifiers.map(value=>{const entry=object(value);if(typeof entry.type!=='string'||typeof entry.value!=='string')throw new Error('Invalid catalogue identifier.');return {type:entry.type,value:entry.value,description:text(entry.description)};});
 const tracks:MusicTrack[]=row.tracks.map(value=>{const entry=object(value);if(typeof entry.title!=='string')throw new Error('Invalid catalogue track.');return {position:text(entry.position),title:entry.title,duration:text(entry.duration)};});
 const discCount=typeof row.discCount==='number'&&Number.isSafeInteger(row.discCount)&&row.discCount>0&&row.discCount<=999?row.discCount:null;
 const masterId=typeof row.masterId==='number'&&Number.isSafeInteger(row.masterId)&&row.masterId>0?row.masterId:null;
 return {...base,artist:text(row.artist),releaseTitle:text(row.releaseTitle),released:text(row.released),masterId,discCount,genres:list(row.genres),styles:list(row.styles),identifiers,tracks,fetchedAt:text(row.fetchedAt),expiresAt:text(row.expiresAt)};
}
export function isFreshMusicRelease(release:MusicRelease,now=Date.now()):boolean {const fetched=Date.parse(release.fetchedAt),expiry=Date.parse(release.expiresAt);return Number.isFinite(fetched)&&fetched<=now&&expiry>now&&expiry<=fetched+6*3600000;}
export function releaseMusicFields(release:MusicRelease):MusicFields {
 const formats=release.format,barcodes=[...new Set(release.identifiers.filter(id=>/^barcode$/i.test(id.type)).map(id=>id.value.replace(/[\s-]/g,'')).filter(value=>/^\d{8,14}$/.test(value)))];
 const values:Record<string,string>={artist:release.artist,release_title:release.releaseTitle,label:release.labels.join(', '),catalogue_number:release.catalogueNumbers.join(', '),year:release.year==='0'?'':release.year,country:release.country,format:formats.join(', '),genre:release.genres.join(', '),style:release.styles.join(', '),edition:formats.filter(value=>/reissue|remaster|edition|pressing|promo|limited|compilation/i.test(value)).join(', '),record_size:formats.find(value=>/\d+\s*(?:inch|")/i.test(value))||'',speed:formats.find(value=>/\b(?:33|45|78)(?:\s*RPM)?\b/i.test(value))||'',...(barcodes.length===1?{barcode:barcodes[0]}:{})};
 return Object.fromEntries(Object.entries(values).filter(([,value])=>value).map(([key,value])=>[key,{value,source:'discogs' as const,confidence:null}]));
}
