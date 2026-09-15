import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STEP, timeLabel } from '@/lib/schedule';
import { useIsMobile } from '@/hooks/use-mobile';

export function TimeSelect({ value, onChange, labelId, end = false }: { value: number; onChange: (value: number) => void; labelId: string; end?: boolean }) {
  const isMobile = useIsMobile();
  const first = end ? STEP : 0;
  const times = Array.from({ length: 96 }, (_, index) => first + index * STEP);
  if (isMobile) return <select className="form-select native-time-select" aria-labelledby={labelId} value={value} onChange={event => onChange(Number(event.currentTarget.value))}>{times.map(time => <option key={time} value={time}>{timeLabel(time)}</option>)}</select>;
  return <Select value={value} onValueChange={next => { if (typeof next === 'number') onChange(next); }}><SelectTrigger className="form-select" aria-labelledby={labelId}><SelectValue>{timeLabel(value)}</SelectValue></SelectTrigger><SelectContent alignItemWithTrigger={false}>{Array.from({ length: 96 }, (_, index) => first + index * STEP).map(time => <SelectItem key={time} value={time}>{timeLabel(time)}</SelectItem>)}</SelectContent></Select>;
}
