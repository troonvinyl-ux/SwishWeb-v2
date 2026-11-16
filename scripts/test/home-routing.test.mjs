import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const ts = createRequire(import.meta.url)('typescript');
async function loadModule(path) {
  const compiled = ts.transpileModule(await readFile(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true,
  });
  assert.equal(compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  return import(`data:text/javascript;base64,${Buffer.from(compiled.outputText).toString('base64')}`);
}
const { isSwishHomeRoute } = await loadModule('src/lib/homeRouting.ts');
const { getHostProduct } = await loadModule('src/lib/productContext.ts');
const showHome = (host, path = '/') => isSwishHomeRoute(host, path, Boolean(getHostProduct(host)));

test('preview, production and local shared roots show SWISH home', () => {
  for (const host of ['react-9bk0v4.onspace.build', 'another-preview.onspace.build', 'swishflip.co.uk', 'www.swishflip.co.uk', 'localhost:5173']) {
    assert.equal(showHome(host), true, host);
  }
});
test('registered branded roots retain niche entry', () => {
  for (const host of ['coinflipper.com', 'www.coinflipper.com', 'coins.swishflip.co.uk', 'bikeflipper.com', 'threads.swishflip.co.uk']) {
    assert.equal(showHome(host), false, host);
  }
});
test('explicit niche, workspace, login and application paths are not public home', () => {
  for (const path of ['/coins', '/bikes', '/workspace/coins', '/niches', '/login', '/inventory', '/ebay']) {
    assert.equal(showHome('react-9bk0v4.onspace.build', path), false, path);
  }
});
test('unknown product subdomains retain coming-soon behavior', () => {
  assert.equal(showHome('unregistered.swishflip.co.uk'), false);
});
test('public home is selected before auth loading and saved-niche fallback', async () => {
  const app = await readFile('src/App.tsx', 'utf8');
  const home = app.indexOf('if (isSwishHomeRoute(');
  assert.ok(home >= 0);
  assert.ok(home < app.indexOf("localStorage.getItem('swish_active_niche')"));
  assert.ok(home < app.indexOf("if (connectionStatus === 'initialising'"));
  assert.ok(home < app.indexOf('if (!user)'));
  assert.match(app, /isSwishHomeRoute\(currentHostname, location\.pathname, Boolean\(hostProduct\)\)\) return <SwishFlipHome \/>/);
});
