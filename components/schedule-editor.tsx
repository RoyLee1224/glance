'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { CalendarDays, Check, Plus, Undo2, X, Copy, Trash2, MousePointer2, AlertCircle } from 'lucide-react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CATEGORIES, DAYS, DAY_CODES, START, END, STEP, SAMPLE_EVENTS, STORAGE_KEY, timeLabel, parseTime, hoursLabel, layoutDay, validateEvent, decodeSchedule, overlaps, clamp, snap, moveEvent, resizeEvent, type ScheduleEvent, type Category } from '@/lib/schedule';
import { registerScheduleTools } from '@/lib/schedule-tools';

const makeEvent = (day = 0, start = START, end = Math.min(start + 60, END)): ScheduleEvent => ({ id: crypto.randomUUID(), title: '', day, start, end, category: 'development' });
type Draft = { event: ScheduleEvent; isNew: boolean; revision: number };
type Gesture = { type: 'create' | 'move' | 'resize'; source: ScheduleEvent; initialX: number; initialY: number; initialMinute: number; moved: boolean; preview: ScheduleEvent; pointerId: number };

export function ScheduleEditor() {
  const [events, setEvents] = useState<ScheduleEvent[]>(SAMPLE_EVENTS);
  const eventsRef = useRef(events);
  const history = useRef<ScheduleEvent[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState('讀取行程中…');
  const [storageError, setStorageError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<ScheduleEvent | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const inspector = useRef<HTMLElement>(null);
  const revision = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        const restored = decodeSchedule(saved);
        eventsRef.current = restored;
        setEvents(restored);
      }
      setSaveState('已儲存在此裝置');
    } catch {
      setStorageError('無法讀取儲存的行程，暫時顯示範例。原資料尚未覆寫；下次修改將儲存目前的週表。');
      setSaveState('無法讀取儲存資料');
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: ScheduleEvent[]) => {
    eventsRef.current = next;
    setEvents(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, events: next }));
      setSaveState('已儲存在此裝置');
      setStorageError('');
    } catch {
      setSaveState('尚未儲存');
      setStorageError('瀏覽器無法儲存變更。目前行程仍保留在頁面中，請先不要關閉或重新整理。');
    }
  }, []);
  const commit = useCallback((next: ScheduleEvent[]) => {
    history.current = [...history.current.slice(-49), eventsRef.current];
    setCanUndo(true);
    persist(next);
  }, [persist]);
  const saveEvent = useCallback((event: ScheduleEvent) => {
    const error = validateEvent(event);
    if (error) throw new Error(error);
    const normalized: ScheduleEvent = { id: event.id, title: event.title.trim(), day: event.day, start: event.start, end: event.end, category: event.category };
    const current = eventsRef.current;
    commit(current.some(e => e.id === event.id) ? current.map(e => e.id === event.id ? normalized : e) : [...current, normalized]);
    return normalized;
  }, [commit]);
  useEffect(() => {
    if (!ready) return;
    return registerScheduleTools({ getEvents: () => eventsRef.current, replaceEvents: next => flushSync(() => { commit(next); setDraft(null); setSelectedId(null); }) });
  }, [ready, saveEvent, commit]);

  function openEditor(event: ScheduleEvent, isNew = false, focus = true) {
    setSelectedId(event.id);
    setDraft({ event: { ...event }, isNew, revision: ++revision.current });
    if (focus && window.matchMedia('(max-width: 850px)').matches) {
      requestAnimationFrame(() => inspector.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  }
  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    persist(previous);
    setCanUndo(history.current.length > 0);
    setDraft(null);
    setSelectedId(null);
  }
  function cancelGesture() {
    gesture.current = null;
    setDragPreview(null);
  }
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelGesture();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  function coordinates(clientX: number, clientY: number) {
    const rect = grid.current!.getBoundingClientRect();
    return { day: clamp(Math.floor((clientX - rect.left) / rect.width * 5), 0, 4), minute: clamp(snap(START + (clientY - rect.top) / rect.height * (END - START)), START, END), height: rect.height };
  }
  function beginGesture(event: PointerEvent, source?: ScheduleEvent, resize = false) {
    if (!ready || event.button !== 0 || !event.isPrimary || gesture.current) return;
    // Empty space stays scrollable on touch screens. Tap or the form creates events.
    if (!source && event.pointerType === 'touch') return;
    event.preventDefault();
    event.stopPropagation();
    const point = coordinates(event.clientX, event.clientY);
    const item = source ?? makeEvent(point.day, Math.min(point.minute, END - STEP));
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
    const delta = (event.clientY - active.initialY) / point.height * (END - START);
    if (active.type === 'move') active.preview = moveEvent(active.source, point.day, delta);
    else if (active.type === 'resize') active.preview = resizeEvent(active.source, delta);
    else {
      const start = Math.min(active.source.start, Math.min(point.minute, END - STEP));
      const end = Math.max(active.source.start + STEP, point.minute);
      active.preview = { ...active.source, start, end: Math.min(end, END) };
    }
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
  const totalMinutes = events.reduce((sum, e) => sum + e.end - e.start, 0);

  return <div className="app-shell">
    <header className="app-header">
      <a href="/" className="brand"><span className="brand-icon"><CalendarDays size={20} /></span><span>glance</span><span className="brand-divider" /><small className="brand-label">週行程編輯器</small></a>
      <span className={`save-state ${storageError ? 'has-error' : ''}`} role="status">{storageError ? <AlertCircle size={14} /> : <Check size={14} />}{saveState}</span>
    </header>
    <main className="workspace">
      <section className="page-heading"><div><p className="eyebrow">YOUR WEEK, AT A GLANCE</p><h1>每週行程</h1><p className="page-description">在空白時段拖曳，開始安排一週。</p></div><Button className="primary-button" disabled={!ready} onClick={() => openEditor(makeEvent(), true)}><Plus />新增行程</Button></section>
      {storageError && <div className="storage-warning" role="alert"><AlertCircle size={18}/>{storageError}</div>}
      <div className="editor-layout">
        <section className="schedule-card" aria-label="每週行程表">
          <div className="grid-toolbar"><span><strong>週一 — 週五</strong><span className="toolbar-divider">/</span>09:00–21:00</span><div className="grid-tools"><span>15 分鐘一格</span><Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo} title="復原上一步" aria-label="復原上一步"><Undo2 /></Button></div></div>
          <div className="grid-scroll" aria-label="週表，可左右捲動" tabIndex={0}>
            <div className="week-grid">
              <div className="day-headers"><div className="timezone-label">時間</div>{DAYS.map((day, i) => <div className="day-header" key={day}><span>{DAY_CODES[i]}</span><strong>{day}</strong></div>)}</div>
              <div className="grid-body">
                <div className="time-rail" aria-hidden="true">{Array.from({ length: 13 }, (_, i) => <span key={i} style={{ top: `${i / 12 * 100}%` }}>{timeLabel(START + i * 60)}</span>)}</div>
                <div className={`day-columns ${dragPreview ? 'is-dragging' : ''}`} ref={grid} onPointerMove={movePointer} onPointerUp={endPointer} onPointerCancel={cancelGesture} onLostPointerCapture={() => { if (gesture.current) cancelGesture(); }}>
                  {DAYS.map((day, i) => <div className="day-column" key={day} aria-label={day} onPointerDown={event => beginGesture(event)} onClick={event => {
                    if (suppressClick.current || event.target !== event.currentTarget || !ready) return;
                    const point = coordinates(event.clientX, event.clientY);
                    openEditor(makeEvent(point.day, Math.min(point.minute, END - STEP)), true);
                  }}>
                    {layoutDay(displayedEvents, i).map(item => {
                      const compact = item.end - item.start < 45;
                      const style: CSSProperties = { top: `${(item.start - START) / (END - START) * 100}%`, height: `calc(${(item.end - item.start) / (END - START) * 100}% - 3px)`, left: `calc(${item.lane / item.lanes * 100}% + 5px)`, width: `calc(${100 / item.lanes}% - 10px)` };
                      const label = `${day} ${timeLabel(item.start)}–${timeLabel(item.end)}，${item.title}，${CATEGORIES.find(c => c.id === item.category)?.label}`;
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
          <footer className="grid-footer"><span>{events.length} 個行程</span><span>共 <strong>{hoursLabel(totalMinutes)}</strong> 小時</span></footer>
        </section>
        <aside className="inspector" ref={inspector} aria-label="行程編輯">
          <div className="inspector-heading"><span className="section-label">{draft ? draft.isNew ? '新增行程' : '編輯行程' : '行程編輯'}</span>{draft ? <Button variant="ghost" size="icon-sm" aria-label="關閉行程編輯" onClick={() => { setDraft(null); setSelectedId(null); }}><X /></Button> : <MousePointer2 size={16} color="#8d94a4"/>}</div>
          {draft ? <EventForm key={draft.revision} event={draft.event} isNew={draft.isNew} events={events} onSave={event => { const saved = saveEvent(event); openEditor(saved, false, false); }} onCancel={() => { setDraft(null); setSelectedId(null); }} onDuplicate={event => openEditor({ ...event, id: crypto.randomUUID() }, true)} onDelete={() => { commit(events.filter(e => e.id !== draft.event.id)); setDraft(null); setSelectedId(null); }} /> : <div className="empty-inspector"><div className="empty-icon"><Plus size={26} /></div><h2>從一格開始</h2><p>點擊空白時段新增行程，<br/>或選取色塊來編輯。</p><Button variant="outline" className="secondary-button" disabled={!ready} onClick={() => openEditor(makeEvent(), true)}><Plus />新增行程</Button></div>}
          <div className="category-summary"><h3>本週分配</h3>{CATEGORIES.map(c => <div className="category-row" key={c.id}><span><i style={{ background: c.color }}/>{c.label}</span><span>{hoursLabel(events.filter(e => e.category === c.id).reduce((sum, e) => sum + e.end - e.start, 0))} h</span></div>)}</div>
          <p className="local-note">行程只儲存在目前瀏覽器。</p>
        </aside>
      </div>
      <p className="interaction-hint">拖曳空白格新增 · 拖動行程換時間 · 拉動底邊調整長度 · Esc 取消拖曳<span className="mobile-hint">手機可左右滑動週表，點選行程後在下方編輯。</span></p>
    </main>
  </div>;
}

function EventForm({ event, isNew, events, onSave, onCancel, onDuplicate, onDelete }: { event: ScheduleEvent; isNew: boolean; events: ScheduleEvent[]; onSave: (event: ScheduleEvent) => void; onCancel: () => void; onDuplicate: (event: ScheduleEvent) => void; onDelete: () => void }) {
  const [title, setTitle] = useState(event.title);
  const [day, setDay] = useState(event.day);
  const [start, setStart] = useState(timeLabel(event.start));
  const [end, setEnd] = useState(timeLabel(event.end));
  const [category, setCategory] = useState<Category>(event.category);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isNew) titleInput.current?.focus({ preventScroll: true }); }, [isNew]);
  const value = { ...event, title, day, start: parseTime(start), end: parseTime(end), category };
  const conflicts = events.filter(e => overlaps(value, e));
  const duration = value.end - value.start;
  return <form className="event-form" onSubmit={e => { e.preventDefault(); const message = validateEvent(value); if (message) { setError(message); return; } onSave(value); setSaved(true); setError(''); }} onChange={() => { setError(''); setSaved(false); }}>
    <label className="form-label" htmlFor="event-title">行程名稱</label>
    <Input className="form-input" id="event-title" ref={titleInput} maxLength={60} required value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：Airflow" aria-describedby={error ? 'form-error' : undefined}/>
    <label className="form-label" id="event-day-label">星期</label>
    <Select value={day} onValueChange={value => { if (value !== null) setDay(Number(value)); }}><SelectTrigger className="form-select" aria-labelledby="event-day-label"><SelectValue>{DAYS[day]}</SelectValue></SelectTrigger><SelectContent>{DAYS.map((name, index) => <SelectItem key={name} value={index}>{name}</SelectItem>)}</SelectContent></Select>
    <div className="time-inputs"><div><label className="form-label" htmlFor="event-start">開始</label><Input className="form-input" type="time" id="event-start" value={start} onChange={e => setStart(e.target.value)} min="09:00" max="20:45" step={900} required/></div><span>—</span><div><label className="form-label" htmlFor="event-end">結束</label><Input className="form-input" type="time" id="event-end" value={end} onChange={e => setEnd(e.target.value)} min="09:15" max="21:00" step={900} required/></div></div>
    <p className="duration-note">{Number.isFinite(duration) && duration > 0 ? `${hoursLabel(duration)} 小時` : '請設定有效的起訖時間'} · 15 分鐘為單位</p>
    <label className="form-label" id="category-label">分類</label>
    <RadioGroup className="category-options" value={category} onValueChange={value => setCategory(value as Category)} aria-labelledby="category-label">{CATEGORIES.map(c => <label key={c.id} className={`category-option ${category === c.id ? 'chosen' : ''}`}><RadioGroupItem value={c.id} style={{ '--primary': c.color } as CSSProperties}/><span>{c.label}</span><i style={{ background: c.color }}/></label>)}</RadioGroup>
    {conflicts.length > 0 && <p className="conflict-note"><AlertCircle size={14}/><span>與「{conflicts.map(e => e.title).join('、')}」重疊，儲存後會並排顯示。</span></p>}
    {error && <p className="form-error" role="alert" id="form-error">{error}</p>}
    {saved && <p className="form-success" role="status">行程已更新</p>}
    <div className="form-actions"><Button type="submit" className="primary-button">{isNew ? '加入週表' : '儲存變更'}</Button><Button type="button" variant="ghost" onClick={onCancel}>取消</Button></div>
    {!isNew && <div className="event-secondary-actions"><Button type="button" variant="ghost" onClick={() => { const issue = validateEvent(value); if (issue) { setError(issue); return; } onDuplicate(value); }}><Copy/>複製</Button><Button type="button" variant="ghost" className="delete-button" onClick={onDelete}><Trash2/>刪除</Button></div>}
  </form>;
}
