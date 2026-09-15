import { type GridSettings, type ScheduleEvent } from './schedule.ts';

// Editor-only views never change the saved display range or exported project.
export function editorGrid(grid: GridSettings, singleDay: boolean, day: number): GridSettings {
  return singleDay ? { ...grid, days: [grid.days.includes(day) ? day : grid.days[0]] } : grid;
}

export function previewSchedule(events: ScheduleEvent[], preview: ScheduleEvent | null): ScheduleEvent[] {
  if (!preview) return events;
  return [...events.filter(event => event.id !== preview.id), { ...preview, title: preview.title.trim() || '新增行程' }];
}
