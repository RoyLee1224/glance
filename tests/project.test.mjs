import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, encodeProject, decodeProject, DEFAULT_LAYOUT, MAX_PROJECT_BYTES } from '../lib/project.ts';
import { SAMPLE_EVENTS } from '../lib/schedule.ts';

test('JSON round-trip preserves schedule and every layout setting', () => {
  const project = createProject();
  project.events[0].title = '我的自訂行程';
  project.layout = { hourHeight: 96, dayWidth: 180, fontSize: 18 };
  const restored = decodeProject(encodeProject(project));
  assert.deepEqual(restored, project);
  assert.notEqual(restored.events, project.events);
  assert.notEqual(restored.layout, project.layout);
});

test('old v1 backups migrate to the current project with default layout', () => {
  const old = JSON.stringify({ version: 1, events: SAMPLE_EVENTS });
  const restored = decodeProject(old);
  assert.equal(restored.version, 4);
  assert.equal(restored.format, 'glance');
  assert.deepEqual(restored.events, SAMPLE_EVENTS);
  assert.deepEqual(restored.layout, DEFAULT_LAYOUT);
});

test('empty schedules are valid backups and defaults are not shared mutable objects', () => {
  assert.deepEqual(decodeProject(encodeProject(createProject([]))).events, []);
  const a = createProject();
  const b = createProject();
  a.layout.fontSize = 20;
  a.events[0].title = '已修改';
  assert.equal(b.layout.fontSize, 14);
  assert.equal(b.events[0].title, '本週規劃');
});

test('incompatible or malformed projects are rejected without mutating current data', () => {
  const current = createProject();
  const before = structuredClone(current);
  const invalid = [
    '{', '[]', '{}',
    JSON.stringify({ ...current, version: 5 }),
    JSON.stringify({ ...current, format: 'different-app' }),
    JSON.stringify({ ...current, layout: null }),
    JSON.stringify({ ...current, layout: { ...current.layout, fontSize: 100 } }),
    JSON.stringify({ ...current, layout: { ...current.layout, hourHeight: -1 } }),
    JSON.stringify({ ...current, layout: { ...current.layout, dayWidth: '120' } }),
    JSON.stringify({ ...current, layout: { ...current.layout, blur: 20 } }),
    JSON.stringify({ ...current, events: [current.events[0], current.events[0]] }),
    JSON.stringify({ ...current, events: [{ ...current.events[0], start: 541 }] }),
    JSON.stringify({ ...current, events: [{ ...current.events[0], id: 'a'.repeat(129) }] }),
    JSON.stringify({ ...current, events: Array(1001).fill(current.events[0]) }),
    ' '.repeat(MAX_PROJECT_BYTES + 1),
  ];
  invalid.forEach(raw => assert.throws(() => decodeProject(raw)));
  assert.deepEqual(current, before);
});

test('export strips transient editor state and retains user text as plain data', () => {
  const project = createProject([{ ...SAMPLE_EVENTS[0], title: '<img src=x onerror=alert(1)>' }]);
  project.selectedId = 'secret-editor-value';
  project.events[0].lane = 4;
  const encoded = encodeProject(project);
  assert.equal(encoded.includes('selectedId'), false);
  assert.equal(encoded.includes('"lane"'), false);
  assert.equal(decodeProject(encoded).events[0].title, '<img src=x onerror=alert(1)>');
});
