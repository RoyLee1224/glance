import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeSelect } from '@/components/time-select';
import { DAYS, isFullyVisible, type GridSettings, type ScheduleCategory } from '@/lib/schedule';
import { readCategories, readGrid, type ProjectDocument } from '@/lib/project';

export function ProjectSettings({ project, onClose, onApply }: { project: ProjectDocument; onClose: () => void; onApply: (categories: ScheduleCategory[], grid: GridSettings, reassignments: Record<string, string>) => void }) {
  const [categories, setCategories] = useState(() => project.categories.map(c => ({ ...c })));
  const [grid, setGrid] = useState(() => ({ ...project.grid, days: [...project.grid.days] }));
  const [reassignments, setReassignments] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [replacement, setReplacement] = useState('');
  const [error, setError] = useState('');
  const categoryFor = (id: string) => Object.hasOwn(reassignments, id) ? reassignments[id] : id;
  const count = (id: string) => project.events.filter(event => categoryFor(event.category) === id).length;
  const outside = project.events.filter(event => !isFullyVisible(event, grid)).length;
  function removeCategory(id: string, target: string) {
    setCategories(categories.filter(c => c.id !== id));
    setReassignments(previous => Object.fromEntries([...Object.entries(previous).map(([key, value]) => [key, value === id ? target : value]), [id, target]]));
    setDeleting(null);
    setError('');
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="project-settings-dialog"><DialogHeader><DialogTitle>週表設定</DialogTitle><DialogDescription>決定要顯示的星期、時間，以及自己的行程分類。</DialogDescription></DialogHeader>
    <form className="project-settings-form" onSubmit={event => { event.preventDefault(); try { if (deleting) throw new Error('請先完成或取消分類移除。'); onApply(readCategories(categories), readGrid(grid), reassignments); } catch (error) { setError(error instanceof Error ? error.message : '請檢查設定。'); } }}>
      <fieldset><legend>顯示範圍</legend><div className="weekday-options">{DAYS.map((day, index) => <label key={day}><Checkbox checked={grid.days.includes(index)} onCheckedChange={checked => { setGrid({ ...grid, days: checked ? [...grid.days, index].sort((a, b) => a - b) : grid.days.filter(d => d !== index) }); setError(''); }}/>{day}</label>)}</div>
        <div className="settings-times"><div><span className="form-label" id="grid-start-label">開始時間</span><TimeSelect labelId="grid-start-label" value={grid.start} onChange={start => { setGrid({ ...grid, start }); setError(''); }}/></div><div><span className="form-label" id="grid-end-label">結束時間</span><TimeSelect labelId="grid-end-label" value={grid.end} onChange={end => { setGrid({ ...grid, end }); setError(''); }} end/></div></div>
        <p className="settings-note">以 15 分鐘為單位。每天使用同一個顯示範圍。</p>
        {outside > 0 && <p className="settings-note">有 {outside} 個行程超出此範圍，會保留並列在週表下方。</p>}
      </fieldset>
      <fieldset><legend>行程分類</legend><p className="settings-note">名稱和顏色由你決定；「本週分配」依行程自動加總時數。</p><div className="category-edit-list">{categories.map(c => <div className="category-edit-row" key={c.id}><input type="color" value={c.color} aria-label={`${c.label || '新分類'}的顏色`} onChange={event => setCategories(categories.map(item => item.id === c.id ? { ...item, color: event.target.value } : item))}/><Input value={c.label} aria-label="分類名稱" maxLength={40} required onChange={event => setCategories(categories.map(item => item.id === c.id ? { ...item, label: event.target.value } : item))}/><span>{count(c.id)} 個</span><Button type="button" variant="ghost" size="icon" disabled={categories.length === 1 || deleting !== null} aria-label={`移除分類 ${c.label}`} title={categories.length === 1 ? '至少保留一個分類' : '移除分類'} onClick={() => { if (count(c.id) === 0) removeCategory(c.id, categories.find(item => item.id !== c.id)!.id); else { setDeleting(c.id); setReplacement(categories.find(item => item.id !== c.id)!.id); } }}><Trash2/></Button></div>)}</div>
        {deleting && <div className="category-reassignment"><p>將「{categories.find(c => c.id === deleting)?.label}」的 {count(deleting)} 個行程移到：</p><Select value={replacement} onValueChange={value => { if (typeof value === 'string') setReplacement(value); }}><SelectTrigger aria-label="移除分類後的行程分類"><SelectValue>{categories.find(c => c.id === replacement)?.label}</SelectValue></SelectTrigger><SelectContent>{categories.filter(c => c.id !== deleting).map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent></Select><div><Button type="button" variant="secondary" onClick={() => removeCategory(deleting, replacement)}>移轉並移除</Button><Button type="button" variant="ghost" onClick={() => setDeleting(null)}>取消</Button></div></div>}
        <Button type="button" variant="outline" className="add-category" disabled={categories.length >= 32} onClick={() => setCategories([...categories, { id: crypto.randomUUID(), label: '新分類', color: '#6b7fd7' }])}><Plus/>新增分類</Button>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="settings-actions"><Button type="button" variant="ghost" onClick={onClose}>取消</Button><Button type="submit" className="primary-button">套用設定</Button></div>
    </form>
  </DialogContent></Dialog>;
}
