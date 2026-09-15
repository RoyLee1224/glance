import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, decodeProject, encodeProject, applyProjectSettings, readGrid, readCategories, expandGridToEvents } from '../lib/project.ts';
import { DEFAULT_GRID, CATEGORIES, moveEvent, resizeEvent, validateEvent, visiblePart, isFullyVisible, gridTicks } from '../lib/schedule.ts';
import { createScheduleTools } from '../lib/schedule-tools.ts';

const custom = [{ id: 'exercise', label: '運動', color: '#ff0088' }, { id: 'reading', label: '閱讀', color: '#124578' }];
const event = { id: 'weekend', title: '閱讀', day: 6, start: 1395, end: 1440, category: 'reading' };

test('v3 round-trip includes custom categories, weekends and midnight endpoints', () => {
  const project = { ...createProject([]), categories: custom, grid: { days: [0, 5, 6], start: 0, end: 1440 }, events: [event] };
  assert.deepEqual(decodeProject(encodeProject(project)), project);
  assert.equal(validateEvent(event, custom), null);
  assert.equal(validateEvent({ ...event, start: 0, end: 15 }, custom), null);
  assert.ok(validateEvent({ ...event, end: 1455 }, custom));
});

test('v2 layout survives migration while default categories and range are added', () => {
  const project = createProject();
  const old = { format: 'glance', version: 2, events: project.events, layout: { hourHeight: 96, dayWidth: 180, fontSize: 18 } };
  const restored = decodeProject(JSON.stringify(old));
  assert.equal(restored.version, 3);
  assert.deepEqual(restored.layout, old.layout);
  assert.deepEqual(restored.categories, CATEGORIES);
  assert.deepEqual(restored.grid, DEFAULT_GRID);
});

test('changing display range never changes or deletes events; reveal restores all', () => {
  const original = createProject();
  const narrowed = applyProjectSettings(original, original.categories, { days: [6], start: 840, end: 900 });
  assert.deepEqual(narrowed.events, original.events);
  assert.ok(narrowed.events.every(e => !isFullyVisible(e, narrowed.grid)));
  const expanded = expandGridToEvents(narrowed);
  assert.ok(expanded.events.every(e => isFullyVisible(e, expanded.grid)));
  assert.deepEqual(original.grid, DEFAULT_GRID);
});

test('removing a used category requires a valid reassignment and preserves event details', () => {
  const project = { ...createProject([]), categories: custom, events: [event] };
  assert.throws(() => applyProjectSettings(project, [custom[0]], project.grid));
  assert.throws(() => applyProjectSettings(project, [custom[0]], project.grid, { reading: 'missing' }));
  const next = applyProjectSettings(project, [custom[0]], project.grid, { reading: 'exercise' });
  assert.deepEqual(next.events, [{ ...event, category: 'exercise' }]);
  assert.deepEqual(project.events, [event]);
});

test('invalid ranges and categories are rejected before a project can change', () => {
  for (const grid of [{ days: [], start: 0, end: 60 }, { days: [0, 0], start: 0, end: 60 }, { days: [7], start: 0, end: 60 }, { days: [0], start: 600, end: 600 }, { days: [0], start: 22 * 60, end: 6 * 60 }, { days: [0], start: -15, end: 600 }, { days: [0], start: 10, end: 600 }]) assert.throws(() => readGrid(grid));
  for (const categories of [[], [custom[0], custom[0]], [{ ...custom[0], label: '  ' }], [{ ...custom[0], color: 'url(https://example.com)' }], [{ ...custom[0], id: '__proto__' }]]) assert.throws(() => readCategories(categories));
  assert.deepEqual(readGrid({ days: [6, 0, 5], start: 15, end: 1440 }).days, [0, 5, 6]);
});

test('clipping affects presentation only and excludes exact-boundary non-overlaps', () => {
  const grid = { days: [6], start: 1410, end: 1425 };
  assert.deepEqual(visiblePart(event, grid), { start: 1410, end: 1425 });
  assert.equal(event.start, 1395);
  assert.equal(visiblePart({ ...event, end: 1410 }, grid), null);
  assert.equal(visiblePart({ ...event, start: 1425 }, grid), null);
  assert.equal(visiblePart({ ...event, day: 5 }, grid), null);
  assert.deepEqual(gridTicks({ days: [6], start: 495, end: 645 }), [495, 540, 600, 645]);
});

test('drag and resize respect custom bounds; oversized events retain their duration', () => {
  const grid = { days: [0, 6], start: 0, end: 1440 };
  const moved = moveEvent(event, 0, -2000, grid);
  assert.equal(moved.start, 0);
  assert.equal(moved.end, 45);
  assert.equal(resizeEvent(event, 100, grid).end, 1440);
  const narrow = { days: [0, 6], start: 600, end: 615 };
  assert.deepEqual(moveEvent(event, 0, -1000, narrow), { ...event, day: 0 });
});

test('agent tools use current categories and retain off-grid events', () => {
  let events = [];
  const [read, save] = createScheduleTools({ getEvents: () => events, getCategories: () => custom, getGrid: () => DEFAULT_GRID, replaceEvents: next => { events = next; } });
  save.execute({ events: [event] });
  assert.deepEqual(read.execute({}).categories, custom);
  assert.deepEqual(read.execute({}).events, [event]);
  assert.throws(() => save.execute({ events: [{ ...event, category: 'course' }] }));
  assert.deepEqual(events, [event]);
});
