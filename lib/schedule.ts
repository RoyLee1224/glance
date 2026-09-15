export const DAYS = ['週一', '週二', '週三', '週四', '週五'];
export const DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
export const START = 540, END = 1260, STEP = 15;
export const CATEGORIES = [
  { id: 'course', label: '課程', color: '#8662d9' },
  { id: 'development', label: '開源 / 開發', color: '#4387d5' },
  { id: 'client', label: '接案 / 網頁', color: '#cf9027' },
  { id: 'project', label: '專案', color: '#788495' },
  { id: 'leisure', label: '休閒', color: '#5a9b64' },
] as const;
export type Category = typeof CATEGORIES[number]['id'];
export type ScheduleEvent = { id: string; title: string; day: number; start: number; end: number; category: Category };
export type PositionedEvent = ScheduleEvent & { lane: number; lanes: number };
export const STORAGE_KEY = 'glance.schedule.v1';
export function timeLabel(minutes: number): string { return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`; }
export function parseTime(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [h, m] = value.split(':').map(Number);
  return h < 24 && m < 60 ? h * 60 + m : NaN;
}
export function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }
export function snap(value: number) { return Math.round(value / STEP) * STEP; }
export function hoursLabel(minutes: number) { return `${Math.round(minutes / 60 * 100) / 100}`; }
export function validateEvent(event: ScheduleEvent): string | null {
  if (!event.title.trim()) return '請輸入行程名稱。';
  if (event.title.trim().length > 60) return '名稱請保持在 60 字以內。';
  if (!Number.isInteger(event.day) || event.day < 0 || event.day > 4) return '請選擇週一到週五。';
  if (!Number.isFinite(event.start) || !Number.isFinite(event.end) || event.start < START || event.end > END || event.end <= event.start) return '結束時間需晚於開始，並介於 09:00–21:00。';
  if (event.start % STEP || event.end % STEP) return '請以 15 分鐘為單位設定時間。';
  if (!CATEGORIES.some(c => c.id === event.category)) return '請選擇行程分類。';
  return null;
}
export function decodeSchedule(raw: string): ScheduleEvent[] {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('events' in data) || !Array.isArray(data.events)) throw new Error('Invalid schedule');
  const ids = new Set<string>();
  return data.events.map((e: unknown) => {
    if (!e || typeof e !== 'object') throw new Error('Invalid event');
    const item = e as ScheduleEvent;
    if (typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.title !== 'string' || validateEvent(item)) throw new Error('Invalid event');
    ids.add(item.id);
    return { id: item.id, title: item.title.trim(), day: item.day, start: item.start, end: item.end, category: item.category };
  });
}
export function overlaps(a: ScheduleEvent, b: ScheduleEvent) { return a.id !== b.id && a.day === b.day && a.start < b.end && b.start < a.end; }
export function layoutDay(events: ScheduleEvent[], day: number): PositionedEvent[] {
  const sorted = events.filter(e => e.day === day).sort((a, b) => a.start - b.start || a.end - b.end || a.id.localeCompare(b.id));
  const result: PositionedEvent[] = [];
  let group: PositionedEvent[] = [], ends: number[] = [], groupEnd = -1;
  const flush = () => { group.forEach(e => result.push({ ...e, lanes: ends.length })); group = []; ends = []; };
  for (const event of sorted) {
    if (event.start >= groupEnd) flush();
    let lane = ends.findIndex(end => end <= event.start);
    if (lane === -1) lane = ends.length;
    ends[lane] = event.end;
    group.push({ ...event, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, event.end);
  }
  flush();
  return result;
}
export function moveEvent(event: ScheduleEvent, day: number, delta: number): ScheduleEvent {
  const start = clamp(event.start + snap(delta), START, END - (event.end - event.start));
  return { ...event, day: clamp(Math.round(day), 0, 4), start, end: start + event.end - event.start };
}
export function resizeEvent(event: ScheduleEvent, delta: number): ScheduleEvent { return { ...event, end: clamp(event.end + snap(delta), event.start + STEP, END) }; }
export const SAMPLE_EVENTS: ScheduleEvent[] = [
  ['0', 'Airflow', 0, '09:00', '11:00', 'development'],
  ['1', '學堂網頁', 0, '11:00', '12:00', 'client'],
  ['2', 'FA 作業', 0, '14:00', '17:00', 'course'],
  ['3', 'FA 課', 0, '18:00', '21:00', 'course'],
  ['4', 'Airflow', 1, '09:00', '10:00', 'development'],
  ['5', 'Algo 課', 1, '10:15', '12:15', 'course'],
  ['6', '網球', 1, '15:00', '17:00', 'leisure'],
  ['7', '診所網頁', 1, '18:00', '20:00', 'client'],
  ['8', 'Pigpen', 1, '20:00', '21:00', 'project'],
  ['9', 'Airflow', 2, '09:00', '11:00', 'development'],
  ['10', '學堂網頁', 2, '14:00', '16:00', 'client'],
  ['11', 'Pigpen', 2, '16:00', '17:00', 'project'],
  ['12', 'DS&AI 課', 2, '19:00', '21:00', 'course'],
  ['13', '診所 Sync', 3, '09:00', '10:00', 'client'],
  ['14', 'FA 討論課', 3, '11:15', '12:15', 'course'],
  ['15', 'Switch Party', 3, '14:00', '17:00', 'leisure'],
  ['16', 'Airflow', 4, '09:00', '11:00', 'development'],
  ['17', '學堂網頁', 4, '18:00', '20:00', 'client'],
  ['18', 'Pigpen', 4, '20:00', '21:00', 'project'],
].map(([id, title, day, start, end, category]) => ({ id: `sample-${id}`, title: String(title), day: Number(day), start: parseTime(String(start)), end: parseTime(String(end)), category: category as Category }));
