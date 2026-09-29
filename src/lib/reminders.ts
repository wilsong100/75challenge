import { useEffect, useState } from 'react';
import type { ReminderSettings } from '../types';
import type { TaskStatus } from './rules';
import { reminderList } from './ics';

const pad = (n: number) => String(n).padStart(2, '0');

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}

async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: title });
    else new Notification(title, { body, icon: '/icons/icon-192.png' });
    return true;
  } catch {
    return false;
  }
}

/** Picks the reminder due at this minute, skipping ones whose task is already done. */
export function dueReminder(r: ReminderSettings, now: Date, tasks: TaskStatus[]): { title: string; body: string } | null {
  if (!r.enabled) return null;
  const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const task = (k: string) => tasks.find((t) => t.key === k);
  for (const item of reminderList(r)) {
    if (item.time !== hhmm) continue;
    if (item.title.includes('water')) {
      const w = task('water');
      if (w && !w.done) return { title: '💧 Drink water', body: `You're at ${w.detail}.` };
    } else if (item.title.includes('workout')) {
      const w = task('workout');
      if (w && !w.done) return { title: '💪 Workout time', body: w.detail };
    } else if (item.title.includes('read')) {
      const w = task('reading');
      if (w && !w.done) return { title: '📖 Reading', body: w.detail };
    } else {
      const left = tasks.filter((t) => !t.done);
      if (left.length) return { title: `⏰ ${left.length} task${left.length > 1 ? 's' : ''} left today`, body: left.map((t) => t.label).join(', ') };
    }
  }
  return null;
}

/** In-app reminder loop: fires system notifications when allowed, otherwise an in-app toast. */
export function useReminders(r: ReminderSettings, now: Date, tasks: TaskStatus[] | undefined) {
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);
  const minuteKey = `${now.toDateString()} ${now.getHours()}:${now.getMinutes()}`;
  useEffect(() => {
    if (!tasks) return;
    const due = dueReminder(r, now, tasks);
    if (!due) return;
    const key = `reminder:${minuteKey}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, '1');
    } catch {
      /* storage unavailable – still show it */
    }
    notify(due.title, due.body).then((shown) => {
      if (!shown || document.visibilityState === 'visible') setToast(due);
    });
  }, [minuteKey]);
  return { toast, dismiss: () => setToast(null) };
}
