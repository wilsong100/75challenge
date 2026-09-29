import { describe, expect, it } from 'vitest';
import { buildIcs, reminderList } from './ics';
import { DEFAULT_SETTINGS } from '../db/db';

describe('ics', () => {
  it('builds daily recurring events with alarms', () => {
    const list = reminderList({ ...DEFAULT_SETTINGS.reminders, waterEveryHours: 4, waterFrom: '08:00', waterTo: '20:00' });
    expect(list.filter((r) => r.title.includes('water')).map((r) => r.time)).toEqual(['08:00', '12:00', '16:00', '20:00']);
    const ics = buildIcs(list, '2026-10-01', 75, new Date(Date.UTC(2026, 8, 29)));
    expect(ics).toContain('DTSTART:20261001T070000');
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=75');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(list.length);
  });
});
