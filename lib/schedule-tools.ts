import { decodeSchedule, type ScheduleEvent } from './schedule.ts';

type Actions = { getEvents: () => ScheduleEvent[]; replaceEvents: (events: ScheduleEvent[]) => void };
type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => unknown };
type Context = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };

export function createScheduleTools(actions: Actions): Tool[] {
  return [
    {
      name: 'get_weekly_schedule', title: '讀取週行程', description: 'Read the currently displayed Monday–Friday weekly schedule. Times are minutes since midnight.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({ events: actions.getEvents().map(e => ({ ...e })) }),
    },
    {
      name: 'save_schedule_events', title: '儲存行程', description: 'Create or update one or more events in the displayed weekly schedule and attempt device-local saving. Supply unique stable IDs; existing IDs are updated. Times must be 15-minute increments from 540 (09:00) to 1260 (21:00).',
      inputSchema: {
        type: 'object', required: ['events'], additionalProperties: false,
        properties: { events: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id', 'title', 'day', 'start', 'end', 'category'], properties: { id: { type: 'string', minLength: 1 }, title: { type: 'string', minLength: 1, maxLength: 60 }, day: { type: 'integer', minimum: 0, maximum: 4 }, start: { type: 'integer', minimum: 540, maximum: 1245, multipleOf: 15 }, end: { type: 'integer', minimum: 555, maximum: 1260, multipleOf: 15 }, category: { enum: ['course', 'development', 'client', 'project', 'leisure'] } } } } },
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        if (!input || typeof input !== 'object' || !('events' in input) || !Array.isArray(input.events) || input.events.length === 0) throw new Error('Provide a non-empty events array.');
        const edits = decodeSchedule(JSON.stringify({ version: 1, events: input.events }));
        const ids = new Set(edits.map(e => e.id));
        const next = [...actions.getEvents().filter(e => !ids.has(e.id)), ...edits];
        actions.replaceEvents(next);
        return { updatedIds: [...ids], totalEvents: next.length, persistence: 'Device-local save attempted; check the page save status.' };
      },
    },
  ];
}

export function registerScheduleTools(actions: Actions) {
  const context = (document as Document & { modelContext?: Context }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  for (const tool of createScheduleTools(actions)) {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => lifecycle.abort()); }
    catch { lifecycle.abort(); }
  }
  return () => lifecycle.abort();
}
