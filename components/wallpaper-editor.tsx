'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ImagePlus, Download, RefreshCw, Trash2, Move, Sparkles, Smartphone, Image, LockKeyhole, Signal, Wifi, BatteryFull, Flashlight, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WallpaperRenderer } from '@/lib/wallpaper-image';
import { loadPhoto, readSavedPhoto, savePhoto, type LoadedPhoto } from '@/lib/wallpaper-photo';
import { DEFAULT_WALLPAPER, positionWallpaper, type WallpaperSettings } from '@/lib/wallpaper-settings';
import { IPHONE_SCREEN, phonePhotoBounds } from '@/lib/wallpaper-preview';
import type { ProjectDocument } from '@/lib/project';

type Drag = { pointerId: number; clientX: number; clientY: number; width: number; height: number; start: WallpaperSettings; next: WallpaperSettings; moved: boolean };

function LockScreenOverlay() {
  const [date] = useState(() => new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()));
  return <div className="wallpaper-lock-screen" aria-hidden="true">
    <div className="wallpaper-status-bar"><LockKeyhole/><span><Signal/><Wifi/><BatteryFull/></span></div>
    <div className="wallpaper-lock-clock"><span>{date}</span><strong>9:41</strong></div>
    <div className="wallpaper-lock-controls"><span><Flashlight/></span><span><Camera/></span></div>
    <div className="wallpaper-home-indicator"/>
  </div>;
}

export function WallpaperEditor({ project, onChange }: { project: ProjectDocument; onChange: (settings: WallpaperSettings) => void }) {
  const [photo, setPhoto] = useState<LoadedPhoto | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [editing, setEditing] = useState<WallpaperSettings | null>(null);
  const [clockGuide, setClockGuide] = useState(true);
  const [previewMode, setPreviewMode] = useState('iphone');
  const [dragging, setDragging] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const renderer = useRef<WallpaperRenderer | null>(null);
  const drag = useRef<Drag | null>(null);
  const settings = editing ?? project.wallpaper;
  const isPhone = previewMode === 'iphone';
  const photoRatio = photo ? photo.image.naturalWidth / photo.image.naturalHeight : IPHONE_SCREEN.width / IPHONE_SCREEN.height;
  const photoBounds = photo && isPhone ? phonePhotoBounds(photo.image.naturalWidth, photo.image.naturalHeight) : { width: 100, height: 100 };

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        const saved = await readSavedPhoto();
        if (saved) {
          const loaded = await loadPhoto(saved);
          if (cancelled) URL.revokeObjectURL(loaded.url);
          else setPhoto(loaded);
        }
      } catch {
        if (!cancelled) setMessage({ text: '無法讀取本機底圖，可重新選擇照片繼續。', error: true });
      } finally { if (!cancelled) setLoading(false); }
    }
    void restore();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!photo) return;
    let instance: WallpaperRenderer | null = null;
    try {
      instance = new WallpaperRenderer(photo.image);
      renderer.current = instance;
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : '無法建立預覽。', error: true }); }
    return () => { instance?.dispose(); renderer.current = null; URL.revokeObjectURL(photo.url); };
  }, [photo]);

  useEffect(() => {
    if (!photo) return;
    const frame = requestAnimationFrame(() => {
      if (!canvas.current || !renderer.current) return;
      try {
        const width = Math.min(800, photo.image.naturalWidth);
        canvas.current.width = width;
        canvas.current.height = Math.round(width * photo.image.naturalHeight / photo.image.naturalWidth);
        renderer.current.render(canvas.current, { ...project, wallpaper: settings });
      } catch (error) { setMessage({ text: error instanceof Error ? error.message : '無法更新預覽。', error: true }); }
    });
    return () => cancelAnimationFrame(frame);
  }, [photo, project, settings]);

  useEffect(() => { setEditing(null); }, [project.wallpaper]);

  async function choose(file: File) {
    setLoading(true);
    setMessage(null);
    try {
      const loaded = await loadPhoto({ blob: file, name: file.name });
      setPhoto(loaded);
      try { await savePhoto(loaded); }
      catch { setMessage({ text: '照片可正常預覽與匯出，但無法保存在此瀏覽器；下次開啟需重新選擇。', error: true }); }
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : '無法讀取照片。', error: true }); }
    finally { setLoading(false); }
  }

  async function removePhoto() {
    setLoading(true);
    try { await savePhoto(null); setPhoto(null); setMessage(null); }
    catch { setMessage({ text: '無法移除本機照片，請稍後再試。', error: true }); }
    finally { setLoading(false); }
  }

  async function exportWallpaper() {
    if (!renderer.current || exporting) return;
    setExporting(true);
    setMessage(null);
    try {
      if (editing) { onChange(settings); setEditing(null); }
      const { blob, width, height } = await renderer.current.png({ ...project, wallpaper: settings });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = `glance-wallpaper-${new Date().toISOString().slice(0, 10)}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
      } finally { setTimeout(() => URL.revokeObjectURL(url), 60_000); }
      setMessage({ text: `已準備下載 ${width} × ${height} 桌布。可設定成專注模式對應的鎖定畫面。`, error: false });
    } catch (error) { setMessage({ text: error instanceof Error ? error.message : '桌布匯出失敗，請稍後再試。', error: true }); }
    finally { setExporting(false); }
  }

  function cancelDrag() { drag.current = null; setDragging(false); setEditing(null); }
  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !event.isPrimary || !canvas.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const rect = canvas.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, width: rect.width, height: rect.height, start: settings, next: settings, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (!active.moved && Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) < 3) return;
    active.moved = true;
    active.next = positionWallpaper(active.start, { x: active.start.x + (event.clientX - active.clientX) / active.width, y: active.start.y + (event.clientY - active.clientY) / active.height });
    setEditing(active.next);
  }
  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    if (active.moved) onChange(active.next);
    setDragging(false);
    setEditing(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  const placement = [
    { key: 'width', label: '寬度', min: 35, max: 100 },
    { key: 'height', label: '高度', min: 20, max: 90 },
    { key: 'x', label: '左右位置', min: 0, max: Math.round((1 - settings.width) * 100) },
    { key: 'y', label: '上下位置', min: 0, max: Math.round((1 - settings.height) * 100) },
  ] as const;
  const glass = [
    { key: 'opacity', label: '玻璃濃度', min: 5, max: 90, factor: 100, unit: '%' },
    { key: 'blur', label: '背景模糊', min: 0, max: 30, factor: 1, unit: '' },
    { key: 'radius', label: '圓角', min: 0, max: 40, factor: 1, unit: '' },
  ] as const;
  const slider = (key: Exclude<keyof WallpaperSettings, 'tint'>, label: string, min: number, max: number, factor: number, unit: string) => <div className="wallpaper-slider" key={key}>
    <div><span id={`wallpaper-${key}`}>{label}</span><output>{Math.round(settings[key] * factor)}{unit}</output></div>
    <Slider aria-labelledby={`wallpaper-${key}`} value={[settings[key] * factor]} min={min} max={Math.max(min + 1, max)} disabled={max <= min} step={1}
      onValueChange={value => setEditing(positionWallpaper(settings, { [key]: (Array.isArray(value) ? value[0] : value) / factor }))}
      onValueCommitted={value => { onChange(positionWallpaper(settings, { [key]: (Array.isArray(value) ? value[0] : value) / factor })); setEditing(null); }}/>
  </div>;

  return <section className="wallpaper-editor" aria-label="Liquid Glass 桌布設計" onKeyDown={event => {
    if (event.key === 'Escape' && (editing || drag.current)) { event.preventDefault(); cancelDrag(); }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && (editing || drag.current)) { event.preventDefault(); cancelDrag(); }
  }}>
    <div className="wallpaper-preview-column">
      <div className="wallpaper-preview-heading"><span><Smartphone size={16}/>桌布預覽</span>{photo && <span>{photo.image.naturalWidth} × {photo.image.naturalHeight}</span>}</div>
      <ToggleGroup className="wallpaper-preview-modes" aria-label="預覽方式" value={[previewMode]} onValueChange={value => { if (value.length) { cancelDrag(); setPreviewMode(value[0]); } }}>
        <ToggleGroupItem value="iphone"><Smartphone/>iPhone</ToggleGroupItem>
        <ToggleGroupItem value="image"><Image/>完整圖片</ToggleGroupItem>
      </ToggleGroup>
      <div className={`wallpaper-device ${isPhone ? 'is-iphone' : 'is-image'}`} style={isPhone ? undefined : { width: `min(100%, 440px, ${74 * photoRatio}vh)` }}>
        {isPhone && <div className="wallpaper-device-buttons" aria-hidden="true"><i/><i/><i/><i/></div>}
        <div className="wallpaper-screen" style={{ aspectRatio: isPhone ? `${IPHONE_SCREEN.width} / ${IPHONE_SCREEN.height}` : photoRatio }}>
        {photo ? <div className="wallpaper-photo-layer" style={{ width: `${photoBounds.width}%`, height: `${photoBounds.height}%` }}>
        <canvas ref={canvas} aria-label="原始底圖與玻璃週表合成預覽"/>
        <button type="button" className={`wallpaper-placement ${dragging ? 'is-moving' : ''}`} style={{ left: `${settings.x * 100}%`, top: `${settings.y * 100}%`, width: `${settings.width * 100}%`, height: `${settings.height * 100}%`, borderRadius: `${settings.radius * settings.width / 4}cqw` }}
          aria-label="移動行程表位置；方向鍵微調，Esc 取消" title="拖曳移動整張週表"
          onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onLostPointerCapture={() => { if (drag.current) cancelDrag(); }}
          onKeyDown={event => {
            const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
            const direction = directions[event.key];
            if (!direction) return;
            event.preventDefault();
            const step = event.shiftKey ? 0.05 : 0.01;
            onChange(positionWallpaper(settings, { x: settings.x + direction[0] * step, y: settings.y + direction[1] * step }));
          }}><span><Move size={14}/>拖曳移動</span></button>
        </div> : <div className="wallpaper-empty">
        <div className="wallpaper-empty-glass"><Sparkles size={28}/><h2>你的照片，這週的安排。</h2><p>選擇底圖，讓行程浮在玻璃表面。</p><Button className="primary-button" onClick={() => input.current?.click()} disabled={loading}><ImagePlus/>{loading ? '讀取中…' : '選擇底圖'}</Button></div>
        </div>}
        {isPhone && <><div className="wallpaper-dynamic-island" aria-hidden="true"/>{clockGuide && <LockScreenOverlay/>}</>}
        </div>
      </div>
      <p className="wallpaper-preview-note">{isPhone ? '依 iPhone 比例置中裁切；實際位置可在 iOS 調整。' : '完整顯示匯出圖片，可調整螢幕裁切範圍外的行程。'}<br/>手機外框、鎖定介面與拖曳框不會匯出。</p>
    </div>

    <aside className="wallpaper-controls" aria-label="桌布設定">
      <section><h2>底圖</h2><p>原圖直接疊上週表，保留照片本身。</p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="選擇桌布底圖" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) void choose(file); }}/>
        {photo && <p className="wallpaper-filename" title={photo.name}>{photo.name}</p>}
        <div className="wallpaper-photo-actions"><Button variant="outline" onClick={() => input.current?.click()} disabled={loading || exporting}><ImagePlus/>{loading ? '讀取中…' : photo ? '更換底圖' : '選擇底圖'}</Button>{photo && <Button variant="ghost" size="icon" aria-label="移除底圖" disabled={loading || exporting} onClick={() => void removePhoto()}><Trash2/></Button>}</div>
        <p className="wallpaper-small-note">JPG、PNG、WebP · 建議使用直式原始照片，避免重複出現截圖中的時間與按鈕。</p>
      </section>
      <section><div className="wallpaper-section-title"><h2>週表位置</h2><Button variant="ghost" size="sm" onClick={() => onChange({ ...settings, x: DEFAULT_WALLPAPER.x, y: DEFAULT_WALLPAPER.y, width: DEFAULT_WALLPAPER.width, height: DEFAULT_WALLPAPER.height })}><RefreshCw/>重設位置</Button></div><p>拖動預覽中的週表，或在下方微調。</p>
        <div className="wallpaper-slider-grid">{placement.map(({ key, label, min, max }) => slider(key, label, min, max, 100, '%'))}</div>
      </section>
      <section><h2>玻璃效果</h2><div className="wallpaper-slider-grid">{glass.map(({ key, label, min, max, factor, unit }) => slider(key, label, min, max, factor, unit))}</div>
        <label className="wallpaper-tint"><span>玻璃色調</span><input aria-label="玻璃色調" type="color" value={settings.tint} onChange={event => setEditing({ ...settings, tint: event.currentTarget.value })} onBlur={event => { onChange({ ...settings, tint: event.currentTarget.value }); setEditing(null); }}/></label>
        <label className="wallpaper-clock-toggle"><span>顯示鎖定畫面介面</span><Switch checked={clockGuide} onCheckedChange={setClockGuide} disabled={!isPhone}/></label>
      </section>
      {message && (message.error ? <p className="wallpaper-message has-error" role="alert">{message.text}</p> : <output className="wallpaper-message">{message.text}</output>)}
      <Button className="primary-button wallpaper-export" disabled={!photo || loading || exporting} onClick={() => void exportWallpaper()}><Download/>{exporting ? '正在合成…' : '匯出桌布 PNG'}</Button>
      <p className="wallpaper-small-note">底圖只存在此瀏覽器。JSON 會保存行程與玻璃排版；換裝置時需另外選回原照片。</p>
    </aside>
  </section>;
}
