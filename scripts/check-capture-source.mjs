import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const ts = createRequire(import.meta.url)('typescript');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const uri = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const literal = uri(compile(await readFile('src/lib/nativeSourceLiteral.ts', 'utf8')));
const source = compile(await readFile('src/lib/nativeCaptureProfiles.ts', 'utf8')).replace('@/lib/nativeSourceLiteral', literal);
const { CAPTURE_SOURCE_COMMIT, parseCaptureProfile } = await import(uri(source));
const root = `https://raw.githubusercontent.com/troonvinyl-ux/SWISH/${CAPTURE_SOURCE_COMMIT}`;
const fetchSource = async path => { const response = await fetch(`${root}/${path}`, { signal: AbortSignal.timeout(20000) }); assert.ok(response.ok, `Native ${path} unavailable; capture acceptance cannot be inferred.`); return response.text(); };
const [specialists, intelligence, registry] = await Promise.all(['constants/specialists.ts', 'shared/specialistIntelligence.ts', 'niche-modules.json'].map(fetchSource));
const products = JSON.parse(registry).products;
assert.ok(products.stamps, 'Stamp Flipper must exist in the native source.');
for (const product of Object.values(products)) {
  const profile = parseCaptureProfile(specialists, intelligence, product.id, product.defaultSpecialist);
  assert.ok(profile.slots.length && profile.fields.length && profile.modes.length, `${product.id} needs complete native configuration.`);
  console.log(`${product.id}: ${profile.slots.length} evidence roles, ${profile.fields.length} review fields, ${profile.modes.length} modes`);
}
console.log(`Capture configuration checked against SWISH ${CAPTURE_SOURCE_COMMIT}; no live backend operations were performed.`);
