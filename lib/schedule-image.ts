import { decodeProject, type ProjectDocument } from './project.ts';
import { DAYS, DAY_CODES, gridTicks, layoutDay, timeLabel, visiblePart } from './schedule.ts';
import { eventColors } from './event-colors.ts';

const PADDING = 24, TIME_RAIL = 64, HEADER = 69;
const MAX_SIDE = 4096, MAX_PIXELS = 8_000_000;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif';

export function scheduleImageLayout(project: ProjectDocument) {
  const { grid, layout } = project;
  const gridHeight = Math.max(72, (grid.end - grid.start) / 60 * layout.hourHeight);
  const gridWidth = grid.days.length * layout.dayWidth;
  const width = PADDING * 2 + TIME_RAIL + gridWidth;
  const height = PADDING * 2 + HEADER + gridHeight;
  const scale = Math.min(2, MAX_SIDE / width, MAX_SIDE / height, Math.sqrt(MAX_PIXELS / (width * height)));
  const gridX = PADDING + TIME_RAIL, gridY = PADDING + HEADER;
  const yAt = (minute: number) => gridY + (minute - grid.start) / (grid.end - grid.start) * gridHeight;
  const visibleEvents = project.events.filter(event => visiblePart(event, grid));
  const cards = grid.days.flatMap((day, dayIndex) => layoutDay(visibleEvents, day).map(event => {
    const part = visiblePart(event, grid)!;
    const laneWidth = layout.dayWidth / event.lanes;
    const inset = Math.min(5, laneWidth / 4);
    return {
      event,
      x: gridX + dayIndex * layout.dayWidth + event.lane * laneWidth + inset,
      y: yAt(part.start),
      width: laneWidth - inset * 2,
      height: Math.max(1, yAt(part.end) - yAt(part.start) - 3),
      compact: yAt(part.end) - yAt(part.start) < layout.fontSize * 1.35 + 34,
      colors: eventColors(project.categories.find(category => category.id === event.category)!.color),
    };
  }));
  const lines = [];
  for (let minute = Math.ceil(grid.start / 30) * 30; minute < grid.end; minute += 30) {
    if (minute > grid.start) lines.push({ y: yAt(minute), hour: minute % 60 === 0 });
  }
  return {
    width, height, scale,
    pixelWidth: Math.floor(width * scale), pixelHeight: Math.floor(height * scale),
    gridX, gridY, gridWidth, gridHeight, cards, lines,
    ticks: gridTicks(grid).map(minute => ({ label: timeLabel(minute), y: yAt(minute) })),
  };
}

const graphemes = (text: string) => Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), item => item.segment);

// Keep Chinese characters and emoji intact, preferring spaces for Latin word wrapping.
export function fitTextLines(text: string, width: number, maxLines: number, measure: (text: string) => number): string[] {
  if (width <= 0 || maxLines < 1) return [];
  let remaining = graphemes(text.replace(/\s+/gu, ' ').trim());
  const lines: string[] = [];
  while (remaining.length && lines.length < maxLines) {
    let end = 0, space = -1;
    while (end < remaining.length && measure(remaining.slice(0, end + 1).join('')) <= width) {
      if (remaining[end] === ' ') space = end;
      end++;
    }
    if (end === remaining.length) { lines.push(remaining.join('')); break; }
    if (lines.length === maxLines - 1 || end === 0) {
      if (measure('…') > width) break;
      while (end > 0 && measure(remaining.slice(0, end).join('').trimEnd() + '…') > width) end--;
      lines.push(remaining.slice(0, end).join('').trimEnd() + '…');
      break;
    }
    const cut = space > 0 ? space : end;
    lines.push(remaining.slice(0, cut).join('').trimEnd());
    remaining = remaining.slice(cut);
    while (remaining[0] === ' ') remaining.shift();
  }
  return lines;
}

export type ImageLayout = ReturnType<typeof scheduleImageLayout>;

function drawCard(ctx: CanvasRenderingContext2D, card: ImageLayout['cards'][number], fontSize: number, fontFamily: string) {
  const { x, y, width, height, colors, event, compact } = card;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, Math.min(7, width / 2, height / 2));
  ctx.fillStyle = colors.background;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = colors.accent;
  ctx.fillRect(x, y, 3, height);

  drawEventText(ctx, card, fontSize, fontFamily);
  ctx.restore();
}

export function drawEventText(ctx: CanvasRenderingContext2D, card: ImageLayout['cards'][number], fontSize: number, fontFamily: string) {
  const { x, y, width, height, colors, event, compact } = card;
  ctx.save();
  const left = compact ? 8 : 11;
  const textWidth = width - left - 8;
  if (textWidth <= 0) { ctx.restore(); return; }
  ctx.fillStyle = colors.text;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `550 ${fontSize}px ${fontFamily}`;
  const lineHeight = fontSize * 1.35;
  const maxLines = compact ? 1 : Math.max(1, Math.floor((height - 18 - 4 - 16) / lineHeight));
  const titleLines = fitTextLines(event.title, textWidth, maxLines, value => ctx.measureText(value).width);
  titleLines.forEach((line, index) => ctx.fillText(line, x + left, compact ? y + height / 2 : y + 9 + lineHeight * (index + 0.5)));
  if (!compact) {
    ctx.font = `400 12px ${fontFamily}`;
    ctx.globalAlpha = 0.85;
    const time = fitTextLines(`${timeLabel(event.start)}–${timeLabel(event.end)}`, textWidth, 1, value => ctx.measureText(value).width)[0];
    if (time) ctx.fillText(time, x + left, y + 9 + titleLines.length * lineHeight + 4 + 8);
  }
  ctx.restore();
}

export function drawScheduleImage(ctx: CanvasRenderingContext2D, project: ProjectDocument, fontFamily = FONT_FAMILY) {
  const image = scheduleImageLayout(project);
  ctx.save();
  ctx.scale(image.scale, image.scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, image.width, image.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 12px ${fontFamily}`;
  ctx.fillStyle = '#9197a3';
  ctx.fillText('時間', PADDING + TIME_RAIL / 2, PADDING + HEADER / 2);
  project.grid.days.forEach((day, index) => {
    const x = image.gridX + (index + 0.5) * project.layout.dayWidth;
    ctx.font = `600 12px ${fontFamily}`;
    ctx.fillStyle = '#838997';
    ctx.fillText(DAY_CODES[day], x, PADDING + 23);
    ctx.font = `550 14px ${fontFamily}`;
    ctx.fillStyle = '#242936';
    ctx.fillText(DAYS[day], x, PADDING + 45);
  });
  ctx.font = `400 12px ${fontFamily}`;
  ctx.fillStyle = '#858c9b';
  image.ticks.forEach(tick => ctx.fillText(tick.label, PADDING + TIME_RAIL / 2, tick.y));

  const line = (x: number, y: number, endX: number, endY: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  };
  image.lines.forEach(({ y, hour }) => line(image.gridX, y, image.gridX + image.gridWidth, y, hour ? '#e7eaf0' : '#f3f5f8'));
  for (let index = 0; index <= project.grid.days.length; index++) {
    const x = image.gridX + index * project.layout.dayWidth;
    line(x, image.gridY, x, image.gridY + image.gridHeight, '#edf0f5');
  }
  line(image.gridX, image.gridY, image.gridX + image.gridWidth, image.gridY, '#e7eaf0');
  line(image.gridX, image.gridY + image.gridHeight, image.gridX + image.gridWidth, image.gridY + image.gridHeight, '#e7eaf0');
  image.cards.forEach(card => drawCard(ctx, card, project.layout.fontSize, fontFamily));
  ctx.restore();
  return image;
}

export async function createSchedulePng(project: ProjectDocument) {
  // Snapshot committed state before awaiting fonts, so later edits cannot enter the export.
  const snapshot = decodeProject(JSON.stringify(project));
  await document.fonts.ready;
  const image = scheduleImageLayout(snapshot);
  const canvas = document.createElement('canvas');
  canvas.width = image.pixelWidth;
  canvas.height = image.pixelHeight;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('瀏覽器無法建立圖片，請重新整理後再試。');
    drawScheduleImage(ctx, snapshot, getComputedStyle(document.body).fontFamily || FONT_FAMILY);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => {
      if (value) resolve(value);
      else reject(new Error('圖片產生失敗，請縮小週表範圍或每小時高度後再試。'));
    }, 'image/png'));
    return { blob, width: image.pixelWidth, height: image.pixelHeight };
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
