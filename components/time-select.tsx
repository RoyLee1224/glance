import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STEP, timeLabel } from '@/lib/schedule';

export function TimeSelect({ value, onChange, labelId, end = false }: { value: number; onChange: (value: number) => void; labelId: string; end?: boolean }) {
  const first = end ? STEP : 0;
  return <Select value={value} onValueChange={next => { if (typeof next === 'number') onChange(next); }}><SelectTrigger className="form-select" aria-labelledby={labelId}><SelectValue>{timeLabel(value)}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{Array.from({ length: 96 }, (_, index) => first + index * STEP).map(time => <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>)}</SelectContent></Select>;
}
