# Glance · 每週行程

Local-first weekly timetable editor. React + TypeScript + Vite, static output, no application backend.

## Development

Requires Node 22.13+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Click/drag an empty slot to create an event, drag an event to move it, or drag its lower edge to resize it. Click a block to edit its name, day, times, or category. The form supports keyboard and touch input; on mobile it appears below the horizontally scrollable grid. Changes are saved in this browser's localStorage. Undo reverses up to 50 changes in the current session.

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

Monday–Friday, 09:00–21:00, 15-minute increments. The supplied example contains 19 events and 34 scheduled hours. Switch Party is Thursday, following the written specification. Overlapping appointments are displayed side by side; total hours sum event durations, including overlaps.

Liquid Glass rendering, photo compositing, PNG export, calendar integration, and account synchronization are later milestones. The lock-screen screenshots in the parent folder are visual references, not clean original wallpaper assets.

`lib/schedule.ts` is the renderer-independent schedule model. `lib/schedule-tools.ts` exposes optional WebMCP reading and batched creation/editing to supported browsers. Its contract has unit coverage; live WebMCP/browser interaction verification requires a connected compatible browser.
