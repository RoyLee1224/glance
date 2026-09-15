import test from 'node:test';
import assert from 'node:assert/strict';
import { IPHONE_SCREEN, phonePhotoBounds } from '../lib/wallpaper-preview.ts';

test('phone preview fills the screen without distorting portrait, landscape or square photos', () => {
  for (const [width, height] of [[1179, 2556], [4032, 3024], [3024, 4032], [1000, 4000], [1000, 1000]]) {
    const bounds = phonePhotoBounds(width, height);
    assert.ok(bounds.width >= 100 && bounds.height >= 100);
    assert.ok(bounds.width === 100 || bounds.height === 100);
    const displayedRatio = bounds.width * IPHONE_SCREEN.width / (bounds.height * IPHONE_SCREEN.height);
    assert.ok(Math.abs(displayedRatio - width / height) < 1e-9);
  }
});

test('a matching wallpaper is fully visible while wide and tall photos crop on the correct axis', () => {
  assert.deepEqual(phonePhotoBounds(1179, 2556), { width: 100, height: 100 });
  const landscape = phonePhotoBounds(4032, 3024);
  assert.ok(landscape.width > 100);
  assert.equal(landscape.height, 100);
  const portrait = phonePhotoBounds(1000, 4000);
  assert.equal(portrait.width, 100);
  assert.ok(portrait.height > 100);
});
