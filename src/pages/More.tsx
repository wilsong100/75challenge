import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, restartChallenge, saveSettings } from '../db/db';
import { useApp } from '../AppContext';
import { Button, Card, Field, PageHeader, Segmented, Toggle, cx, inputCls } from '../components/ui';
import { bestStreak, computeBadges } from '../lib/badges';
import { describeConfig } from '../lib/presets';
import { addDaysStr, diffDays, prettyDate } from '../lib/dates';
import { buildIcs, reminderList } from '../lib/ics';
import { download } from '../lib/image';
import { exportBackup, importBackup } from '../lib/backup';
import { requestNotificationPermission } from '../lib/reminders';
import type { ReminderSettings } from '../types';

type Tab = 'badges' | 'journal' | 'books' | 'history' | 'settings';

function Badges() {
  const { evaluation, challenge } = useApp();
  const stats = useLiveQuery(async () => {
    const workouts = await db.workouts.toArray();
    const water = await db.water.toArray();
    const perDay = new Map<string, number>();
    water.forEach((w) => perDay.set(w.date, (perDay.get(w.date) ?? 0) + w.amountMl));
    const target = challenge?.config.waterTargetMl ?? 3000;
    return {
      totalWorkouts: workouts.length,
      outdoorWorkouts: workouts.filter((w) => w.outdoor).length,
      waterDaysHit: [...perDay.values()].filter((v) => v >= target).length,
      booksFinished: await db.books.where('status').equals('finished').count(),
      photoCount: await db.photos.count(),
      journalEntries: await db.journal.count(),
    };
  }, [challenge]);
  if (!stats) return null;
  const badges = computeBadges({ ...stats, evaluation, bestStreak: bestStreak(evaluation) });
  return (
    <>
      <p className="text-sm text-slate-400 mb-3">{badges.filter((b) => b.earned).length} of {badges.length} earned</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {badges.map((b) => (
          <div key={b.id} className={cx('rounded-2xl border p-3 text-center', b.earned ? 'border-accent/60 bg-accent/10' : 'border-slate-800 bg-slate-900 opacity-50')}>
            <div className={cx('text-3xl', !b.earned && 'grayscale')}>{b.icon}</div>
            <div className="font-semibold text-white text-sm mt-1">{b.title}</div>
            <div className="text-xs text-slate-400">{b.description}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Journal() {
  const navigate = useNavigate();
  const entries = useLiveQuery(() => db.journal.orderBy('date').reverse().toArray(), []);
  if (!entries?.length) return <Card className="text-slate-400 text-center">No journal entries yet – write one from the Today screen.</Card>;
  return (
    <div className="space-y-3">
      {entries.map((e) => (
        <button key={e.date} className="block w-full text-left" onClick={() => navigate(`/day/${e.date}`)}>
          <Card className="hover:border-slate-600">
            <div className="text-xs text-slate-400">{prettyDate(e.date, 'EEEE d MMMM yyyy')}</div>
            {e.win && <div className="text-orange-300 mt-1">🏆 {e.win}</div>}
            {e.text && <p className="text-slate-200 mt-1 whitespace-pre-wrap line-clamp-4">{e.text}</p>}
          </Card>
        </button>
      ))}
    </div>
  );
}

function Books() {
  const books = useLiveQuery(() => db.books.orderBy('id').reverse().toArray(), []);
  const reading = useLiveQuery(() => db.reading.toArray(), []);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const pagesFor = (id?: number) => (reading ?? []).filter((r) => r.bookId === id).reduce((s, r) => s + r.pages, 0);
  async function add() {
    if (!title.trim()) return;
    await db.books.add({ title: title.trim(), author: author.trim(), nonFiction: true, status: 'reading', createdAt: Date.now() });
    setTitle('');
    setAuthor('');
  }
  return (
    <>
      <Card className="mb-4">
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input className={inputCls} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className={inputCls} placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <Button className="w-full" variant="soft" onClick={add} disabled={!title.trim()}>Add book</Button>
      </Card>
      <div className="space-y-2">
        {books?.map((b) => (
          <Card key={b.id} className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-white">{b.status === 'finished' ? '✅ ' : '📖 '}{b.title}</div>
              <div className="text-xs text-slate-400">
                {[b.author, b.nonFiction ? 'non-fiction' : 'fiction', `${pagesFor(b.id)} pages logged`, b.finishedDate && `finished ${prettyDate(b.finishedDate)}`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <Button variant="ghost" className="text-xs shrink-0"
              onClick={() => db.books.update(b.id!, b.status === 'finished' ? { status: 'reading', finishedDate: undefined } : { status: 'finished', finishedDate: new Date().toISOString().slice(0, 10) })}>
              {b.status === 'finished' ? 'Reopen' : 'Finish'}
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}

function History() {
  const { challenges } = useApp();
  return (
    <div className="space-y-3">
      {challenges.map((c) => (
        <Card key={c.id}>
          <div className="flex items-center justify-between">
            <div className="font-semibold text-white">Attempt {c.attempt} · 75 {c.type === 'hard' ? 'Hard' : 'Soft'}</div>
            <span className={cx('text-xs rounded-full px-2 py-1',
              c.status === 'active' ? 'bg-accent/20 text-orange-300' : c.status === 'completed' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-800 text-slate-400')}>
              {c.status}
            </span>
          </div>
          <div className="text-sm text-slate-400 mt-1">
            Started {prettyDate(c.startDate, 'd MMM yyyy')}
            {c.endDate && ` · ended ${prettyDate(c.endDate, 'd MMM yyyy')}`}
            {c.failedOnDay && ` on Day ${c.failedOnDay}`}
          </div>
          <details className="mt-2">
            <summary className="text-xs text-slate-500 cursor-pointer">Rules</summary>
            <ul className="text-sm text-slate-300 mt-2 space-y-1">{describeConfig(c.config).map((l) => <li key={l}>• {l}</li>)}</ul>
          </details>
        </Card>
      ))}
    </div>
  );
}

function SettingsPanel() {
  const { settings, challenge, today } = useApp();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const r = settings.reminders;
  const setR = (patch: Partial<ReminderSettings>) => saveSettings({ reminders: { ...r, ...patch } });
  const time = (k: 'workout' | 'reading' | 'photo' | 'endOfDay' | 'waterFrom' | 'waterTo', label: string) => (
    <Field label={label}>
      <input type="time" className={inputCls} value={r[k]} onChange={(e) => setR({ [k]: e.target.value })} />
    </Field>
  );

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-white mb-3">General</h3>
        <Field label="Name">
          <input className={inputCls} value={settings.name} onChange={(e) => saveSettings({ name: e.target.value })} />
        </Field>
        <Field label="Units">
          <Segmented value={settings.units} onChange={(units) => saveSettings({ units })}
            options={[{ value: 'metric', label: 'Metric (L, kg, cm)' }, { value: 'imperial', label: 'Imperial (oz, lb, in)' }]} />
        </Field>
        <Field label="Ask about unlogged days from" hint="Until this time the next morning, yesterday stays open with no prompt. After that, unlogged days show up in 'Catch up' on Today. A day only counts as missed when you say so.">
          <Segmented value={settings.cutoffHour} onChange={(cutoffHour) => saveSettings({ cutoffHour })}
            options={[0, 6, 10, 12].map((h) => ({ value: h, label: h === 0 ? 'Midnight' : `${h}:00` }))} />
        </Field>
      </Card>

      <Card>
        <h3 className="font-semibold text-white mb-1">Reminders</h3>
        <p className="text-xs text-slate-400 mb-3">
          In-app reminders work while the app is open. For reliable alerts on your phone, add them to your calendar.
        </p>
        <Toggle checked={r.enabled} label="In-app reminders"
          onChange={async (v) => {
            if (v && !(await requestNotificationPermission())) setMsg('Notifications are blocked – reminders will show inside the app only.');
            setR({ enabled: v });
          }} />
        <div className="grid grid-cols-2 gap-3 mt-2">
          {time('workout', 'Workout')}
          {time('reading', 'Reading')}
          {time('endOfDay', 'End-of-day check')}
          {challenge?.config.photo !== 'off' && time('photo', `Photo (${challenge?.config.photo === 'weekly' ? 'weekly' : 'daily'})`)}
          <Field label="Water every">
            <select className={inputCls} value={r.waterEveryHours} onChange={(e) => setR({ waterEveryHours: +e.target.value })}>
              {[0, 1, 2, 3].map((h) => <option key={h} value={h}>{h === 0 ? 'Off' : `${h} hour${h > 1 ? 's' : ''}`}</option>)}
            </select>
          </Field>
          {time('waterFrom', 'Water from')}
          {time('waterTo', 'Water until')}
        </div>
        <Button variant="soft" className="w-full"
          onClick={() => {
            const start = challenge && challenge.startDate > today ? challenge.startDate : today;
            let photo: { everyDays: number; start: string } | undefined;
            if (challenge && challenge.config.photo !== 'off') {
              // Weekly photo days fall on Day 1, 8, 15… of the challenge.
              const everyDays = challenge.config.photo === 'weekly' ? 7 : 1;
              const offset = diffDays(start, challenge.startDate) % everyDays;
              photo = { everyDays, start: addDaysStr(start, (everyDays - offset) % everyDays) };
            }
            download('75-day-reminders.ics', buildIcs(reminderList(r, photo), start), 'text/calendar');
          }}>
          📅 Add reminders to my calendar (.ics)
        </Button>
      </Card>

      <Card>
        <h3 className="font-semibold text-white mb-1">Backup</h3>
        <p className="text-xs text-slate-400 mb-3">Your data lives only on this device. Export a backup regularly (it includes photos).</p>
        <div className="flex gap-2">
          <Button variant="soft" className="flex-1" onClick={async () => download(`75-day-backup-${today}.json`, await exportBackup(), 'application/json')}>Export</Button>
          <Button variant="soft" className="flex-1" onClick={() => fileRef.current?.click()}>Import</Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f || !confirm('Importing replaces all data on this device. Continue?')) return;
            try {
              await importBackup(await f.text());
              setMsg('Backup restored.');
            } catch (err) {
              setMsg(`Import failed: ${(err as Error).message}`);
            }
          }} />
      </Card>

      {challenge && (
        <Card>
          <h3 className="font-semibold text-white mb-3">Challenge</h3>
          <ul className="text-sm text-slate-300 space-y-1 mb-4">{describeConfig(challenge.config).map((l) => <li key={l}>• {l}</li>)}</ul>
          <div className="flex flex-wrap gap-2">
            {challenge.status === 'active' && (
              <Button variant="soft" onClick={() => confirm('Restart at Day 1 today with the same rules?') && restartChallenge(challenge, today)}>Restart at Day 1</Button>
            )}
            <Button variant="soft" onClick={() => navigate('/new')}>New challenge / change rules</Button>
            <Button variant="danger"
              onClick={async () => {
                if (!confirm('Delete ALL data on this device? This cannot be undone.')) return;
                await db.delete();
                location.href = '/';
              }}>
              Erase everything
            </Button>
          </div>
        </Card>
      )}
      {msg && <p className="text-sm text-amber-300">{msg}</p>}
    </div>
  );
}

export default function More() {
  const [tab, setTab] = useState<Tab>('badges');
  return (
    <div>
      <PageHeader title="More" />
      <div className="mb-4">
        <Segmented value={tab} onChange={setTab}
          options={[
            { value: 'badges', label: '🏅 Badges' },
            { value: 'journal', label: '✍️ Journal' },
            { value: 'books', label: '📚 Books' },
            { value: 'history', label: '🗂️ Attempts' },
            { value: 'settings', label: '⚙️ Settings' },
          ]} />
      </div>
      {tab === 'badges' && <Badges />}
      {tab === 'journal' && <Journal />}
      {tab === 'books' && <Books />}
      {tab === 'history' && <History />}
      {tab === 'settings' && <SettingsPanel />}
    </div>
  );
}
