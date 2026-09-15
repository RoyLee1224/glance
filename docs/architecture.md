# Architecture

## Schedule model

Each event has a stable ID, title, weekday index (0–6), start/end minute offsets, and category. Times are independent of dates and time zones because this is a recurring weekly template. Keep this model independent of its editor and future wallpaper renderer.

## Editor

React, TypeScript, and Vite in the repository root, producing a static `dist/` directory. No SSR, Next.js server, Worker, or database. Render the week with HTML/CSS and direct pointer interactions. A form provides a precise, keyboard-accessible alternative to dragging. Render concurrent events in separate columns so overlapping appointments remain visible. Clamp pointer operations to the visible week and snap to 15 minutes. Deploy the static output to Cloudflare Pages or another static host.

Phone rendering uses an editor-only day filter; saved grid settings still drive exports and weekly totals. Draft events and pointer previews are composed into the displayed event list without mutating the project. A controlled event form preserves input across responsive layout changes, rendered in the desktop inspector or a phone bottom sheet. The sheet observes the visual viewport to keep its actions above the software keyboard.

## Persistence

The `glance` v4 project document contains events, user-defined categories, grid settings, grid layout and normalized wallpaper placement/glass settings. The display range never constrains stored event data: retain hidden events and clip intersecting ones for display only. Used categories require reassignment when removed. Use the same document for localStorage and downloadable JSON; project Undo covers settings and reassignments. Validate imports before replacement. Migrate v1–v3 with appropriate defaults, preserving legacy storage keys. Reject unsupported versions, invalid settings/events, or files over 1 MiB / 1,000 events. Persist committed operations only, not drag previews or unfinished form inputs. Import/export is browser-local; JSON is plaintext. Original photo Blobs live separately in IndexedDB (`glance.photos`), outside JSON and undo history.

## Image compositing

Plain PNG export is implemented in `lib/schedule-image.ts`. It derives a viewport-independent grid from the committed project using shared overlap, visibility, tick and category-color helpers. Canvas drawing preserves the existing white/pastel style and handles bounded text wrapping. Normally render at 2×; reduce scale for the largest grids to stay within 4,096 pixels per side and 8 million pixels. Wait for fonts, encode a PNG Blob locally, and release the canvas allocation. Geometry/text tests cover clipping, overlaps, custom range/layout, dense data and output bounds.

`WallpaperRenderer` in `lib/wallpaper-image.ts` is shared by the live canvas preview and original-resolution wallpaper PNG export. Draw the decoded original photo directly, then clip all glass effects to the rounded timetable panel. A cached low-resolution texture uses three separable box-blur passes; no CSS/backdrop-filter screenshot dependency exists. Add slight backdrop magnification, translucent tint, a highlight gradient and a rim, then render the shared schedule geometry and category-tinted text. Adapt foreground contrast from the photo/tint and mask grid lines behind translucent cards. Normalized panel bounds keep preview and export aligned. UI-only clock and placement guides are DOM layers, excluded from export.

Photo loading validates raster signatures, decode success and dimensions. Keep original Blobs local and release old object URLs/canvas buffers. Render up to 16 million original pixels with a longest side of 8,192; report browser allocation/encoding failures. Data-format, geometry, portable-blur and photo-signature tests cover the compositor's non-DOM logic.
