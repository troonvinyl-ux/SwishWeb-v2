import { readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function extendCoinStudioHandler(source) {
  if (source.includes('handleCoinStudioPair(body,')) return source;
  const anchor = "const body=await req.json();const {imageDataUrl,tenantId,nicheId}=body;";
  if (!source.includes(anchor) || !source.includes('serveModule(') || !source.includes("auth.getUser()") || !source.includes("SUPABASE_SERVICE_ROLE_KEY")) throw new Error('Original verified SWISH gateway changed. Review the native handler before applying this extension.');
  const branch = `\n  if(body.route==='coin_pair'){\n   const pairAdmin=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',{auth:{persistSession:false}});\n   return handleCoinStudioPair(body,{userId:user.id,userClient,storage:pairAdmin.storage.from('item-images')},corsHeaders);\n  }`;
  return "import { handleCoinStudioPair } from '../_shared/coinStudioRoute.ts';\n" + source.replace(anchor, anchor + branch);
}
export async function installCoinStudio(repository, apply = false) {
  const target = resolve(repository), shared = resolve(target, 'supabase/functions/_shared');
  const handler = resolve(target, 'supabase/functions/swish-coin-image-enhance/index.ts');
  const engine = await readFile(resolve(shared, 'smartStudioEngine.ts'), 'utf8');
  for (const contract of ['removeBackgroundBytes', 'decodeStudioRaster', 'encodeStudioPng', 'studioHash']) if (!engine.includes(contract)) throw new Error(`Original Smart Studio dependency missing: ${contract}`);
  await readFile(resolve(shared, 'backgroundEraseService.ts'), 'utf8');
  const source = await readFile(handler, 'utf8'), extended = extendCoinStudioHandler(source);
  const files = (await readdir(resolve(root, 'supabase/functions/_shared'))).filter(name => /^coinStudio.*\.ts$/.test(name));
  if (apply) { for (const name of files) await copyFile(resolve(root, 'supabase/functions/_shared', name), resolve(shared, name)); await writeFile(handler, extended); }
  return { apply, handlerChanged: extended !== source, files };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf('--repo'), repository = index >= 0 ? process.argv[index + 1] : null;
  if (!repository) throw new Error('Use --repo /path/to/original/SWISH; default is a non-writing contract check. Add --apply only after review.');
  console.log(await installCoinStudio(repository, process.argv.includes('--apply')));
}
