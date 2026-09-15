import { decodeSchedule, SAMPLE_EVENTS, type ScheduleEvent } from './schedule.ts';

export type GridLayout = { hourHeight: number; dayWidth: number; fontSize: number };
export type ProjectDocument = { format: 'glance'; version: 2; events: ScheduleEvent[]; layout: GridLayout };
export const PROJECT_STORAGE_KEY = 'glance.project.v2';
export const MAX_PROJECT_BYTES = 1024 * 1024;
export const MAX_EVENTS = 1000;
export const DEFAULT_LAYOUT: GridLayout = { hourHeight: 72, dayWidth: 116, fontSize: 14 };

export function createProject(events: ScheduleEvent[] = SAMPLE_EVENTS): ProjectDocument {
  return { format: 'glance', version: 2, events: events.map(e => ({ ...e })), layout: { ...DEFAULT_LAYOUT } };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  if (value.version !== 1 && value.version !== 2) throw new Error('不支援這個專案版本，請使用相容版本的 Glance 開啟。');
  if (value.version === 2 && value.format !== 'glance') throw new Error('這不是 Glance 專案格式。');
  let events: ScheduleEvent[];
  try {
    events = decodeSchedule(JSON.stringify({ version: 1, events: value.events }));
    if (events.some(e => e.id.length > 128)) throw new Error('Invalid ID');
  } catch { throw new Error('行程資料無效，請確認星期、時間、分類與行程編號。'); }
  return { format: 'glance', version: 2, events, layout: value.version === 1 ? { ...DEFAULT_LAYOUT } : readLayout(value.layout) };
}

export function encodeProject(project: ProjectDocument): string {
  // Export only a validated portable document, never transient editor or browser state.
  return JSON.stringify(decodeProject(JSON.stringify(project)), null, 2) + '\n';
}
