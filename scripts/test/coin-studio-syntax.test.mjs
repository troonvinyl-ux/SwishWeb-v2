import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
test('Coin Snap web adapters and shared extension transpile without syntax diagnostics', () => {
  const files = [...readdirSync('supabase/functions/_shared').filter(name => /^coinStudio.*\.ts$/.test(name)).map(name => `supabase/functions/_shared/${name}`),
    'src/lib/coinStudioPair.ts', 'src/lib/coinStudioContract.ts', 'src/lib/coinStudioPersistence.ts', 'src/lib/itemStudio.ts', 'src/lib/studioImageInput.ts', 'src/lib/quickCaptureFlow.ts'];
  for (const file of files) { const output = ts.transpileModule(readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }); assert.deepEqual(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [], [], file); }
});
