import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ScheduleEditor } from '@/components/schedule-editor';
import { Toaster } from '@/components/ui/toast';
import '@/app/globals.css';

createRoot(document.getElementById('root')!).render(<StrictMode><Toaster><ScheduleEditor /></Toaster></StrictMode>);
