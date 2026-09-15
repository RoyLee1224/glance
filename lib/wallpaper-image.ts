import { decodeProject, type ProjectDocument } from './project.ts';
import { DAYS } from './schedule.ts';
import { drawEventText, scheduleImageLayout } from './schedule-image.ts';

export function wallpaperGeometry(project: ProjectDocument, width: number, height: number) {
  const settings = project.wallpaper;
  const panel = { x: settings.x * width, y: settings.y * height, width: settings.width * width, height: settings.height * height };
  const logicalWidth = scheduleImageLayout(project).width - 38;
  const logicalHeight = panel.height / panel.width * logicalWidth;
  const adjusted = { ...project, layout: { ...project.layout, hourHeight: Math.max(72, logicalHeight - 64) * 60 / (project.grid.end - project.grid.start) } };
  const base = scheduleImageLayout(adjusted);
  // A compact, single-row weekday heading and narrow time rail match the reference.
  const image = {
    width: logicalWidth, height: base.height - 53, gridX: base.gridX - 38, gridY: base.gridY - 49,
    gridWidth: base.gridWidth, gridHeight: base.gridHeight,
    cards: base.cards.map(card => ({ ...card, x: card.x - 38, y: card.y - 49 })),
    ticks: base.ticks.map(tick => ({ ...tick, y: tick.y - 49 })),
    lines: base.lines.map(line => ({ ...line, y: line.y - 49 })),
  };
  const scale = Math.min(panel.width / image.width, panel.height / image.height);
  return { panel, image, scale, contentX: (panel.width - image.width * scale) / 2, contentY: (panel.height - image.height * scale) / 2 };
}

// A portable blur shared by preview and export, including browsers without canvas filters.
export function blurPixels(source: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (source.length !== width * height * 4 || width < 1 || height < 1) throw new Error('Invalid image dimensions');
  let input = new Uint8ClampedArray(source);
  const r = Math.max(0, Math.min(64, Math.round(radius)));
  if (!r) return input;
  for (let pass = 0; pass < 3; pass++) {
    for (const vertical of [false, true]) {
      const output = new Uint8ClampedArray(input.length);
      const length = vertical ? height : width, count = vertical ? width : height;
      const at = (line: number, position: number) => (vertical ? position * width + line : line * width + position) * 4;
      for (let line = 0; line < count; line++) {
        const sums = [0, 0, 0, 0];
        for (let offset = -r; offset <= r; offset++) {
          const index = at(line, Math.max(0, Math.min(length - 1, offset)));
          for (let channel = 0; channel < 4; channel++) sums[channel] += input[index + channel];
        }
        for (let position = 0; position < length; position++) {
          const index = at(line, position);
          const remove = at(line, Math.max(0, position - r));
          const add = at(line, Math.min(length - 1, position + r + 1));
          for (let channel = 0; channel < 4; channel++) {
            output[index + channel] = sums[channel] / (r * 2 + 1);
            sums[channel] += input[add + channel] - input[remove + channel];
          }
        }
      }
      input = output;
    }
  }
  return input;
}

const rgb = (color: string) => [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
const rgba = (color: string, alpha: number) => `rgba(${rgb(color).join(',')},${alpha})`;
const lightColor = (color: string, amount: number) => `rgb(${rgb(color).map(channel => Math.round(channel + (255 - channel) * amount)).join(',')})`;

export class WallpaperRenderer {
  private photo: HTMLImageElement;
  private texture: HTMLCanvasElement;
  private pixels: ImageData;
  private lastBlur = -1;

  constructor(photo: HTMLImageElement) {
    this.photo = photo;
    this.texture = document.createElement('canvas');
    const scale = Math.min(1, 768 / Math.max(photo.naturalWidth, photo.naturalHeight));
    this.texture.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    this.texture.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const ctx = this.texture.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('瀏覽器無法建立玻璃預覽。');
    ctx.drawImage(photo, 0, 0, this.texture.width, this.texture.height);
    this.pixels = ctx.getImageData(0, 0, this.texture.width, this.texture.height);
  }

  private lightSurface(project: ProjectDocument) {
    const { x, y, width, height, opacity, tint } = project.wallpaper;
    const pixels = this.pixels, channels = [0, 0, 0];
    let count = 0;
    for (let row = Math.floor(y * pixels.height); row < (y + height) * pixels.height && row < pixels.height; row += 8) {
      for (let column = Math.floor(x * pixels.width); column < (x + width) * pixels.width && column < pixels.width; column += 8) {
        const index = (row * pixels.width + column) * 4;
        channels.forEach((_, i) => { channels[i] += pixels.data[index + i]; });
        count++;
      }
    }
    const tinted = rgb(tint).map((channel, i) => channel * opacity + channels[i] / Math.max(1, count) * (1 - opacity));
    return (tinted[0] * 0.2126 + tinted[1] * 0.7152 + tinted[2] * 0.0722) / 255 > 0.58;
  }

  render(canvas: HTMLCanvasElement, project: ProjectDocument) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('瀏覽器無法建立圖片。');
    const { wallpaper: settings } = project;
    if (settings.blur !== this.lastBlur) {
      const data = blurPixels(this.pixels.data, this.pixels.width, this.pixels.height, settings.blur * this.pixels.width / 400);
      this.texture.getContext('2d')!.putImageData(new ImageData(data, this.pixels.width, this.pixels.height), 0, 0);
      this.lastBlur = settings.blur;
    }
    const width = canvas.width, height = canvas.height;
    const { panel, image, scale, contentX, contentY } = wallpaperGeometry(project, width, height);
    const light = this.lightSurface(project);
    const fontFamily = getComputedStyle(document.body).fontFamily;
    const foreground = light ? '#203048' : '#eef4ff';
    const muted = light ? 'rgba(25,43,63,.7)' : 'rgba(230,242,255,.7)';
    ctx.clearRect(0, 0, width, height);
    // The original photo is drawn directly; all effects are clipped to the overlay.
    ctx.drawImage(this.photo, 0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(panel.x, panel.y, panel.width, panel.height, settings.radius * panel.width / 400);
    ctx.clip();
    const backdrop = settings.blur > 0 ? this.texture : this.photo;
    // Subtle magnification inside the glass gives the boundary a refracted edge.
    ctx.drawImage(backdrop, -width * 0.005, -height * 0.005, width * 1.01, height * 1.01);
    ctx.fillStyle = rgba(settings.tint, settings.opacity);
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    const shine = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y + panel.height);
    shine.addColorStop(0, 'rgba(255,255,255,.13)');
    shine.addColorStop(0.45, 'rgba(255,255,255,.015)');
    shine.addColorStop(1, 'rgba(255,255,255,.07)');
    ctx.fillStyle = shine;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    ctx.lineWidth = Math.max(2, panel.width / 400 * 1.5);
    const rim = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y + panel.height);
    rim.addColorStop(0, 'rgba(255,255,255,.8)');
    rim.addColorStop(0.45, 'rgba(255,255,255,.16)');
    rim.addColorStop(1, 'rgba(255,255,255,.5)');
    ctx.strokeStyle = rim;
    ctx.stroke();

    ctx.translate(panel.x + contentX, panel.y + contentY);
    ctx.scale(scale, scale);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = foreground;
    ctx.font = `550 16px ${fontFamily}`;
    project.grid.days.forEach((day, index) => ctx.fillText(DAYS[day], image.gridX + (index + 0.5) * project.layout.dayWidth, 25));
    ctx.fillStyle = muted;
    ctx.font = `400 11px ${fontFamily}`;
    image.ticks.forEach(tick => ctx.fillText(tick.label, 26, tick.y));
    const line = (x1: number, y1: number, x2: number, y2: number, alpha: number) => {
      ctx.beginPath();
      ctx.strokeStyle = light ? `rgba(20,40,60,${alpha})` : `rgba(220,235,255,${alpha})`;
      ctx.lineWidth = 0.7;
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };
    // Grid lines stay out of the translucent cards while the photo remains visible.
    ctx.save();
    ctx.beginPath();
    ctx.rect(image.gridX - 1, image.gridY - 1, image.gridWidth + 2, image.gridHeight + 2);
    image.cards.forEach(card => { ctx.moveTo(card.x, card.y); ctx.roundRect(card.x, card.y, card.width, card.height, Math.min(7, card.width / 2, card.height / 2)); });
    ctx.clip('evenodd');
    image.lines.forEach(({ y, hour }) => line(image.gridX, y, image.gridX + image.gridWidth, y, hour ? 0.2 : 0.08));
    line(image.gridX, image.gridY, image.gridX + image.gridWidth, image.gridY, 0.25);
    line(image.gridX, image.gridY + image.gridHeight, image.gridX + image.gridWidth, image.gridY + image.gridHeight, 0.25);
    for (let index = 1; index < project.grid.days.length; index++) {
      const x = image.gridX + index * project.layout.dayWidth;
      line(x, image.gridY, x, image.gridY + image.gridHeight, 0.055);
    }
    ctx.restore();
    image.cards.forEach(card => {
      const color = project.categories.find(category => category.id === card.event.category)!.color;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(card.x, card.y, card.width, card.height, Math.min(7, card.width / 2, card.height / 2));
      ctx.clip();
      ctx.fillStyle = rgba(color, light ? 0.18 : 0.32);
      ctx.fill();
      ctx.strokeStyle = light ? rgba(color, 0.4) : 'rgba(230,240,255,.28)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = lightColor(color, light ? 0 : 0.25);
      ctx.fillRect(card.x, card.y, 4, card.height);
      ctx.shadowColor = light ? 'transparent' : 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetY = 0.5;
      drawEventText(ctx, { ...card, colors: { ...card.colors, text: light ? card.colors.text : lightColor(color, 0.68) } }, project.layout.fontSize, fontFamily);
      ctx.restore();
    });
    ctx.restore();
  }

  async png(project: ProjectDocument) {
    const snapshot = decodeProject(JSON.stringify(project));
    await document.fonts.ready;
    const canvas = document.createElement('canvas');
    canvas.width = this.photo.naturalWidth;
    canvas.height = this.photo.naturalHeight;
    try {
      this.render(canvas, snapshot);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('無法輸出這個尺寸的圖片，請改用較小的底圖。')), 'image/png'));
      return { blob, width: canvas.width, height: canvas.height };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  dispose() { this.texture.width = 0; this.texture.height = 0; }
}
