import test from 'node:test';
import assert from 'node:assert/strict';
import { SAMPLE_EVENTS, START, END, layoutDay, moveEvent, resizeEvent, validateEvent, decodeSchedule, overlaps } from '../lib/schedule.ts';
import { createScheduleTools } from '../lib/schedule-tools.ts';

const make = (id, start, end, day = 0) => ({ id, title: '行程', start, end, day, category: 'course' });

test('fictional starter schedule contains valid, distinct events across the default week', () => {
  assert.equal(SAMPLE_EVENTS.length, 10);
  assert.equal(new Set(SAMPLE_EVENTS.map(event => event.id)).size, SAMPLE_EVENTS.length);
  assert.deepEqual([...new Set(SAMPLE_EVENTS.map(event => event.day))], [0, 1, 2, 3, 4]);
  assert.ok(SAMPLE_EVENTS.every(event => event.start >= START && event.end <= END));
  SAMPLE_EVENTS.forEach(event => assert.equal(validateEvent(event), null));
});

test('moving snaps to 15 minutes, keeps duration and clamps to the week', () => {
  const event = make('a', 600, 720);
  assert.deepEqual(moveEvent(event, 2, 23), { ...event, day: 2, start: 630, end: 750 });
  assert.deepEqual(moveEvent(event, -3, -1000), { ...event, day: 0, start: START, end: START + 120 });
  assert.deepEqual(moveEvent(event, 9, 1000), { ...event, day: 6, start: END - 120, end: END });
});

test('resizing cannot invert an event or pass 21:00', () => {
  const event = make('a', 600, 660);
  assert.equal(resizeEvent(event, -1000).end, 615);
  assert.equal(resizeEvent(event, 1000).end, END);
  assert.equal(resizeEvent(event, 21).end, 675);
});

test('overlap chains use distinct lanes and independent groups regain full width', () => {
  const events = [make('a', 540, 600), make('b', 570, 630), make('c', 600, 660), make('d', 660, 720)];
  const laidOut = layoutDay(events, 0);
  assert.deepEqual(laidOut.map(e => [e.id, e.lane, e.lanes]), [['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]]);
  assert.equal(overlaps(events[0], events[2]), false);
  assert.equal(overlaps(events[0], { ...events[1], day: 1 }), false);
});

test('valid empty and populated schedules round-trip; malformed data never partially loads', () => {
  const encode = events => JSON.stringify({ version: 1, events });
  assert.deepEqual(decodeSchedule(encode([])), []);
  assert.deepEqual(decodeSchedule(encode(SAMPLE_EVENTS)), SAMPLE_EVENTS);
  for (const value of ['{', '{"version":2,"events":[]}', encode([null]), encode([make('a', 541, 600)]), encode([make('a', 600, 540)]), encode([make('a', 540, 600), make('a', 630, 690)]), encode([{ ...make('a', 540, 600), category: 'unknown' }])]) {
    assert.throws(() => decodeSchedule(value));
  }
});

test('schedule tools update the same state atomically and reject invalid batches', () => {
  let events = [make('a', 540, 600)];
  const [read, write] = createScheduleTools({ getEvents: () => events, replaceEvents: next => { events = next; } });
  assert.equal(read.annotations.readOnlyHint, true);
  assert.equal(write.annotations.readOnlyHint, false);
  const result = write.execute({ events: [make('a', 600, 660), make('b', 720, 780, 1)] });
  assert.equal(result.totalEvents, 2);
  assert.equal(read.execute({}).events.find(e => e.id === 'a').start, 600);
  const before = structuredClone(events);
  assert.throws(() => write.execute({ events: [make('a', 660, 720), make('bad', 600, 540)] }));
  assert.deepEqual(events, before);
  assert.throws(() => write.execute({ events: [] }));
});
