# Glance

## Product

A local-first weekly schedule editor that composes a timetable over an unchanged user photo and exports a lock-screen wallpaper. The schedule is an overlay; never regenerate the background with AI. The user manually connects the exported lock screen to an iOS Focus and toggles it with Shortcuts.

## Current scope: schedule grid

- Phone-first editor: default to one day with weekday navigation, with an optional whole-week overview. Desktop retains the full weekly grid and side inspector. Mobile view choices never alter saved weekdays or export scope.
- Users choose displayed weekdays from Monday–Sunday and start/end within 00:00–24:00, with 15-minute precision. Default: Monday–Friday, 09:00–21:00. Each displayed day shares the selected time range. Preserve hidden and clipped events and provide an edit/reveal path.
- Create, edit, move, resize, duplicate, and delete events. A new unsaved event immediately occupies a dashed, labeled grid card; valid form changes update it, cancel removes it, and only saving adds it to committed data and totals.
- Saving an event completes editing on all screen sizes: close the form, clear selection and show a brief confirmation. If browser persistence fails, report that changes are only in memory instead of showing a saved confirmation.
- Phone editing opens in a bottom sheet with scrollable fields and persistent save/cancel actions, resized above the on-screen keyboard. Do not open the keyboard automatically. Use native time selectors, large tap targets and a compact import/export menu.
- Undo with ⌘Z / Ctrl+Z, without a toolbar button. Editable text keeps native undo; project undo waits until dialogs and drag gestures are finished.
- Touch card bodies scroll naturally and open editing on tap. Move events with mouse dragging on the card body. Resize with the dedicated bottom-center grip, visible on hover or selection, with an enlarged hit area and a vertical-resize cursor.
- User-defined category names and colors, with add/remove and event reassignment. Initial colors: purple learning, blue work, orange meetings, gray personal plans, green leisure. Weekly allocation calculates hours from actual events.
- Event text follows its category hue, with opaque pastel backgrounds. Show hourly grid lines and subtle half-hour lines; do not draw quarter-hour lines or show grid lines through event cards. Keep 15-minute editing precision.
- Save on this device using localStorage; no accounts, backend, or calendar integration.
- Export/import JSON v4 containing events, categories, displayed weekdays/time range, grid layout and glass wallpaper settings. Support v1–v3 migration. Import validates before replacing and can be undone; the selected photo remains separate. No schedule uploads or app-owned database.
- Export a white-background PNG of the entire configured grid using committed data. Retain category colors, weekday/time labels, grid lines, clipping, and layout settings; exclude editing controls and selection/resize decorations. Export locally, normally at 2× with size limits for large layouts.
- First-time visitors see a fictional, generic example labeled as a sample. Never include user-provided schedules in public starter data. Updates to defaults must preserve existing locally saved projects.

## References

The supplied lock-screen screenshots are private local references outside this repository. They include system clocks and controls. Wallpaper export requires the user’s original photo.

## Wallpaper design

Select a clean original JPG/PNG/WebP photo; drag or nudge the schedule overlay; adjust its position/size and glass opacity, blur, tint and radius. Defaults match the reference: dark glass, category-colored text, top 32% reserved for the clock, width 94%, panel height 53%. The original photo is stored only in local IndexedDB. JSON stores glass/layout settings but excludes photo data.

Preview and PNG use the same canvas compositor, including blurred/refracted backdrop, tint and highlight rim. Export at the original decoded photo resolution. Clock/placement guides do not enter the exported image. Effects stay within the panel, and grid lines are masked behind event cards. Retain the white grid editor for arranging events.

Default wallpaper preview uses a representative iPhone frame with a fixed 393:852 screen ratio, rounded screen, Dynamic Island and optional lock-screen date, clock and bottom controls. Center-crop the composite to fill this screen without stretching; the full-image view shows the complete export and keeps off-screen areas editable. Device chrome and crop simulation are preview-only; preserve original-resolution PNG output and saved wallpaper coordinates.

## Later scope

Calendar integration and account synchronization remain outside scope.
