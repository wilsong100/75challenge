import type { ReminderSettings } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

function stamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}00Z`;
}

function localStamp(date: string, time: string) {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`;
}

export interface IcsReminder {
  title: string;
  time: string;
}

export function reminderList(r: ReminderSettings): IcsReminder[] {
  const list: IcsReminder[] = [
    { title: '💪 75 Day: workout time', time: r.workout },
    { title: '📖 75 Day: read your pages', time: r.reading },
    { title: '✅ 75 Day: check off today’s tasks', time: r.endOfDay },
  ];
  const [fh, fm] = r.waterFrom.split(':').map(Number);
  const [th] = r.waterTo.split(':').map(Number);
  for (let h = fh; h <= th && r.waterEveryHours > 0; h += r.waterEveryHours) {
    list.push({ title: '💧 75 Day: drink water', time: `${pad(h)}:${pad(fm)}` });
  }
  return list;
}

/**
 * Builds a calendar file with daily recurring events + alarms for the challenge window.
 * Importing it into the phone calendar gives reliable reminders without a push server.
 */
export function buildIcs(reminders: IcsReminder[], startDate: string, days = 75, now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//75 Day Challenge//EN', 'CALSCALE:GREGORIAN'];
  reminders.forEach((r, i) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:75day-${startDate}-${i}@75challenge`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${localStamp(startDate, r.time)}`,
      'DURATION:PT10M',
      `RRULE:FREQ=DAILY;COUNT=${days}`,
      `SUMMARY:${r.title}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${r.title}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
