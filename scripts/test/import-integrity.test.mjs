import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
const root=resolve('src');
async function walk(path){const entries=await readdir(path,{withFileTypes:true});return (await Promise.all(entries.map(entry=>entry.isDirectory()?walk(resolve(path,entry.name)):resolve(path,entry.name)))).flat();}
test('all local source imports resolve to tracked application files',async()=>{
  const missing=[];
  for(const file of (await walk(root)).filter(file=>/\.(ts|tsx)$/.test(file))){
    const source=await readFile(file,'utf8');
    for(const match of source.matchAll(/(?:from\s*|import\s*)['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g)){
      const target=match[1].startsWith('@/')?resolve(root,match[1].slice(2)):resolve(dirname(file),match[1]);
      const candidates=await Promise.all(['','.ts','.tsx','.js','.css','.svg','.webp','.jpg','/index.ts','/index.tsx'].map(async suffix=>{try{return(await stat(target+suffix)).isFile();}catch{return false;}}));
      if(!candidates.some(Boolean))missing.push(`${file}: ${match[1]}`);
    }
  }
  assert.deepEqual(missing,[]);
});
