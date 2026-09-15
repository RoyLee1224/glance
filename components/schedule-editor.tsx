'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { CalendarDays, Check, Plus, X, Copy, Trash2, MousePointer2, AlertCircle, Download, Upload, Settings2, ImageDown } from 'lucide-react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { DAYS, DAY_CODES, STEP, STORAGE_KEY, timeLabel, hoursLabel, layoutDay, validateEvent, overlaps, clamp, snap, moveEvent, resizeEvent, visiblePart, isFullyVisible, gridTicks, type ScheduleEvent, type Category, type GridSettings, type ScheduleCategory } from '@/lib/schedule';
import { createProject, decodeProject, encodeProject, PROJECT_STORAGE_KEY, LEGACY_PROJECT_STORAGE_KEY, OLDER_PROJECT_STORAGE_KEY, MAX_PROJECT_BYTES, applyProjectSettings, expandGridToEvents, type ProjectDocument, type GridLayout } from '@/lib/project';
import { registerScheduleTools } from '@/lib/schedule-tools';
import { ProjectSettings } from '@/components/project-settings';
import { TimeSelect } from '@/components/time-select';
import { eventColors } from '@/lib/event-colors';
import { createSchedulePng } from '@/lib/schedule-image';
import { WallpaperEditor } from '@/components/wallpaper-editor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

function loadInitialSchedule() {
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PROJECT_STORAGE_KEY) ?? localStorage.getItem(OLDER_PROJECT_STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY);
    return { project: raw === null ? createProject() : decodeProject(raw), error: '' };
  } catch {
    return { project: createProject(), error: '無法讀取儲存的行程，暫時顯示範例。原資料尚未覆寫；下次修改將儲存目前的週表。' };
  }
}
type Draft = { event: ScheduleEvent; isNew: boolean; revision: number };
type Gesture = { type: 'create' | 'move' | 'resize'; source: ScheduleEvent; initialX: number; initialY: number; initialMinute: number; moved: boolean; preview: ScheduleEvent; pointerId: number };

export function ScheduleEditor() {
  const [initial] = useState(loadInitialSchedule);
  const [view, setView] = useState('grid');
  const [project, setProject] = useState<ProjectDocument>(initial.project);
  const events = project.events;
  const categories = project.categories;
  const scheduleGrid = project.grid;
  const rangeStart = scheduleGrid.start, rangeEnd = scheduleGrid.end;
  function makeEvent(day = scheduleGrid.days[0], start = rangeStart, end = Math.min(start + 60, rangeEnd)): ScheduleEvent {
    return { id: crypto.randomUUID(), title: '', day, start, end, category: categories[0].id };
  }
  const projectRef = useRef(project);
  const history = useRef<ProjectDocument[]>([]);
  const ready = true;
  const [saveState, setSaveState] = useState(initial.error ? '無法讀取儲存資料' : '已儲存在此裝置');
  const [storageError, setStorageError] = useState(initial.error);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<ScheduleEvent | null>(null);
  const [dragType, setDragType] = useState<Gesture['type'] | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const revision = useRef(0);
  const suppressClick = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exportingImage, setExportingImage] = useState(false);
  const [pendingImport, setPendingImport] = useState<{ project: ProjectDocument; filename: string } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileMessage, setFileMessage] = useState<{ text: string; error: boolean } | null>(null);

  const persist = useCallback((next: ProjectDocument) => {
    projectRef.current = next;
    setProject(next);
    try {
      localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(next));
      setSaveState('已儲存在此裝置');
      setStorageError('');
    } catch {
      setSaveState('尚未儲存');
      setStorageError('瀏覽器無法儲存變更。請先匯出 JSON 備份，再關閉或重新整理頁面。');
    }
  }, []);
  const commitProject = useCallback((next: ProjectDocument) => {
    history.current = [...history.current.slice(-49), projectRef.current];
    persist(next);
  }, [persist]);
  const commit = useCallback((next: ScheduleEvent[]) => commitProject({ ...projectRef.current, events: next }), [commitProject]);
  const saveEvent = useCallback((event: ScheduleEvent) => {
    const error = validateEvent(event, projectRef.current.categories);
    if (error) throw new Error(error);
    const normalized: ScheduleEvent = { id: event.id, title: event.title.trim(), day: event.day, start: event.start, end: event.end, category: event.category };
    const current = projectRef.current.events;
    commit(current.some(e => e.id === event.id) ? current.map(e => e.id === event.id ? normalized : e) : [...current, normalized]);
    return normalized;
  }, [commit]);
  useEffect(() => {
    if (!ready) return;
    return registerScheduleTools({ getEvents: () => projectRef.current.events, getCategories: () => projectRef.current.categories, getGrid: () => projectRef.current.grid, replaceEvents: next => flushSync(() => { commit(next); setDraft(null); setSelectedId(null); }) });
  }, [ready, saveEvent, commit]);

  function openEditor(event: ScheduleEvent, isNew = false, focus = true) {
    setSelectedId(event.id);
    setDraft({ event: { ...event }, isNew, revision: ++revision.current });
    if (focus && window.matchMedia('(max-width: 850px)').matches) {
      requestAnimationFrame(() => inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }
  function exportProject() {
    try {
      const json = encodeProject(projectRef.current);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `glance-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setFileMessage({ text: '已準備下載週表、排版與玻璃設定。底圖需另外保留；不含尚未儲存的表單編輯。', error: false });
    } catch (error) { setFileMessage({ text: error instanceof Error ? error.message : '無法匯出 JSON。', error: true }); }
  }
  async function exportImage() {
    if (exportingImage) return;
    setExportingImage(true);
    setFileMessage(null);
    try {
      const { blob, width, height } = await createSchedulePng(projectRef.current);
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `glance-weekly-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setFileMessage({ text: `已準備下載 ${width} × ${height} PNG。圖片包含目前顯示範圍內已儲存的行程。`, error: false });
    } catch (error) {
      setFileMessage({ text: error instanceof Error ? error.message : '無法匯出圖片，請稍後再試。', error: true });
    } finally {
      setExportingImage(false);
    }
  }
  async function importProject(file: File) {
    setImporting(true);
    setFileMessage(null);
    try {
      if (file.size > MAX_PROJECT_BYTES) throw new Error('JSON 檔請小於 1 MB。');
      const imported = decodeProject(await file.text());
      setPendingImport({ project: imported, filename: file.name });
    } catch (error) { setFileMessage({ text: error instanceof Error ? error.message : '無法讀取這個專案檔。', error: true }); }
    finally { setImporting(false); }
  }
  function cancelGesture() {
    gesture.current = null;
    setDragPreview(null);
    setDragType(null);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelGesture();
      if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      if (settingsOpen || pendingImport || gesture.current) return;
      // Leave text undo to the focused editor, including contenteditable fields.
      const editingText = event.composedPath().some(target => target instanceof HTMLElement &&
        (target.isContentEditable || target.matches('input, textarea, [role="textbox"]')));
      if (editingText) return;
      const previous = history.current.pop();
      if (!previous) return;
      event.preventDefault();
      persist(previous);
      setDraft(null);
      setSelectedId(null);
      setFileMessage(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [settingsOpen, pendingImport, persist]);

  function coordinates(clientX: number, clientY: number) {
    const rect = grid.current!.getBoundingClientRect();
    return { day: scheduleGrid.days[clamp(Math.floor((clientX - rect.left) / rect.width * scheduleGrid.days.length), 0, scheduleGrid.days.length - 1)], minute: clamp(snap(rangeStart + (clientY - rect.top) / rect.height * (rangeEnd - rangeStart)), rangeStart, rangeEnd), height: rect.height };
  }
  function beginGesture(event: PointerEvent, source?: ScheduleEvent, resize = false) {
    if (!ready || event.button !== 0 || !event.isPrimary || gesture.current) return;
    // Empty space stays scrollable on touch screens. Tap or the form creates events.
    if (!source && event.pointerType === 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    const point = coordinates(event.clientX, event.clientY);
    const item = source ?? makeEvent(point.day, Math.min(point.minute, rangeEnd - STEP));
    gesture.current = { type: source ? resize ? 'resize' : 'move' : 'create', source: item, initialX: event.clientX, initialY: event.clientY, initialMinute: point.minute, moved: false, preview: item, pointerId: event.pointerId };
    grid.current!.setPointerCapture(event.pointerId);
    if (source) setSelectedId(source.id);
  }
  function movePointer(event: PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.initialX, event.clientY - active.initialY) < 5) return;
    active.moved = true;
    const point = coordinates(event.clientX, event.clientY);
    const delta = (event.clientY - active.initialY) / point.height * (rangeEnd - rangeStart);
    if (active.type === 'move') active.preview = moveEvent(active.source, point.day, delta, scheduleGrid);
    else if (active.type === 'resize') active.preview = resizeEvent(active.source, delta, scheduleGrid);
    else {
      const start = Math.min(active.source.start, Math.min(point.minute, rangeEnd - STEP));
      const end = Math.max(active.source.start + STEP, point.minute);
      active.preview = { ...active.source, start, end: Math.min(end, rangeEnd) };
    }
    setDragType(active.type);
    setDragPreview(active.preview);
  }
  function endPointer(event: PointerEvent) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    suppressClick.current = true;
    // Suppress only the synthetic click following this pointer sequence.
    setTimeout(() => { suppressClick.current = false; }, 0);
    if (grid.current?.hasPointerCapture(event.pointerId)) grid.current.releasePointerCapture(event.pointerId);
    cancelGesture();
    if (active.type === 'create') openEditor(active.preview, true);
    else if (active.moved) {
      const saved = saveEvent(active.preview);
      openEditor(saved, false, false);
    } else openEditor(active.source);
  }
  const displayedEvents = dragPreview ? [...events.filter(e => e.id !== dragPreview.id), { ...dragPreview, title: dragPreview.title || '新增行程' }] : events;
  const visibleEvents = displayedEvents.filter(event => visiblePart(event, scheduleGrid));
  const outsideEvents = events.filter(event => !isFullyVisible(event, scheduleGrid));
  const gridHeight = Math.max(72, (rangeEnd - rangeStart) / 60 * project.layout.hourHeight);
  const totalMinutes = events.reduce((sum, e) => sum + e.end - e.start, 0);

  return <div className="app-shell" style={{ '--hour-height': `${project.layout.hourHeight}px`, '--day-width': `${project.layout.dayWidth}px`, '--event-font-size': `${project.layout.fontSize}px`, '--day-count': scheduleGrid.days.length, '--grid-height': `${gridHeight}px` } as CSSProperties}>
    <header className="app-header">
      <a href={import.meta.env.BASE_URL} className="brand"><span className="brand-icon"><CalendarDays size={20} /></span><span>glance</span><span className="brand-divider" /><small className="brand-label">週行程編輯器</small></a>
      <output className={`save-state ${storageError ? 'has-error' : ''}`}>{storageError ? <AlertCircle size={14} /> : <Check size={14} />}{saveState}</output>
    </header>
    <main className="workspace">
      <section className="page-heading"><div><p className="eyebrow">YOUR WEEK, AT A GLANCE</p><h1>{view === 'grid' ? '每週行程' : '桌布設計'}</h1><p className="page-description">{view === 'grid' ? '在空白時段拖曳，開始安排一週。' : '把這週的安排，疊在你喜歡的照片上。'}</p></div><div className="project-actions"><input type="file" accept=".json,application/json" ref={fileInput} hidden aria-label="選擇 Glance JSON 專案" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void importProject(file); }}/><Button variant="outline" className="secondary-button" disabled={importing} onClick={() => fileInput.current?.click()}><Upload />{importing ? '讀取中…' : '匯入 JSON'}</Button><Button variant="outline" className="secondary-button" onClick={exportProject}><Download />匯出 JSON</Button>{view === 'grid' && <><Button variant="outline" className="secondary-button" disabled={exportingImage} onClick={() => void exportImage()} title="匯出目前顯示範圍的白底週表（PNG）"><ImageDown />{exportingImage ? '匯出中…' : '匯出白底週表'}</Button><Button className="primary-button" disabled={!ready} onClick={() => openEditor(makeEvent(), true)}><Plus />新增行程</Button></>}</div></section>
      {storageError && <div className="storage-warning" role="alert"><AlertCircle size={18}/>{storageError}</div>}
      {fileMessage && (fileMessage.error ? <div className="storage-warning" role="alert">{fileMessage.text}</div> : <output className="file-status">{fileMessage.text}</output>)}
      <Tabs value={view} onValueChange={value => { setView(value === 'wallpaper' ? 'wallpaper' : 'grid'); cancelGesture(); }} className="editor-tabs">
      <TabsList aria-label="編輯模式"><TabsTrigger value="grid">編輯週表</TabsTrigger><TabsTrigger value="wallpaper">桌布設計</TabsTrigger></TabsList>
      <TabsContent value="grid" keepMounted>
      <div className="editor-layout">
        <section className="schedule-card" aria-label="每週行程表">
          <div className="grid-toolbar"><span><strong>{scheduleGrid.days.map(day => DAYS[day]).join('、')}</strong><span className="toolbar-divider">/</span>{timeLabel(rangeStart)}–{timeLabel(rangeEnd)}</span><div className="grid-tools"><Button variant="ghost" onClick={() => setSettingsOpen(true)}><Settings2/>週表設定</Button><span className="grid-step-label">15 分鐘一格</span></div></div>
          <div className="grid-scroll">
            <div className="week-grid">
              <div className="day-headers"><div className="timezone-label">時間</div>{scheduleGrid.days.map(i => <div className="day-header" key={i}><span>{DAY_CODES[i]}</span><strong>{DAYS[i]}</strong></div>)}</div>
              <div className="grid-body">
                <div className="time-rail" aria-hidden="true">{gridTicks(scheduleGrid).map(time => <span key={time} style={{ top: `${(time - rangeStart) / (rangeEnd - rangeStart) * 100}%` }}>{timeLabel(time)}</span>)}</div>
                <div className={`day-columns ${dragPreview ? dragType === 'resize' ? 'is-resizing' : 'is-dragging' : ''}`} ref={grid} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current) cancelGesture(); }}>
                  <div className="grid-lines" aria-hidden="true">{Array.from({ length: (rangeEnd - rangeStart) / STEP + 1 }, (_, index) => rangeStart + index * STEP).filter(time => time % 30 === 0 && time > rangeStart && time < rangeEnd).map(time => <i className={time % 60 === 0 ? 'hour-line' : ''} key={time} style={{ top: `${(time - rangeStart) / (rangeEnd - rangeStart) * 100}%` }}/>)}</div>
                  {scheduleGrid.days.map(i => <div className="day-column" key={i}>
                    <button className="empty-day" aria-label={`在${DAYS[i]}新增行程`} onPointerDown={event => beginGesture(event)} onClick={event => {
                    if (suppressClick.current || !ready) return;
                    if (event.detail === 0) { openEditor(makeEvent(i), true); return; }
                    const point = coordinates(event.clientX, event.clientY);
                    openEditor(makeEvent(point.day, Math.min(point.minute, rangeEnd - STEP)), true);
                  }} />
                    {layoutDay(visibleEvents, i).map(item => {
                      const part = visiblePart(item, scheduleGrid)!;
                      const colors = eventColors(categories.find(c => c.id === item.category)!.color);
                      const compact = (part.end - part.start) / (rangeEnd - rangeStart) * gridHeight < project.layout.fontSize * 1.35 + 34;
                      const style: CSSProperties = { top: `${(part.start - rangeStart) / (rangeEnd - rangeStart) * 100}%`, height: `calc(${(part.end - part.start) / (rangeEnd - rangeStart) * 100}% - 3px)`, left: `calc(${item.lane / item.lanes * 100}% + 5px)`, width: `calc(${100 / item.lanes}% - 10px)`, '--event-accent': colors.accent, '--event-bg': colors.background, '--event-border': colors.border, '--event-text': colors.text } as CSSProperties;
                      const label = `${DAYS[i]} ${timeLabel(item.start)}–${timeLabel(item.end)}，${item.title}，${categories.find(c => c.id === item.category)?.label}`;
                      return <div key={item.id} className={`event-block category-${item.category} ${selectedId === item.id ? 'is-selected' : ''} ${dragPreview?.id === item.id ? 'is-preview' : ''} ${compact ? 'is-compact' : ''}`} style={style}>
                        <button className="event-content" aria-label={`編輯 ${label}`} title={label} disabled={!ready} onPointerDown={event => beginGesture(event, item)} onClick={event => { event.stopPropagation(); if (!suppressClick.current) openEditor(item); }}><strong>{item.title}</strong>{!compact && <span>{timeLabel(item.start)}–{timeLabel(item.end)}</span>}</button>
                        <div className="resize-handle" title="拖曳以調整結束時間" aria-hidden="true" onPointerDown={event => beginGesture(event, item, true)}><i /></div>
                      </div>;
                    })}
                  </div>)}
                </div>
              </div>
            </div>
          </div>
          <footer className="grid-footer"><span>全部 {events.length} 個行程</span><span>共 <strong>{hoursLabel(totalMinutes)}</strong> 小時</span></footer>
          {outsideEvents.length > 0 && <section className="outside-events" aria-label="範圍外的行程"><div><p>{outsideEvents.length} 個行程超出顯示範圍，內容與統計仍保留。</p><Button variant="outline" onClick={() => commitProject(expandGridToEvents(projectRef.current))}>顯示全部</Button></div><div className="outside-event-list">{outsideEvents.map(event => <Button key={event.id} variant="ghost" onClick={() => openEditor(event)}>{DAYS[event.day]} {timeLabel(event.start)}–{timeLabel(event.end)} · {event.title}</Button>)}</div></section>}
        </section>
        <aside className="inspector" ref={inspector} aria-label="行程編輯">
          <div className="inspector-heading"><span className="section-label">{draft ? draft.isNew ? '新增行程' : '編輯行程' : '行程編輯'}</span>{draft ? <Button variant="ghost" size="icon-sm" aria-label="關閉行程編輯" onClick={() => { setDraft(null); setSelectedId(null); }}><X /></Button> : <MousePointer2 size={16} color="#8d94a4"/>}</div>
          {draft ? <EventForm key={draft.revision} categories={categories} scheduleGrid={scheduleGrid} event={draft.event} isNew={draft.isNew} events={events} onSave={event => { const saved = saveEvent(event); openEditor(saved, false, false); }} onCancel={() => { setDraft(null); setSelectedId(null); }} onDuplicate={event => openEditor({ ...event, id: crypto.randomUUID() }, true)} onDelete={() => { commit(events.filter(e => e.id !== draft.event.id)); setDraft(null); setSelectedId(null); }} /> : <div className="empty-inspector"><div className="empty-icon"><Plus size={26} /></div><h2>從一格開始</h2><p>點擊空白時段新增行程，<br/>或選取色塊來編輯。</p><Button variant="outline" className="secondary-button" disabled={!ready} onClick={() => openEditor(makeEvent(), true)}><Plus />新增行程</Button></div>}
          <div className="category-summary"><div className="summary-heading"><h3>本週分配</h3><Button variant="ghost" onClick={() => setSettingsOpen(true)}>編輯分類</Button></div>{categories.map(c => <div className="category-row" key={c.id}><span><i style={{ background: c.color }}/>{c.label}</span><span>{hoursLabel(events.filter(e => e.category === c.id).reduce((sum, e) => sum + e.end - e.start, 0))} h</span></div>)}</div>
          <LayoutSettings layout={project.layout} onChange={layout => commitProject({ ...projectRef.current, layout })}/>
          <p className="local-note">行程與排版存在此瀏覽器。匯出 JSON 可備份或移到其他裝置。</p>
        </aside>
      </div>
      <p className="interaction-hint">拖曳空白格新增 · 拖動行程換時間 · 拖動底部把手調整長度 · Esc 取消拖曳 · ⌘Z / Ctrl+Z 復原<span className="mobile-hint">手機可左右滑動週表，點選行程後在下方編輯。</span></p>
      </TabsContent>
      <TabsContent value="wallpaper" keepMounted><WallpaperEditor project={project} onChange={wallpaper => commitProject({ ...projectRef.current, wallpaper })}/></TabsContent>
      </Tabs>
    </main>
    {settingsOpen && <ProjectSettings project={project} onClose={() => setSettingsOpen(false)} onApply={(nextCategories, nextGrid, reassignments) => {
      const next = applyProjectSettings(projectRef.current, nextCategories, nextGrid, reassignments);
      commitProject(next);
      setDraft(previous => previous ? { ...previous, event: { ...previous.event, category: next.categories.some(c => c.id === previous.event.category) ? previous.event.category : reassignments[previous.event.category] || next.categories[0].id } } : null);
      setSettingsOpen(false);
      cancelGesture();
    }}/>}
    <AlertDialog open={pendingImport !== null} onOpenChange={open => { if (!open) setPendingImport(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>匯入專案？</AlertDialogTitle><AlertDialogDescription>「{pendingImport?.filename}」包含 {pendingImport?.project.events.length ?? 0} 個行程及排版設定。底圖保留目前選擇的照片。匯入會取代目前週表與尚未儲存的編輯；目前已儲存的週表可用 ⌘Z／Ctrl+Z 恢復。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={() => { if (!pendingImport) return; commitProject(pendingImport.project); setPendingImport(null); setDraft(null); setSelectedId(null); cancelGesture(); setFileMessage({ text: '已匯入週表與排版設定。', error: false }); }}>匯入並取代</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function LayoutSettings({ layout, onChange }: { layout: GridLayout; onChange: (layout: GridLayout) => void }) {
  const settings = [
    { key: 'hourHeight', label: '每小時高度', values: [48, 60, 72, 96, 120, 144] },
    { key: 'dayWidth', label: '最小欄寬', values: [100, 116, 140, 180, 240] },
    { key: 'fontSize', label: '行程字級', values: [12, 14, 16, 18, 20] },
  ] as const;
  return <section className="layout-settings" aria-labelledby="layout-heading"><h3 id="layout-heading">排版設定</h3>{settings.map(({ key, label, values }) => <div className="layout-setting" key={key}><span id={`layout-${key}`}>{label}</span><Select value={layout[key]} onValueChange={value => { if (typeof value === 'number') onChange({ ...layout, [key]: value }); }}><SelectTrigger aria-labelledby={`layout-${key}`}><SelectValue>{layout[key]} px</SelectValue></SelectTrigger><SelectContent>{[...new Set<number>([...values, layout[key]])].sort((a, b) => a - b).map(value => <SelectItem key={value} value={value}>{value} px</SelectItem>)}</SelectContent></Select></div>)}</section>;
}

function EventForm({ event, isNew, events, categories, scheduleGrid, onSave, onCancel, onDuplicate, onDelete }: { event: ScheduleEvent; isNew: boolean; events: ScheduleEvent[]; categories: ScheduleCategory[]; scheduleGrid: GridSettings; onSave: (event: ScheduleEvent) => void; onCancel: () => void; onDuplicate: (event: ScheduleEvent) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [day, setDay] = useState(event.day);
  const [start, setStart] = useState(event.start);
  const [end, setEnd] = useState(event.end);
  const [category, setCategory] = useState<Category>(event.category);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isNew) titleInput.current?.focus({ preventScroll: true }); }, [isNew]);
  const effectiveCategory = categories.some(c => c.id === category) ? category : event.category;
  const value = { ...event, title, day, start, end, category: effectiveCategory };
  const conflicts = events.filter(e => overlaps(value, e));
  const duration = value.end - value.start;
  return <form className="event-form" onSubmit={e => { e.preventDefault(); const message = validateEvent(value, categories); if (message) { setError(message); return; } onSave(value); setSaved(true); setError(''); }} onChange={() => { setError(''); setSaved(false); }}>
    <label className="form-label" htmlFor="event-title">行程名稱</label>
    <Input className="form-input" id="event-title" ref={titleInput} maxLength={60} required value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：Airflow" aria-describedby={error ? 'form-error' : undefined}/>
    <span className="form-label" id="event-day-label">星期</span>
    <Select value={day} onValueChange={value => { if (value !== null) setDay(Number(value)); }}><SelectTrigger className="form-select" aria-labelledby="event-day-label"><SelectValue>{DAYS[day]}</SelectValue></SelectTrigger><SelectContent>{DAYS.map((name, index) => <SelectItem key={name} value={index}>{name}</SelectItem>)}</SelectContent></Select>
    <div className="time-inputs"><div><span className="form-label" id="event-start-label">開始</span><TimeSelect labelId="event-start-label" value={start} onChange={setStart}/></div><span>—</span><div><span className="form-label" id="event-end-label">結束</span><TimeSelect labelId="event-end-label" value={end} onChange={setEnd} end/></div></div>
    <p className="duration-note">{Number.isFinite(duration) && duration > 0 ? `${hoursLabel(duration)} 小時` : '請設定有效的起訖時間'} · 15 分鐘為單位</p>
    <span className="form-label" id="category-label">分類</span>
    <RadioGroup className="category-options" value={effectiveCategory} onValueChange={value => setCategory(value as Category)} aria-labelledby="category-label">{categories.map(c => <label key={c.id} className={`category-option ${effectiveCategory === c.id ? 'chosen' : ''}`}><RadioGroupItem value={c.id} style={{ '--primary': c.color } as CSSProperties}/><span>{c.label}</span><i style={{ background: c.color }}/></label>)}</RadioGroup>
    {!isFullyVisible(value, scheduleGrid) && <p className="settings-note">這個行程超出目前顯示範圍，儲存後仍會保留。</p>}
    {conflicts.length > 0 && <p className="conflict-note"><AlertCircle size={14}/><span>與「{conflicts.map(e => e.title).join('、')}」重疊，儲存後會並排顯示。</span></p>}
    {error && <p className="form-error" role="alert" id="form-error">{error}</p>}
    {saved && <output className="form-success">行程已更新</output>}
    <div className="form-actions"><Button type="submit" className="primary-button">{isNew ? '加入週表' : '儲存變更'}</Button><Button type="button" variant="ghost" onClick={onCancel}>取消</Button></div>
    {!isNew && <div className="event-secondary-actions"><Button type="button" variant="ghost" onClick={() => { const issue = validateEvent(value, categories); if (issue) { setError(issue); return; } onDuplicate(value); }}><Copy/>複製</Button><Button type="button" variant="ghost" className="delete-button" onClick={onDelete}><Trash2/>刪除</Button></div>}
  </form>;
}
