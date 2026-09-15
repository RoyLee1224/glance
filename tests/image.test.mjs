import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../lib/project.ts';
import { scheduleImageLayout, fitTextLines } from '../lib/schedule-image.ts';
import { eventColors } from '../lib/event-colors.ts';

test('image includes the full configured week with category colors and no viewport dependency', () => {
  const project = createProject();
  const before = JSON.stringify(project);
  const image = scheduleImageLayout(project);
  assert.equal(image.cards.length, project.events.length);
  assert.equal(image.gridWidth, 5 * project.layout.dayWidth);
  assert.equal(image.gridHeight, 12 * project.layout.hourHeight);
  assert.equal(image.pixelWidth, image.width * 2);
  assert.equal(image.pixelHeight, image.height * 2);
  assert.equal(image.ticks.at(0).label, '09:00');
  assert.equal(image.ticks.at(-1).label, '21:00');
  assert.equal(image.lines.length, 23);
  assert.equal(image.lines.filter(line => line.hour).length, 11);
  const planning = image.cards.find(card => card.event.id === 'sample-0');
  assert.equal(planning.y, image.gridY);
  assert.equal(planning.height, project.layout.hourHeight - 3);
  assert.deepEqual(planning.colors, eventColors('#4387d5'));
  assert.equal(JSON.stringify(project), before);
});

test('export clips to custom days and quarter-hour endpoints without including hidden events', () => {
  const project = createProject([
    { id: 'clipped', title: '閱讀', day: 6, start: 1320, end: 1440, category: 'project' },
    { id: 'hidden-day', title: '週一', day: 0, start: 1320, end: 1440, category: 'project' },
    { id: 'hidden-time', title: '上午', day: 6, start: 540, end: 600, category: 'project' },
  ]);
  project.grid = { days: [6], start: 1395, end: 1440 };
  project.layout = { dayWidth: 180, hourHeight: 144, fontSize: 18 };
  const image = scheduleImageLayout(project);
  assert.equal(image.cards.length, 1);
  assert.equal(image.cards[0].y, image.gridY);
  assert.equal(image.cards[0].height, image.gridHeight - 3);
  assert.deepEqual(image.ticks.map(tick => tick.label), ['23:15', '24:00']);
  assert.equal(project.events[0].start, 1320);
  assert.equal(image.gridWidth, 180);
});

test('overlap cards stay in separate positive-width lanes even in dense imported projects', () => {
  const project = createProject(Array.from({ length: 1000 }, (_, i) => ({
    id: String(i), title: '會議', day: 0, start: 540, end: 600, category: 'project',
  })));
  const { cards, gridX, gridY, gridWidth, gridHeight } = scheduleImageLayout(project);
  assert.equal(cards.length, 1000);
  for (const card of cards) {
    assert.ok(card.width > 0 && card.height > 0);
    assert.ok(card.x >= gridX && card.x + card.width <= gridX + gridWidth);
    assert.ok(card.y >= gridY && card.y + card.height <= gridY + gridHeight);
  }
  const ordered = [...cards].sort((a, b) => a.x - b.x);
  assert.ok(ordered.every((card, i) => i === 0 || card.x >= ordered[i - 1].x + ordered[i - 1].width));
});

test('largest supported layout stays within image memory and dimension limits', () => {
  const project = createProject([]);
  project.grid = { days: [0, 1, 2, 3, 4, 5, 6], start: 0, end: 1440 };
  project.layout = { dayWidth: 240, hourHeight: 144, fontSize: 20 };
  const image = scheduleImageLayout(project);
  assert.ok(image.pixelWidth <= 4096 && image.pixelHeight <= 4096);
  assert.ok(image.pixelWidth * image.pixelHeight <= 8_000_000);
  assert.ok(image.scale >= 1);
  assert.equal(image.gridHeight, 24 * 144);
});

test('image text wraps words and Chinese, keeps emoji intact and truncates within its box', () => {
  const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const measure = text => [...segmenter.segment(text)].length;
  assert.deepEqual(fitTextLines('Weekly Review', 6, 2, measure), ['Weekly', 'Review']);
  assert.deepEqual(fitTextLines('閱讀學習計畫', 3, 2, measure), ['閱讀學', '習計畫']);
  assert.deepEqual(fitTextLines('閱讀學習計畫', 3, 1, measure), ['閱讀…']);
  assert.deepEqual(fitTextLines('🧑‍💻👨‍👩‍👧‍👦🏸', 2, 2, measure), ['🧑‍💻👨‍👩‍👧‍👦', '🏸']);
  assert.deepEqual(fitTextLines('text', 0.5, 1, measure), []);
});
