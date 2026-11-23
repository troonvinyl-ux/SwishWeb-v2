import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
function load(path){
 const module={exports:{}};
 const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
 assert.equal(code.diagnostics?.filter(x=>x.category===ts.DiagnosticCategory.Error).length??0,0,path);
 new Function('module','exports',code.outputText)(module,module.exports);
 return module.exports;
}
const {musicContentsEvidence,protectMusicListingCopy,unattributedCoinCopy,physicalCategory,listingClaimState}=load('src/lib/listingEvidence.ts');

test('photo/measurement reports, catalogue references, suggestions and unknowns remain distinct',()=>{
 assert.equal(listingClaimState({value:'Greek',origin:'suggestion',reviewed:true}),'unconfirmed');
 assert.equal(listingClaimState({value:'N#438449',origin:'catalogue',reviewed:true}),'catalogue');
 assert.equal(listingClaimState({value:'1.51g',origin:'seller_reported',reviewed:true}),'reported');
 assert.equal(listingClaimState({value:'',origin:'unknown',reviewed:false}),'unknown');
});

test('an incomplete two-record sale discloses the physical count throughout copy and does not guess the missing disc',()=>{
 const evidence=musicContentsEvidence(2,'1','Vinyl LP');
 assert.equal(evidence.status,'incomplete');
 assert.equal(evidence.disclosure,'Incomplete — 1 of 2 records included');
 const copy=protectMusicListingCopy('Artist Album','Sleeve split. Playback not tested.',evidence);
 assert.ok(copy.title.startsWith(evidence.disclosure));assert.ok(copy.title.length<=80);
 assert.match(copy.description,/Missing disc identity is not assumed/);
 assert.equal(protectMusicListingCopy(copy.title,copy.description,evidence).description,copy.description);
});

test('unknown catalogue or observed disc count never supplies a fictitious record',()=>{
 assert.equal(musicContentsEvidence(2,'','Vinyl LP').observed,null);
 assert.equal(musicContentsEvidence('',1,'Vinyl LP').expected,null);
 assert.equal(musicContentsEvidence(2,'0','Vinyl LP').status,'unknown');
});

test('an unattributed coin cannot silently become Roman, Hellenistic, or measured from its photo',()=>{
 const blank=unattributedCoinCopy('',null);
 assert.match(blank.title,/Unattributed/);
 assert.match(blank.description,/Weight: unknown/);
 assert.match(blank.description,/Diameter: unknown/);
 assert.doesNotMatch(blank.description,/Roman|Hellenistic|genuine|rare/i);
 assert.match(unattributedCoinCopy('5.05','17').description,/Weight: 5.05 g/);
});

test('a book about Greek coins is a book because of its physical object',()=>{
 assert.equal(physicalCategory('Hardback book','Greek coins'),'books');
 assert.equal(physicalCategory('','Greek coins'),'unknown');
 assert.equal(physicalCategory('Coin','book about a Roman coin'),'coins');
});

test('web quick flow uses safe seller evidence and no new publication path',()=>{
 const scan=readFileSync('src/lib/quickCaptureFlow.ts','utf8');
 const persistence=readFileSync('src/lib/musicPersistence.ts','utf8');
 assert.match(scan,/unattributedCoinCopy/);
 assert.match(scan,/swish_create_listing_draft/);
 assert.match(persistence,/protectMusicListingCopy/);
 assert.match(persistence,/swish_create_listing_draft/);
 assert.doesNotMatch(persistence,/swish-ebay-list/);
});

test('both review components revoke approval when material fields change',()=>{
 const capture=readFileSync('src/components/features/CaptureDraftReview.tsx','utf8');
 const music=readFileSync('src/hooks/useMusicSession.ts','utf8');
 assert.match(capture,/form\.setValue\('reviewed',false/);
 assert.match(music,/if\(meta\.name && fields\.has\(meta\.name\) && form\.getValues\('reviewed'\)\)unreview/);
});
