# Glance · 每週行程

Local-first weekly timetable editor. React + TypeScript + Vite, static output, no application backend.

## Development

Requires Node 22.13+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Click/drag an empty slot to create an event, drag an event to move it, or drag its lower edge to resize it. Click a block to edit its name, day, times, or category. The form supports keyboard and touch input; on mobile it appears below the horizontally scrollable grid. Changes are saved in this browser's localStorage. Press **⌘Z** (Mac) or **Ctrl+Z** (Windows/Linux) to undo up to 50 changes in the current session, including layout changes and project imports. Undo uses the keyboard shortcut only; text fields retain native text undo. Project undo is paused while a dialog or drag is active.

## Portable project files

Use **匯出 JSON** to download the committed schedule, custom category names/colors, displayed weekdays/time range, and layout (hour height, minimum day width, and event font size). Unsaved form edits are excluded. **匯入 JSON** validates a file locally and asks before replacing the current project. The previous saved project can be restored with **⌘Z / Ctrl+Z**. Invalid files leave the current project untouched.

The portable format contains `format: "glance"`, `version: 3`, `events`, `categories`, `grid` (days, start, end), and `layout`. Version 1 and 2 backups migrate with default categories/display range; existing layout is preserved. Files are limited to 1 MiB and 1,000 events; incompatible versions or unsupported layout fields are rejected. Versioned format details are in `lib/project.ts`. Existing browser data migrates on the next save; the legacy storage key is left intact.

No application database, login, analytics, or network upload of schedules is used. Import and export run in the browser. JSON files are unencrypted and include event names; treat them as personal files. Clearing browser storage removes the local copy, so export a backup before switching browser or origin. Hosting providers may process ordinary web access logs independently of the app. Optional WebMCP tools expose schedule actions to compatible browser agents; the app itself does not send schedules to an AI API.

## Validation

```sh
npm test
npm run build
```

The build checks TypeScript and emits static files to `dist/`.

## Deploy to Cloudflare Pages

- Connect your GitHub repository.
- Root directory: `web` if this folder lives in the enclosing Glance repository; leave blank if this folder itself is the repository root.
- Build command: `npm run build`.
- Output directory: `dist`.
- Node version: 22.13 or newer.

The same static output works on Netlify, Vercel, or Sites. No secrets, database, or server process are needed. Browser storage is specific to the browser and origin; localhost and a deployed URL have separate schedules.

## Scope

Move an event by dragging its body. Hover or select it to reveal a bottom-center resize grip with a 24px-tall pointer target (32px on touch screens). The grip occupies at most half the card width so short events retain a separate move area. Resizing keeps the vertical-resize cursor throughout the gesture.

Event titles and times follow the category color, using darker text on opaque pastel cards. Grid lines appear on the hour with lighter half-hour subdivisions; pointer editing still snaps to 15 minutes. Custom light category colors receive darker text for readability.

Default display: Monday–Friday, 09:00–21:00. Users can select any weekdays (Monday–Sunday) and a shared daily start/end within 00:00–24:00, in 15-minute increments. Use **週表設定** or **編輯分類** to customize. Category labels/colors are editable; categories can be added and removed, with reassignment of existing events. At least one category and weekday are required. The supplied example contains 19 events and 34 scheduled hours. Switch Party is Thursday, following the written specification. Overlapping appointments are displayed side by side; total hours sum all event durations, including overlaps and events outside the display range. Narrowing the display preserves all data: intersecting events are clipped visually, and an off-grid list provides edit/reveal actions. **顯示全部** expands the grid to include every event. Overnight events should be split at midnight; the end selector supports 24:00.

Liquid Glass rendering, photo compositing, PNG export, calendar integration, and account synchronization are later milestones. The lock-screen screenshots in the parent folder are visual references, not clean original wallpaper assets.

`lib/schedule.ts` is the renderer-independent schedule model. `lib/schedule-tools.ts` exposes optional WebMCP reading and batched creation/editing to supported browsers. Its contract has unit coverage; live WebMCP/browser interaction verification requires a connected compatible browser.
