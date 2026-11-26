import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const ts=createRequire(import.meta.url)('typescript');
async function load(path, rewrite=source=>source) {
 const source=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(rewrite(source)).toString('base64')}`);
}
const category=loadRapidTypescript('src/lib/categoryLookup.ts');
const scope=await load('src/lib/moduleScope.ts');
let invoke;
globalThis.__swishCategoryFixture={...category,...scope,callEdgeFunction:(...args)=>invoke(...args)};
const {lookupScopedListingCategory}=await load('src/lib/scopedCategoryLookup.ts',source=>
 'const {callEdgeFunction,verifyModuleScope,categorySearchQuery,lookupListingCategory}=globalThis.__swishCategoryFixture;\n'+source.replace(/^import[^\n]*;\n/gm,''));

delete globalThis.__swishCategoryFixture;
function fixture() {
 let user='user-A',niche='tunes_flip';
 const client={auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null},error:null})},rpc:async()=>({data:{tenant_id:'tenant-A',niche_id:niche},error:null})};
 return {input:{client,userId:'user-A',tenantId:'tenant-A',nicheId:'tunes_flip',title:'Album CD',attributes:{format:'CD'},isCurrent:()=>true},setUser:value=>user=value,setNiche:value=>niche=value};
}
const success={data:{success:true,suggestions:[{id:'176985',name:'CDs',isLeaf:true,categoryPath:'Music > CDs'}]},error:null};
test('verified member and niche accompany the existing category request',async()=>{
 const {input}=fixture(),calls=[];invoke=async(endpoint,body)=>{calls.push({endpoint,body});return success;};
 assert.deepEqual(await lookupScopedListingCategory(input),{id:'176985',name:'CDs'});
 assert.equal(calls.length,1);assert.equal(calls[0].body.tenantId,'tenant-A');assert.equal(calls[0].body.nicheId,'tunes_flip');
});
test('changed sign-in prevents any category service request',async()=>{
 const {input,setUser}=fixture();setUser('user-B');let calls=0;invoke=async()=>{calls++;return success;};
 await assert.rejects(lookupScopedListingCategory(input),/sign-in changed/);assert.equal(calls,0);
});
test('server module change stops fallback dispatch after an empty response',async()=>{
 const {input,setNiche}=fixture();let calls=0;invoke=async()=>{calls++;setNiche('clothing');return {data:{success:true,suggestions:[]},error:null};};
 await assert.rejects(lookupScopedListingCategory(input),/active module changed/);assert.equal(calls,1);
});
test('a successful result is discarded when the server module changes in flight',async()=>{
 const {input,setNiche}=fixture();invoke=async()=>{setNiche('clothing');return success;};
 await assert.rejects(lookupScopedListingCategory(input),/active module changed/);
});
