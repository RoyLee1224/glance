# Glance · 每週行程

Local-first weekly timetable editor. React + TypeScript + Vite, static output, no application backend.

Website: [Glance](https://roylee1224.github.io/glance/) · [Deployment status](https://github.com/RoyLee1224/glance/actions/workflows/deploy.yml)

## Development

Requires Node 22.13+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Click/drag an empty slot to create an event, drag an event to move it, or drag its lower edge to resize it. Click a block to edit its name, day, times, or category. The form supports keyboard and touch input; on mobile it appears below the horizontally scrollable grid. Changes are saved in this browser's localStorage. Press **⌘Z** (Mac) or **Ctrl+Z** (Windows/Linux) to undo up to 50 changes in the current session, including layout changes and project imports. Undo uses the keyboard shortcut only; text fields retain native text undo. Project undo is paused while a dialog or drag is active.

## Portable project files

Use **匯出 JSON** to download the committed schedule, custom category names/colors, displayed weekdays/time range, grid layout, and glass wallpaper settings. Unsaved form edits and the background photo are excluded. **匯入 JSON** validates a file locally and asks before replacing the current project; it keeps the currently selected photo. The previous saved project can be restored with **⌘Z / Ctrl+Z**. Invalid files leave the current project untouched.

The portable format contains `format: "glance"`, `version: 4`, `events`, `categories`, `grid` (days, start, end), `layout`, and `wallpaper` (normalized position/size, opacity, blur, tint and radius). Versions 1–3 migrate with appropriate defaults while preserving existing data. Files are limited to 1 MiB and 1,000 events; incompatible versions or unsupported layout fields are rejected. Versioned format details are in `lib/project.ts`. Existing browser data migrates on the next save; legacy storage keys are left intact.

No application database, login, analytics, or network upload of schedules is used. Import and export run in the browser. JSON files are unencrypted and include event names; treat them as personal files. Clearing browser storage removes the local copy, so export a backup before switching browser or origin. Hosting providers may process ordinary web access logs independently of the app. Optional WebMCP tools expose schedule actions to compatible browser agents; the app itself does not send schedules to an AI API.

## Validation

```sh
npm test
npm run build
```

The build checks TypeScript and emits static files to `dist/`.

## PNG export

Use **匯出白底週表** in the grid view to download a white-background image of the full configured grid, including columns beyond the current viewport. It uses committed events, selected days/time range, category colors, hour height, day width and font size. Hidden events and unsaved form edits are excluded; events crossing the range are clipped as in the editor. The output has weekday headings and time labels, without editing controls or selection/resize decorations.

`lib/schedule-image.ts` draws directly to a browser canvas using the same schedule and color helpers. No dependencies or uploads are needed. Plain PNGs normally render at 2×; very large layouts scale down to stay within 4,096 pixels per side and 8 million pixels total. Font rendering follows the current device.

## Liquid Glass wallpaper

Open **桌布設計**, select a JPG/PNG/WebP photo, position the glass timetable by dragging or with arrow keys, and adjust size, opacity, blur, tint and corners. Defaults follow the reference: 3% left margin, 32% top offset, 94% width and 53% height. Clock guides and placement outlines appear only in the editor. **匯出桌布 PNG** composites at the decoded photo's original dimensions. The original photograph is drawn directly, with glass effects clipped to the panel; no AI image generation or photo uploads occur. Text follows category hues, with automatic light/dark contrast based on the photo and tint. Grid lines are masked out beneath the translucent event cards.

Preview and export share `WallpaperRenderer` in `lib/wallpaper-image.ts`, including a bounded, cached CPU blur that does not depend on browser canvas-filter support. Wallpaper height controls the timetable's vertical fit; the grid editor's font size and column width determine its text scale. Very short/wide panels fit the whole schedule without stretching text.

The original file is stored locally in IndexedDB (`glance.photos`), separately from project JSON. Select the same photo again when transferring a JSON backup to another device. Photo replacement/removal is outside project undo history. File signatures are checked; inputs are limited to 20 MiB, 16 million pixels and an 8,192-pixel longest side. Browser storage or rendering failures are reported without discarding the schedule. Use an original photo without the clock, status bar or buttons baked into a screenshot.

## Deploy to GitHub Pages

The repository root contains `package.json` and the app. GitHub Actions in `.github/workflows/deploy.yml` installs dependencies, runs tests, builds the site and publishes `dist/` on every push to `main`. The repository's **Settings → Pages → Source** must be **GitHub Actions**.

The workflow uses the Pages URL's base path, so assets and the home link work at `/glance/` and also with a future custom domain. A standard `npm run build` still targets `/` for other hosts. To verify the project URL build locally, run `npm run build -- --base /glance/`.

Future updates from the existing checkout:

```sh
git add <changed-files>
git commit -m "Describe the change"
git push origin main
```

Check the Actions link above for publishing progress. Source code is public; visitors' photos and schedules stay in their own browsers. Moving from the private preview to this URL uses a different browser storage origin: export/import JSON and select the original photo again to bring your work across.

## Alternative: Cloudflare Pages

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

Calendar integration and account synchronization are later milestones. The lock-screen screenshots in the parent folder are visual references, not clean original wallpaper assets.

`lib/schedule.ts` is the renderer-independent schedule model. `lib/schedule-tools.ts` exposes optional WebMCP reading and batched creation/editing to supported browsers. Its contract has unit coverage; live WebMCP/browser interaction verification requires a connected compatible browser.
