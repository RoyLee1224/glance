import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleEditor } from '@/components/schedule-editor';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(<StrictMode><ScheduleEditor /></StrictMode>);
