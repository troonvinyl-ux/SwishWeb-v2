import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRapidTypescript } from './lib/load-rapid-typescript.mjs';
const selection = loadRapidTypescript('src/lib/listingCategorySelection.ts');
test('changing a coin category retains seller country/year/denomination but removes old art or branch specifics', () => {
  assert.deepEqual(selection.retainedCoinIdentitySpecifics({ 'Country/Region of Origin': 'Russia', Year: '1759', Denomination: '5 Kopeks', Artist: 'Old art guess', Number: 'Many' }), { 'Country/Region of Origin': 'Russia', Year: '1759', Denomination: '5 Kopeks' });
  assert.deepEqual(selection.retainedCoinIdentitySpecifics(null), {});
});
