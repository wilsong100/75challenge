import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { useApp } from '../AppContext';
import { Card, PageHeader, cx } from '../components/ui';
import { evaluateChallenge, type DayState } from '../lib/rules';
import { parseDate, toDateStr } from '../lib/dates';

const STATE_STYLE: Record<DayState, string> = {
  complete: 'bg-emerald-600 text-white',
  partial: 'bg-amber-500/80 text-slate-950',
  today: 'bg-slate-800 text-white ring-2 ring-accent',
  open: 'bg-amber-500/40 text-white',
  missed: 'bg-red-700 text-white',
  review: 'bg-violet-700 text-white',
  grace: 'bg-sky-700 text-white',
  future: 'bg-slate-800/60 text-slate-400',
};

const LEGEND: [DayState, string][] = [
  ['complete', 'Complete'],
  ['partial', 'In progress'],
  ['review', 'Not logged'],
  ['missed', 'Missed'],
  ['grace', 'Grace day'],
  ['future', 'Upcoming'],
];

export default function Calendar() {
  const { challenges, getDay, now, settings, today } = useApp();
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(now));

  // Colour every date covered by any attempt; the newest attempt wins overlaps.
  const states = useMemo(() => {
    const map = new Map<string, { state: DayState; day: number; attempt: number }>();
    [...challenges].reverse().forEach((c) => {
      const ev = evaluateChallenge(c, getDay, now, settings.cutoffHour, settings.units);
      for (const d of ev.days) {
        if (c.endDate && d.date > c.endDate) break;
        map.set(d.date, { state: d.state, day: d.day, attempt: c.attempt });
      }
    });
    return map;
  }, [challenges, getDay, now, settings]);

  const days = eachDayOfInterval({
    start: startOfWeek(month, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const monthKey = format(month, 'yyyy-MM');
  const inMonth = [...states.entries()].filter(([d]) => d.startsWith(monthKey));
  const completeCount = inMonth.filter(([, s]) => s.state === 'complete').length;

  return (
    <div>
      <PageHeader title="Calendar" subtitle={`${completeCount} complete day${completeCount === 1 ? '' : 's'} this month`} />
      <Card>
        <div className="flex items-center justify-between mb-4">
          <button className="rounded-full p-2 text-slate-400 hover:bg-slate-800" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>◀</button>
          <div className="font-semibold text-white">{format(month, 'MMMM yyyy')}</div>
          <button className="rounded-full p-2 text-slate-400 hover:bg-slate-800" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>▶</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-slate-500 mb-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const ds = toDateStr(d);
            const s = states.get(ds);
            const inCurrentMonth = d.getMonth() === month.getMonth();
            const clickable = ds <= today;
            return (
              <button
                key={ds}
                disabled={!clickable}
                onClick={() => navigate(ds === today ? '/' : `/day/${ds}`)}
                className={cx(
                  'aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition',
                  s ? STATE_STYLE[s.state] : 'text-slate-400 hover:bg-slate-800',
                  !inCurrentMonth && 'opacity-30',
                  ds === today && s?.state !== 'today' && 'ring-2 ring-accent',
                )}
              >
                <span className="font-semibold leading-none">{d.getDate()}</span>
                {s && <span className="text-[9px] leading-none mt-0.5 opacity-80">D{s.day}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 mt-4 text-xs text-slate-400">
          {LEGEND.map(([k, label]) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={cx('h-3 w-3 rounded', STATE_STYLE[k])} />
              {label}
            </span>
          ))}
        </div>
      </Card>
      {challenges[0] && (
        <p className="text-xs text-slate-500 mt-3 text-center">
          Current attempt started {format(parseDate(challenges[0].startDate), 'd MMM yyyy')}. Tap a day to view or edit it.
        </p>
      )}
    </div>
  );
}
