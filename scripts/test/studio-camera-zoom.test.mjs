import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }, reportDiagnostics: true });
const module = { exports: {} };
new Function('require', 'module', 'exports', compile(readFileSync('src/components/features/CameraZoomControls.tsx', 'utf8')).outputText)(require, module, module.exports);
const Zoom = module.exports.default;
const camera = { ready: true, starting: false, zoom: 1, zoomRange: { min: 1, max: 4, step: 0.1 }, zoomKind: 'digital', zoomBusy: false, focusBusy: false, focusSupported: false, focusMode: 'device', capabilities: {}, adjust: async () => undefined };
const markup = (overrides = {}, props = {}) => renderToStaticMarkup(React.createElement(Zoom, { camera: { ...camera, ...overrides }, compact: true, disabled: false, coin: false, ...props }));
test('compact zoom renders without hardware zoom or browser focus capabilities', () => {
  const html = markup();
  assert.match(html, /capture-zoom is-compact/);
  assert.match(html, /Zoom out/); assert.match(html, /Zoom in/);
  assert.match(html, /Digital crop/);
  assert.match(html, /min="1"/); assert.match(html, /max="4"/);
  assert.match(html, /aria-valuetext="1.0 times digital zoom"/);
  assert.doesNotMatch(html, /capture-zoom-presets|capture-focus-note/);
});
test('zoom display uses confirmed camera state, including queued hardware changes', () => {
  assert.match(markup({ zoom: 2, zoomBusy: true, zoomKind: 'hardware' }), /aria-valuetext="2.0 times hardware zoom"/);
  assert.match(markup({ zoom: 2 }), /value="2"/);
  assert.match(markup({ zoom: 4 }), /disabled="" aria-label="Zoom in"/);
});
test('capture and camera loading lock the slider', () => {
  for (const html of [markup({}, { disabled: true }), markup({ ready: false }), markup({ focusBusy: true })]) assert.match(html, /<input[^>]*disabled=""/);
  assert.match(markup({}, { compact: false }), /Digital zoom crops the saved photo; it does not add detail/);
});
test('full-screen scanner exposes zoom outside Tools for every ready camera', () => {
  const source = readFileSync('src/components/features/StudioCameraSurface.tsx', 'utf8');
  const inline = source.indexOf('coin={coin} compact');
  assert.ok(inline > 0 && inline < source.indexOf('<StudioToolSheet'));
  assert.match(source, /camera.ready && <CameraZoomControls/);
  assert.doesNotMatch(source, /camera.ready && \(camera.capabilities.zoom/);
});
test('modified camera controls and surface have no TypeScript syntax diagnostics', () => {
  for (const path of ['src/components/features/CameraZoomControls.tsx', 'src/components/features/StudioCameraSurface.tsx']) assert.equal(compile(readFileSync(path, 'utf8')).diagnostics?.filter(entry => entry.category === ts.DiagnosticCategory.Error).length || 0, 0, path);
});
