import { normalizeProductBarcode, sameProductBarcode } from '@/lib/productBarcode';
import type { MusicCandidate, MusicRelease, MusicFields, MusicMatch } from '@/types/music';
export const normalizeCatalogue=(value:string)=>value.normalize('NFKC').toUpperCase().replace(/[\s.\-_/]+/g,'');
const text=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const equal=(left:string,right:string)=>Boolean(text(left)&&text(left)===text(right));
export function musicSearchPlan(fields:MusicFields):{query:string;mode:'barcode'|'catalogue'|'artist_title'|'text';artist?:string}|null {
 const get=(key:string)=>fields[key]?.value.trim()||'',barcode=normalizeProductBarcode(get('barcode'));
 if(barcode)return {query:barcode,mode:'barcode'};if(get('catalogue_number').length>=2)return {query:get('catalogue_number').replace(/\s+/g,' '),mode:'catalogue'};
 if(get('artist').length>=2&&get('release_title').length>=2)return {query:get('release_title').slice(0,120),mode:'artist_title',artist:get('artist').slice(0,120)};
 const query=[get('artist'),get('release_title'),get('label')].filter(Boolean).join(' ').slice(0,120);return query.length>=3?{query,mode:'text'}:null;
}
export function rankMusicCandidate(candidate:MusicCandidate,fields:MusicFields,release?:MusicRelease):MusicMatch {
 const get=(key:string)=>fields[key]?.value||'',agreements:string[]=[],contradictions:string[]=[];let support=0,possible=0;
 const compare=(label:string,weight:number,hasEvidence:boolean,matched:boolean,known=true)=>{if(!hasEvidence||!known)return;possible+=weight;if(matched){support+=weight;agreements.push(label);}else contradictions.push(label);};
 const catalogue=get('catalogue_number'),artist=release?.artist||candidate.title.split(' - ')[0],title=release?.releaseTitle||candidate.title.split(' - ').slice(1).join(' - ');
 compare('Artist',15,!!get('artist'),equal(get('artist'),artist));compare('Release title',15,!!get('release_title'),equal(get('release_title'),title));
 compare('Catalogue number',25,!!catalogue,candidate.catalogueNumbers.some(value=>normalizeCatalogue(value)===normalizeCatalogue(catalogue)),candidate.catalogueNumbers.length>0);
 compare('Label',10,!!get('label'),candidate.labels.some(value=>equal(value,get('label'))),candidate.labels.length>0);
 compare('Country',5,!!get('country'),equal(get('country'),candidate.country),!!candidate.country);compare('Year',5,!!get('year'),get('year')===candidate.year,!!candidate.year&&candidate.year!=='0');
 const media=get('format').match(/Vinyl|CD|Cassette|DVD|Blu-ray/i)?.[0];compare('Format',10,!!media,candidate.format.some(value=>equal(value,media||'')),candidate.format.length>0);
 if(release){const codes=release.identifiers.filter(id=>/^barcode$/i.test(id.type)).map(id=>normalizeProductBarcode(id.value)).filter((value):value is string=>!!value),barcode=normalizeProductBarcode(get('barcode'));
 compare('Barcode',20,!!barcode,codes.some(value=>sameProductBarcode(value,barcode||'')),codes.length>0);
 const matrices=release.identifiers.filter(id=>/matrix|runout/i.test(id.type)).map(id=>normalizeCatalogue(id.value)),observed=get('matrix_runout').split(/\n|\s*;\s*/).map(normalizeCatalogue).filter(Boolean);
 compare('Matrix / runout',35,observed.length>0,observed.every(value=>matrices.includes(value)),matrices.length>0);
 }
 const score=possible?Math.max(0,Math.min(99,Math.round(100*support/possible)-contradictions.length*8)):0;
 return {candidate,release,score,agreements,contradictions};
}
export function musicFollowUp(matches:MusicMatch[],fields:MusicFields):string {
 if(!matches.length)return 'No catalogue match yet. Photograph the spine catalogue number or search manually.';
 if(matches.length>1&&!fields.matrix_runout?.value)return /CD|Cassette/i.test(fields.format?.value||'')?'Several editions match. Photograph the disc hub or printed edition identifiers.':'Two or more pressings match. Photograph the runout matrix to distinguish them.';
 if(matches[0].contradictions.length)return `Check ${matches[0].contradictions.join(', ')} against the physical item before confirming.`;
 return 'Compare this individual release with your packaging, labels and contents, then confirm it.';
}
