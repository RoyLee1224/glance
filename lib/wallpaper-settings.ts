export type WallpaperSettings = {
  x: number; y: number; width: number; height: number;
  opacity: number; blur: number; tint: string; radius: number;
};

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  x: 0.03, y: 0.32, width: 0.94, height: 0.53,
  opacity: 0.58, blur: 14, tint: '#0b1630', radius: 12,
};

export function readWallpaperSettings(value: unknown): WallpaperSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('專案缺少桌布排版設定。');
  const item = value as Record<string, unknown>;
  const ranges = { x: [0, 1], y: [0, 1], width: [0.35, 1], height: [0.2, 0.9], opacity: [0.05, 0.9], blur: [0, 30], radius: [0, 40] };
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < min || item[key] > max) throw new Error('桌布排版設定超出支援範圍。');
  }
  if (typeof item.tint !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.tint)) throw new Error('玻璃色調無效。');
  const result = Object.fromEntries([...Object.keys(ranges), 'tint'].map(key => [key, item[key]])) as WallpaperSettings;
  if (result.x + result.width > 1.000001 || result.y + result.height > 1.000001) throw new Error('行程表必須位於底圖範圍內。');
  return result;
}

export function positionWallpaper(settings: WallpaperSettings, patch: Partial<WallpaperSettings>): WallpaperSettings {
  const next = { ...settings, ...patch };
  next.x = Math.max(0, Math.min(1 - next.width, next.x));
  next.y = Math.max(0, Math.min(1 - next.height, next.y));
  return next;
}
