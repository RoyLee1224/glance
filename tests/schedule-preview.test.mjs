import test from 'node:test';
import assert from 'node:assert/strict';
import { editorGrid, previewSchedule } from '../lib/schedule-preview.ts';
import { createProject, encodeProject } from '../lib/project.ts';
import { layoutDay } from '../lib/schedule.ts';

const draft = { id: 'draft', title: '', day: 0, start: 540, end: 600, category: 'course' };

test('a new empty draft occupies a grid slot while saved data and exports remain untouched', () => {
  const project = createProject([]);
  const before = encodeProject(project);
  const preview = previewSchedule(project.events, draft);
  const cards = layoutDay(preview, 0);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, '新增行程');
  assert.equal(cards[0].start, draft.start);
  assert.equal(cards[0].end, draft.end);
  assert.equal(encodeProject(project), before);
  assert.equal(draft.title, '');
  assert.deepEqual(previewSchedule(project.events, null), []);
});

test('draft updates and drag previews occupy only one card and use the usual overlap layout', () => {
  const existing = { ...draft, id: 'saved', title: '閱讀' };
  const events = [existing];
  const updated = { ...draft, title: '新增會議', start: 570, end: 630 };
  const cards = layoutDay(previewSchedule(events, updated), 0);
  assert.equal(cards.length, 2);
  assert.ok(cards.every(card => card.lanes === 2));
  assert.equal(new Set(cards.map(card => card.lane)).size, 2);
  const moving = previewSchedule(events, { ...existing, start: 600, end: 660 });
  assert.equal(moving.length, 1);
  assert.equal(moving[0].start, 600);
  assert.equal(existing.start, 540);
});

test('phone day navigation respects custom weekdays without changing the exported week', () => {
  const project = createProject([]);
  project.grid = { days: [2, 5, 6], start: 375, end: 1440 };
  const before = encodeProject(project);
  assert.deepEqual(editorGrid(project.grid, true, 5), { days: [5], start: 375, end: 1440 });
  assert.deepEqual(editorGrid(project.grid, true, 0).days, [2]);
  assert.deepEqual(editorGrid(project.grid, false, 5), project.grid);
  assert.equal(encodeProject(project), before);
});
