import test from 'node:test';
import assert from 'node:assert/strict';
import { coinFixture, maskEngine, geometry, renderer, sampling } from './lib/coin-studio-fixtures.mjs';
const cases = ['worn copper', 'ancient bronze', 'tarnished silver', 'reflective modern', 'hammered', 'irregular flan', 'dark bronze', 'weak inscriptions', 'holed', 'damaged rim', 'copper patina', 'silver patina', 'soft portrait', 'scratched', 'corroded', 'uneven rim', 'near black', 'highlights', 'small hole', 'off-centre strike'];
test('20 SYNTHETIC raster cases preserve source bytes and genuine silhouettes; not real-coin acceptance evidence', () => {
  for (const [i, name] of cases.entries()) {
    const fixture = coinFixture({ hole: i === 8 || i === 18, irregular: [4, 5, 9, 15].includes(i), colour: i === 6 || i === 16 ? [25, 22, 17] : i === 2 || i === 11 ? [140, 138, 132] : [110, 77, 43] });
    const before = fixture.source.data.slice(), bounds = maskEngine.coinMaskBounds(fixture.source, fixture.mask, fixture.assessment), plan = geometry.coinRenderPlan(bounds, fixture.assessment);
    assert.ok(Math.abs(Math.max((bounds.right - bounds.left + 1) * plan.scaleX, (bounds.bottom - bounds.top + 1) * plan.scaleY) - 1440) < .0001, name);
    assert.ok(plan.left >= 79.99 && plan.top >= 79.99, name); assert.equal(plan.perspectiveApplied, false, name);
    const sample = sampling.coinSourceSample(fixture.source, fixture.mask, 350, 350, plan);
    assert.ok(sample.rgb[1] > 0, 'provider magenta must never replace photographed RGB');
    assert.deepEqual(fixture.source.data, before, name);
  }
});
for (const options of [{}, { hole: true }, { irregular: true }, { colour: [25, 22, 17] }]) test(`1600px opaque white source-only export ${JSON.stringify(options)}`, () => {
  const f = coinFixture(options), bounds = maskEngine.coinMaskBounds(f.source, f.mask, f.assessment), plan = geometry.coinRenderPlan(bounds, f.assessment), result = renderer.renderCoinPhotograph(f.source, f.mask, plan);
  assert.equal(result.raster.width, 1600); assert.equal(result.raster.height, 1600); assert.equal(result.audit.backgroundWhite, true); assert.equal(result.audit.maxChannelAdjustment, 0);
  const centre = (800 * 1600 + 800) * 4; assert.ok(result.raster.data[centre + 1] > 0 && result.raster.data[centre + 1] < 200); assert.equal(result.raster.data[centre + 3], 255);
  if (options.hole) { const x = Math.round(plan.left + (420 - bounds.left + .5) * plan.scaleX), y = Math.round(plan.top + (350 - bounds.top + .5) * plan.scaleY); assert.deepEqual([...result.raster.data.slice((y * 1600 + x) * 4, (y * 1600 + x) * 4 + 4)], [255, 255, 255, 255]); }
});
test('clipped, ambiguous, occluded, glare-obscured or insufficient masks safely reject rather than reconstruct', () => {
  const f = coinFixture();
  for (const patch of [{ complete: false }, { confidence: .5 }, { objectCount: 2 }, { occluded: true }, { severeGlare: true }, { maskPreservesRim: false }, { maskPreservesHoles: false }]) assert.throws(() => maskEngine.coinMaskBounds(f.source, f.mask, { ...f.assessment, ...patch }));
  const wrong = { ...f.mask, width: 699 }; assert.throws(() => maskEngine.coinMaskBounds(f.source, wrong, f.assessment), /dimensions/);
});
test('tiny photographic adjustments are capped; irregular flans never receive circle stretching', () => {
  const f = coinFixture({ irregular: true }), bounds = maskEngine.coinMaskBounds(f.source, f.mask, f.assessment);
  const plan = geometry.coinRenderPlan(bounds, { ...f.assessment, perspective: { reliable: true, regularCircular: true, axis: 'x', ratio: 1.04 }, lighting: { reliable: true, x: .02, y: .02 }, sharpenSafe: true });
  assert.equal(plan.perspectiveApplied, false); assert.ok(sampling.coinSourceSample(f.source, f.mask, 400, 400, plan).adjustment <= 2.00001);
  const regular = geometry.coinRenderPlan(bounds, { ...f.assessment, irregular: false, perspective: { reliable: true, regularCircular: true, axis: 'x', ratio: 1.04 } }); assert.equal(regular.perspectiveApplied, true);
  assert.equal(geometry.coinRenderPlan(bounds, { ...f.assessment, irregular: false, perspective: { reliable: true, regularCircular: true, axis: 'x', ratio: 1.5 } }).perspectiveApplied, false);
});
