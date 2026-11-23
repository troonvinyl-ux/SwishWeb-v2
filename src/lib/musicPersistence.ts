import { assertCaptureScope, captureRecord } from '@/lib/captureRequest';
import { persistCapturePhotos } from '@/lib/capturePersistence';
import { musicRequest } from '@/lib/musicApi';
import { musicInventoryAttributes, musicListingDescription, musicListingTitle, musicSpecifics } from '@/lib/musicListing';
import { musicContentsEvidence, protectMusicListingCopy } from '@/lib/listingEvidence';
import { isFreshMusicRelease } from '@/lib/musicRelease';
import { recordMusicTiming } from '@/lib/musicTiming';
import { linkScanToLive } from '@/lib/scanToLiveTiming';
import type { MusicSaveInput } from '@/types/music';
export async function saveMusicCapture({scope,snapshot,checkpoint,draft,progress}:MusicSaveInput):Promise<{itemId:string;listingId?:string}> {
 await assertCaptureScope(scope);const v=snapshot.values;
 if(snapshot.photos.length>12)throw new Error('Keep at most twelve original photos per music item.');
 if(snapshot.release&&!isFreshMusicRelease(snapshot.release))throw new Error('Refresh and confirm the expired catalogue selection before saving.');
 if(draft&&!v.reviewed)throw new Error('Review the release, contents and generated details before creating a draft.');
 const price=v.price?Number(v.price):null;if(price!==null&&(!Number.isFinite(price)||price<=0))throw new Error('Enter a positive price or leave it blank.');
 const attributes=musicInventoryAttributes(snapshot);
 const contents=musicContentsEvidence(snapshot.release?.discCount,v.observed_disc_count,v.format);
 const composed=protectMusicListingCopy(v.title||musicListingTitle(v,snapshot.release)||'Unidentified music — review required',
  v.description||musicListingDescription(snapshot),contents);
 const title=composed.title,description=composed.description;
 if(new TextEncoder().encode(JSON.stringify(attributes)).length>90000)throw new Error('Music details exceed the safe metadata limit. Shorten the notes; photos are stored separately.');
 progress('Saving this physical music item…');
 const existing=await scope.client.from('items').select('id,tenant_id,specialist_id').eq('id',checkpoint.itemId).eq('tenant_id',scope.tenantId).maybeSingle();
 if(existing.error)throw new Error(existing.error.message);
 if(!existing.data){const saved=await scope.client.from('items').insert({id:checkpoint.itemId,tenant_id:scope.tenantId,specialist_id:'vinyl_records',canonical_title:title,description,status:'review',attributes,condition:`Media ${v.media_grade||'ungraded'}; sleeve ${v.sleeve_grade||'ungraded'}`,condition_notes:v.condition_notes,expected_selling_price:price,media:[],warnings:snapshot.release?['Seller must verify physical pressing and contents.']:['Provisional music identification. No Discogs release confirmed.']}).select('id').single();if(saved.error||!saved.data)throw new Error(saved.error?.message||'Inventory save was not confirmed. Retry checks this same item ID; it does not create another item.');}
 else if(existing.data.specialist_id!=='vinyl_records')throw new Error('The saved item is not in Tunes Flip. Reopen the correct workspace.');
 checkpoint.inserted=true;progress('Attaching permanent original photos…');await persistCapturePhotos(scope,checkpoint.itemId,snapshot.photos,checkpoint.photos||{},value=>{checkpoint.photos=value;});
 if(!draft){recordMusicTiming(`${scope.userId}:${scope.tenantId}:${scope.sessionId}`,'inventory_saved');return {itemId:checkpoint.itemId};}
 await assertCaptureScope(scope);progress('Checking for an existing listing draft…');
 const read=await scope.client.from('listings').select('id,status,external_listing_id,publish_claim_id').eq('tenant_id',scope.tenantId).eq('item_id',checkpoint.itemId).eq('marketplace_id','ebay').order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(read.error)throw new Error(read.error.message);
 if(read.data){if(read.data.external_listing_id||read.data.publish_claim_id||!['draft','review','review_required'].includes(String(read.data.status)))throw new Error('An existing submission needs inspection. Open the saved listing rather than creating another.');checkpoint.listingId=String(read.data.id);}
 if(!checkpoint.listingId){
  if(checkpoint.draftAttempted)throw new Error('The earlier draft request has an uncertain result. Inspect inventory and listings; it will not be replayed automatically.');
  progress('Preparing the shared SWISH eBay draft…');const response=await musicRequest(scope,'swish-list-generate',{item_id:checkpoint.itemId,tenant_id:scope.tenantId,marketplace_id:'ebay'}),generated=captureRecord(response.listing);
  if(!generated.title)throw new Error('Item and photos saved, but the shared listing engine returned no draft.');
  const listing={...generated,title:title.slice(0,80),description,recommended_price:price||0,item_specifics:{...captureRecord(generated.item_specifics),...musicSpecifics(v)}};
  await assertCaptureScope(scope);checkpoint.draftAttempted=true;
  const saved=await scope.client.rpc('swish_create_listing_draft',{p_tenant_id:scope.tenantId,p_item_id:checkpoint.itemId,p_marketplace_id:'ebay',p_listing:listing,p_shipping_cost:0,p_category_id:null});
  if(saved.error||typeof saved.data!=='string'||!saved.data)throw new Error(saved.error?.message||'Draft creation was not confirmed. Check this item before retrying.');checkpoint.listingId=saved.data;
 }
 await assertCaptureScope(scope);const verified=await scope.client.from('listings').select('id,item_id,tenant_id,status,external_listing_id,publish_claim_id').eq('id',checkpoint.listingId).eq('tenant_id',scope.tenantId).single();
 if(verified.error||!verified.data||verified.data.item_id!==checkpoint.itemId)throw new Error('Saved draft readback failed. Inspect this item; no publication was requested.');
 if(verified.data.external_listing_id||verified.data.publish_claim_id)throw new Error('This listing has an existing submission. Inspect it instead of publishing again.');
 linkScanToLive(`${scope.userId}:${scope.tenantId}:${scope.sessionId}`,`${scope.userId}:${scope.tenantId}:${checkpoint.listingId}`);
 recordMusicTiming(`${scope.userId}:${scope.tenantId}:${scope.sessionId}`,'draft_saved');
 return {itemId:checkpoint.itemId,listingId:checkpoint.listingId};
}
