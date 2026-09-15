import { decodeEvents, SAMPLE_EVENTS, CATEGORIES, DEFAULT_GRID, STEP, type ScheduleEvent, type ScheduleCategory, type GridSettings } from './schedule.ts';

export type GridLayout = { hourHeight: number; dayWidth: number; fontSize: number };
export type ProjectDocument = { format: 'glance'; version: 3; events: ScheduleEvent[]; layout: GridLayout; categories: ScheduleCategory[]; grid: GridSettings };
export const PROJECT_STORAGE_KEY = 'glance.project.v3';
export const LEGACY_PROJECT_STORAGE_KEY = 'glance.project.v2';
export const MAX_PROJECT_BYTES = 1024 * 1024;
export const MAX_EVENTS = 1000;
export const DEFAULT_LAYOUT: GridLayout = { hourHeight: 72, dayWidth: 116, fontSize: 14 };

export function createProject(events: ScheduleEvent[] = SAMPLE_EVENTS): ProjectDocument {
  return { format: 'glance', version: 3, events: events.map(e => ({ ...e })), layout: { ...DEFAULT_LAYOUT }, categories: CATEGORIES.map(c => ({ ...c })), grid: { ...DEFAULT_GRID, days: [...DEFAULT_GRID.days] } };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function readCategories(value: unknown): ScheduleCategory[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) throw new Error('請保留 1–32 個分類。');
  const ids = new Set<string>();
  return value.map(item => {
    if (!record(item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(item.id) || ids.has(item.id)) throw new Error('分類編號無效或重複。');
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.trim().length > 40) throw new Error('分類名稱請填寫 1–40 個字。');
    if (typeof item.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(item.color)) throw new Error('請選擇有效的分類顏色。');
    ids.add(item.id);
    return { id: item.id, label: item.label.trim(), color: item.color.toLowerCase() };
  });
}

export function readGrid(value: unknown): GridSettings {
  if (!record(value) || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 7 || value.days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(value.days).size !== value.days.length) throw new Error('請至少選擇一天，星期不可重複。');
  if (typeof value.start !== 'number' || typeof value.end !== 'number' || !Number.isInteger(value.start) || !Number.isInteger(value.end) || value.start < 0 || value.end > 1440 || value.end <= value.start || value.start % STEP || value.end % STEP) throw new Error('起訖時間需介於 00:00–24:00、以 15 分鐘為單位，且結束晚於開始。');
  return { days: [...value.days].sort((a, b) => a - b), start: value.start, end: value.end };
}

export function applyProjectSettings(project: ProjectDocument, categories: ScheduleCategory[], grid: GridSettings, reassignments: Record<string, string> = {}): ProjectDocument {
  const nextCategories = readCategories(categories);
  const nextGrid = readGrid(grid);
  const events = project.events.map(event => {
    if (nextCategories.some(c => c.id === event.category)) return event;
    const target = Object.hasOwn(reassignments, event.category) ? reassignments[event.category] : '';
    if (!nextCategories.some(c => c.id === target)) throw new Error('請先為移除分類中的行程選擇新分類。');
    return { ...event, category: target };
  });
  return { ...project, categories: nextCategories, grid: nextGrid, events };
}

export function expandGridToEvents(project: ProjectDocument): ProjectDocument {
  return { ...project, grid: { days: [...new Set([...project.grid.days, ...project.events.map(e => e.day)])].sort((a, b) => a - b), start: Math.min(project.grid.start, ...project.events.map(e => e.start)), end: Math.max(project.grid.end, ...project.events.map(e => e.end)) } };
}

function readLayout(value: unknown): GridLayout {
  if (!record(value)) throw new Error('專案缺少排版設定。');
  const fields = { hourHeight: [48, 144], dayWidth: [100, 240], fontSize: [12, 20] } as const;
  if (Object.keys(value).some(key => !Object.hasOwn(fields, key))) throw new Error('排版設定含有目前版本不支援的欄位。');
  for (const [key, [min, max]] of Object.entries(fields)) {
    const setting = value[key];
    if (typeof setting !== 'number' || !Number.isInteger(setting) || setting < min || setting > max) throw new Error('排版設定的數值超出支援範圍。');
  }
  return { hourHeight: value.hourHeight as number, dayWidth: value.dayWidth as number, fontSize: value.fontSize as number };
}

export function decodeProject(raw: string): ProjectDocument {
  if (new TextEncoder().encode(raw).byteLength > MAX_PROJECT_BYTES) throw new Error('JSON 檔請小於 1 MB。');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('檔案不是有效的 JSON，請選擇 Glance 匯出的專案檔。'); }
  if (!record(value) || !Array.isArray(value.events)) throw new Error('找不到行程資料，請選擇 Glance 專案檔。');
  if (value.events.length > MAX_EVENTS) throw new Error('單一專案最多支援 1,000 個行程。');
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) throw new Error('不支援這個專案版本，請使用相容版本的 Glance 開啟。');
  if (value.version !== 1 && value.format !== 'glance') throw new Error('這不是 Glance 專案格式。');
  const categories = readCategories(value.version === 3 ? value.categories : CATEGORIES);
  const grid = readGrid(value.version === 3 ? value.grid : DEFAULT_GRID);
  let events: ScheduleEvent[];
  try {
    events = decodeEvents(value.events, categories);
    if (events.some(e => e.id.length > 128)) throw new Error('Invalid ID');
  } catch { throw new Error('行程資料無效，請確認星期、時間、分類與行程編號。'); }
  return { format: 'glance', version: 3, events, categories, grid, layout: value.version === 1 ? { ...DEFAULT_LAYOUT } : readLayout(value.layout) };
}

export function encodeProject(project: ProjectDocument): string {
  // Export only a validated portable document, never transient editor or browser state.
  return JSON.stringify(decodeProject(JSON.stringify(project)), null, 2) + '\n';
}
