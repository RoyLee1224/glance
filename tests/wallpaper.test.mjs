import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, decodeProject, encodeProject } from '../lib/project.ts';
import { DEFAULT_WALLPAPER, positionWallpaper, readWallpaperSettings } from '../lib/wallpaper-settings.ts';
import { blurPixels, wallpaperGeometry } from '../lib/wallpaper-image.ts';
import { isRasterPhoto } from '../lib/wallpaper-photo.ts';

test('v4 backs up glass settings without embedding photo or browser state', () => {
  const project = createProject();
  project.wallpaper = { x: 0.1, y: 0.3, width: 0.8, height: 0.6, opacity: 0.4, blur: 21, tint: '#a1b2c3', radius: 18 };
  project.photo = { name: 'private-photo.jpg', blob: 'photo contents' };
  const restored = decodeProject(encodeProject(project));
  assert.equal(restored.version, 4);
  assert.deepEqual(restored.wallpaper, project.wallpaper);
  assert.equal(encodeProject(project).includes('private-photo'), false);
  assert.equal(encodeProject(project).includes('photo contents'), false);
});

test('v3 migration preserves custom grid, categories and layout while adding wallpaper defaults', () => {
  const old = { ...createProject([]), version: 3, grid: { days: [5, 6], start: 0, end: 1440 }, categories: [{ id: 'custom', label: '自由安排', color: '#abcdef' }], layout: { hourHeight: 96, dayWidth: 180, fontSize: 18 } };
  delete old.wallpaper;
  const restored = decodeProject(JSON.stringify(old));
  assert.deepEqual(restored.grid, old.grid);
  assert.deepEqual(restored.categories, old.categories);
  assert.deepEqual(restored.layout, old.layout);
  assert.deepEqual(restored.wallpaper, DEFAULT_WALLPAPER);
});

test('wallpaper validation rejects missing, non-finite and off-image settings', () => {
  for (const patch of [{ x: NaN }, { height: Infinity }, { width: 0 }, { opacity: -1 }, { blur: 31 }, { radius: -1 }, { tint: 'url(x)' }, { y: 0.8 }, { x: 0.8 }]) {
    assert.throws(() => readWallpaperSettings({ ...DEFAULT_WALLPAPER, ...patch }));
  }
  assert.throws(() => readWallpaperSettings(null));
  const current = createProject();
  delete current.wallpaper;
  assert.throws(() => decodeProject(JSON.stringify(current)));
});

test('position and size changes keep the overlay inside the photo without mutating its settings', () => {
  const start = { ...DEFAULT_WALLPAPER };
  const moved = positionWallpaper(start, { x: -10, y: 10 });
  assert.equal(moved.x, 0);
  assert.equal(moved.y, 1 - moved.height);
  const widened = positionWallpaper(moved, { width: 1, height: 0.9 });
  assert.equal(widened.x, 0);
  assert.equal(widened.y, 1 - widened.height);
  assert.deepEqual(start, DEFAULT_WALLPAPER);
});

test('preview and original-resolution export have the same normalized placement and content', () => {
  const project = createProject();
  const preview = wallpaperGeometry(project, 400, 880);
  const exported = wallpaperGeometry(project, 1200, 2640);
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(exported.panel[key] - preview.panel[key] * 3) < 0.00001);
  assert.ok(Math.abs(exported.scale - preview.scale * 3) < 0.00001);
  assert.equal(exported.image.cards.length, 19);
  exported.image.cards.forEach((card, index) => {
    const expected = preview.image.cards[index];
    assert.deepEqual(card.event, expected.event);
    assert.deepEqual(card.colors, expected.colors);
    assert.equal(card.compact, expected.compact);
    for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(card[key] - expected[key]) < 1e-6);
  });
  assert.equal(exported.panel.y / 2640, 0.32);
});

test('complete grid fits the panel even for a short panel on a wide photo', () => {
  const project = createProject();
  for (const [width, height] of [[1179, 2556], [4032, 3024], [8192, 1000]]) {
    for (const panelHeight of [0.2, 0.53, 0.9]) {
      project.wallpaper = positionWallpaper(project.wallpaper, { height: panelHeight });
      const { panel, image, scale, contentX, contentY } = wallpaperGeometry(project, width, height);
      assert.ok(image.width * scale <= panel.width + 1e-6);
      assert.ok(image.height * scale <= panel.height + 1e-6);
      assert.ok(contentX >= -1e-6 && contentY >= -1e-6);
    }
  }
});

function referenceBlur(bytes, width, height, radius) {
  let input = new Uint8ClampedArray(bytes);
  for (let pass = 0; pass < 3; pass++) for (const vertical of [false, true]) {
    const output = new Uint8ClampedArray(input.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 4; channel++) {
      let sum = 0;
      for (let step = -radius; step <= radius; step++) {
        const sx = Math.max(0, Math.min(width - 1, x + (vertical ? 0 : step)));
        const sy = Math.max(0, Math.min(height - 1, y + (vertical ? step : 0)));
        sum += input[(sy * width + sx) * 4 + channel];
      }
      output[(y * width + x) * 4 + channel] = sum / (2 * radius + 1);
    }
    input = output;
  }
  return input;
}

test('portable blur matches a direct convolution at image edges and preserves input pixels', () => {
  for (const [width, height] of [[1, 1], [1, 5], [7, 1], [5, 3]]) {
    const source = Uint8ClampedArray.from({ length: width * height * 4 }, (_, index) => index % 4 === 3 ? 255 : index * 47 % 256);
    const original = source.slice();
    for (const radius of [0, 1, 4]) assert.deepEqual(blurPixels(source, width, height, radius), referenceBlur(source, width, height, radius));
    assert.deepEqual(source, original);
  }
});

test('photo file signatures allow supported rasters and exclude SVG and arbitrary files', () => {
  assert.equal(isRasterPhoto(Uint8Array.from([255, 216, 255, 224])), true);
  assert.equal(isRasterPhoto(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])), true);
  assert.equal(isRasterPhoto(new TextEncoder().encode('RIFF0000WEBP')), true);
  assert.equal(isRasterPhoto(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), false);
  assert.equal(isRasterPhoto(new TextEncoder().encode('not an image')), false);
  assert.equal(isRasterPhoto(new Uint8Array()), false);
});
