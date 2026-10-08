import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, restartChallenge, setCheck } from '../db/db';
import { useApp } from '../AppContext';
import { Bar, Button, Card, Ring, cx } from '../components/ui';
import { MealSheet, PhotoSheet, ReadingSheet, WaterSheet, WorkoutSheet } from '../components/LogSheets';
import { BodyStatsSheet, JournalCard } from '../components/BodyJournal';
import { addDaysStr, prettyDate } from '../lib/dates';
import {
  DAY_CONFIRMED, DAY_MISSED, dayNumber, evaluateDay, isPhotoDay, type ChallengeEvaluation, type DayResult, type TaskStatus,
} from '../lib/rules';
import { CHALLENGE_DAYS } from '../lib/presets';
import { formatWater, kgToWeightUnit, round1, waterQuickAdds, weightUnitLabel } from '../lib/units';
import type { Challenge } from '../types';

type SheetName = 'workout' | 'water' | 'meal' | 'reading' | 'photo' | 'body' | null;

const ICONS: Record<string, string> = { workout: '🏋️', water: '💧', diet: '🥗', alcohol: '🚫', reading: '📖', photo: '📸' };

/** What answering "I missed it" will do under this challenge's rules. */
function missedConsequence(challenge: Challenge, evaluation: ChallengeEvaluation) {
  const rule = challenge.config.missedDay;
  if (rule.mode === 'log') return { ends: false, text: 'It will be recorded as missed – your challenge carries on.' };
  if (rule.mode === 'grace') {
    const left = rule.graceDays - evaluation.graceUsed;
    if (left > 0) return { ends: false, text: `It will use 1 of your grace days (${left} left).` };
    return { ends: true, text: "You're out of grace days, so this ends the attempt and you restart at Day 1." };
  }
  return { ends: true, text: 'Under your rules this ends the attempt and you restart at Day 1.' };
}

async function markMissed(r: DayResult, challenge: Challenge, evaluation: ChallengeEvaluation) {
  const c = missedConsequence(challenge, evaluation);
  if (c.ends && !confirm(`Mark Day ${r.day} as missed?\n\n${c.text}`)) return;
  await setCheck(r.date, DAY_MISSED, true);
}

const missingTasks = (r: DayResult) => r.tasks.filter((t) => !t.done).map((t) => t.label).join(', ');

/** Days that weren't fully logged. Nothing is failed until you say you actually missed it. */
function CatchUpCard({ challenge, evaluation }: { challenge: Challenge; evaluation: ChallengeEvaluation }) {
  const navigate = useNavigate();
  const days = evaluation.needsReview;
  if (!days.length) return null;
  return (
    <Card className="mb-4 border-amber-700 bg-amber-950/30">
      <h2 className="font-bold text-white">📝 Catch up on {days.length === 1 ? '1 day' : `${days.length} days`}</h2>
      <p className="text-sm text-slate-300 mt-1 mb-3">
        These days aren't fully logged. Forgot to log them? Fill them in or tick them off. Nothing counts as missed until you say so.
      </p>
      <div className="space-y-3">
        {days.map((r) => (
          <div key={r.date} className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-white">Day {r.day}</span>
              <span className="text-xs text-slate-400">{prettyDate(r.date, 'EEE d MMM')}</span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5 mb-2">Not logged: {missingTasks(r)}</div>
            <div className="flex flex-wrap gap-2">
              <Button className="text-sm py-1.5" onClick={() => setCheck(r.date, DAY_CONFIRMED, true)}>✓ I did it all</Button>
              <Button variant="soft" className="text-sm py-1.5" onClick={() => navigate(`/day/${r.date}`)}>Log details</Button>
              <Button variant="ghost" className="text-sm py-1.5" onClick={() => markMissed(r, challenge, evaluation)}>I missed it</Button>
            </div>
          </div>
        ))}
      </div>
      {days.length > 1 && (
        <Button variant="soft" className="w-full mt-3" onClick={() => Promise.all(days.map((r) => setCheck(r.date, DAY_CONFIRMED, true)))}>
          ✓ I did everything on all {days.length} days
        </Button>
      )}
    </Card>
  );
}

/** On a past day: one-tap "I did everything", with undo. */
function PastDayActions({ result, challenge, evaluation }: { result: DayResult; challenge: Challenge; evaluation: ChallengeEvaluation }) {
  const active = challenge.status === 'active';
  if (result.confirmed) {
    return (
      <Card className="mb-4 text-sm text-slate-300 flex items-center justify-between gap-3">
        <span>✅ You marked this day as done without logging every task.</span>
        {active && <Button variant="ghost" className="text-sm shrink-0" onClick={() => setCheck(result.date, DAY_CONFIRMED, false)}>Undo</Button>}
      </Card>
    );
  }
  if (result.state === 'missed' || result.state === 'grace') {
    return (
      <Card className="mb-4 text-sm text-slate-300 flex items-center justify-between gap-3">
        <span>{result.state === 'grace' ? '🛟 Grace day used – marked as missed.' : '❌ Marked as missed.'}</span>
        {active && (
          <Button variant="ghost" className="text-sm shrink-0" onClick={() => setCheck(result.date, DAY_MISSED, false)}>Undo</Button>
        )}
      </Card>
    );
  }
  if (result.complete || !active) return null;
  return (
    <Card className="mb-4">
      <p className="text-sm text-slate-300 mb-3">
        Forgot to log this day? Fill in the details below, or if you did everything just tick it off.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setCheck(result.date, DAY_CONFIRMED, true)}>✓ I did everything this day</Button>
        {result.state === 'review' && (
          <Button variant="ghost" onClick={() => markMissed(result, challenge, evaluation)}>I missed it</Button>
        )}
      </div>
    </Card>
  );
}

function EndedCard({ challenge, today }: { challenge: Challenge; today: string }) {
  const navigate = useNavigate();
  if (challenge.status === 'completed') {
    return (
      <Card className="mb-4 border-emerald-700 bg-emerald-950/40 text-center">
        <div className="text-5xl mb-2">🏆</div>
        <h2 className="text-2xl font-bold text-white">75 days complete!</h2>
        <p className="text-slate-300 mt-1 mb-4">You did it. Check your photos and progress to see how far you've come.</p>
        <div className="flex gap-2 justify-center">
          <Button variant="soft" onClick={() => navigate('/photos')}>Before / after</Button>
          <Button onClick={() => navigate('/new')}>Start another</Button>
        </div>
      </Card>
    );
  }
  const hard = challenge.config.missedDay.mode === 'restart';
  return (
    <Card className="mb-4 border-red-800 bg-red-950/40">
      <h2 className="text-xl font-bold text-white">Attempt {challenge.attempt} ended on Day {challenge.failedOnDay}</h2>
      <p className="text-slate-300 mt-1 mb-4">
        {hard
          ? 'The rules are the rules: a missed task means back to Day 1. Everything you logged is kept in your history.'
          : 'You ran out of grace days. Everything you logged is kept in your history.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => restartChallenge(challenge, today)}>Restart at Day 1 today</Button>
        <Button variant="soft" onClick={() => navigate('/new')}>Change rules</Button>
      </div>
    </Card>
  );
}

export default function DayView() {
  const params = useParams();
  const { challenge, evaluation, getDay, today, settings } = useApp();
  const date = params.date ?? today;
  const [sheet, setSheet] = useState<SheetName>(null);
  const close = () => setSheet(null);
  const units = settings.units;

  const workouts = useLiveQuery(() => db.workouts.where('date').equals(date).toArray(), [date]);
  const meals = useLiveQuery(() => db.meals.where('date').equals(date).sortBy('time'), [date]);
  const water = useLiveQuery(() => db.water.where('date').equals(date).toArray(), [date]);
  const reading = useLiveQuery(() => db.reading.where('date').equals(date).toArray(), [date]);
  const books = useLiveQuery(() => db.books.toArray(), []);
  const body = useLiveQuery(() => db.bodyStats.get(date), [date]);

  if (!challenge || !evaluation) return null;
  const config = challenge.config;
  const day = dayNumber(challenge.startDate, date);
  const inWindow = day >= 1 && day <= CHALLENGE_DAYS;
  const result = inWindow ? evaluation.days[day - 1] : undefined;
  const ev = result ?? evaluateDay(config, getDay(date), 0, units);
  const doneCount = ev.tasks.filter((t) => t.done).length;
  const isToday = date === today;
  const ended = challenge.status !== 'active';

  const action = (t: TaskStatus) => {
    if (t.key === 'diet' || t.key === 'alcohol' || t.key.startsWith('custom:'))
      return () => setCheck(date, t.key, !t.done);
    return () => setSheet(t.key as SheetName);
  };

  if (ended && isToday) return <EndedCard challenge={challenge} today={today} />;

  return (
    <div>
      {isToday && <CatchUpCard challenge={challenge} evaluation={evaluation} />}

      <div className="flex items-center justify-between mb-3">
        <Link to={`/day/${addDaysStr(date, -1)}`} className="rounded-full p-2 text-slate-400 hover:bg-slate-800" aria-label="Previous day">◀</Link>
        <div className="text-center">
          <div className="text-sm text-slate-400">{isToday ? 'Today' : prettyDate(date, 'EEEE')}</div>
          <div className="font-semibold text-white">{prettyDate(date, 'd MMMM yyyy')}</div>
        </div>
        {date < today ? (
          <Link to={addDaysStr(date, 1) === today ? '/' : `/day/${addDaysStr(date, 1)}`} className="rounded-full p-2 text-slate-400 hover:bg-slate-800" aria-label="Next day">▶</Link>
        ) : (
          <span className="w-9" />
        )}
      </div>

      <Card className="mb-4 flex items-center gap-5">
        <Ring value={ev.tasks.length ? doneCount / ev.tasks.length : 0} size={112}>
          {inWindow ? (
            <>
              <span className="text-xs text-slate-400">DAY</span>
              <span className="text-3xl font-extrabold text-white leading-none">{day}</span>
              <span className="text-xs text-slate-500">of {CHALLENGE_DAYS}</span>
            </>
          ) : (
            <span className="text-sm text-slate-400 px-3 text-center">{day < 1 ? `Starts in ${1 - day}d` : 'Finished'}</span>
          )}
        </Ring>
        <div className="flex-1">
          <div className="text-sm text-slate-400">75 {challenge.type === 'hard' ? 'Hard' : 'Soft'} · attempt {challenge.attempt}</div>
          <div className="text-xl font-bold text-white mt-0.5">
            {ev.complete ? 'Day complete ✅' : `${doneCount} of ${ev.tasks.length} done`}
          </div>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-orange-300">🔥 {evaluation.streak} streak</span>
            {config.missedDay.mode === 'grace' && (
              <span className="text-slate-400">🛟 {config.missedDay.graceDays - evaluation.graceUsed} grace left</span>
            )}
          </div>
          {result?.state === 'review' && <div className="text-xs text-amber-400 mt-1">Not fully logged yet</div>}
        </div>
      </Card>

      {isToday && inWindow && !ended && isPhotoDay(config, day) && !getDay(date).hasPhoto && (
        <button onClick={() => setSheet('photo')} className="w-full text-left mb-4">
          <Card className="flex items-center gap-3 border-sky-800 bg-sky-950/30 hover:border-sky-600">
            <span className="text-2xl">📸</span>
            <span className="flex-1">
              <span className="block font-semibold text-white">
                {config.photo === 'weekly' ? `Week ${Math.floor((day - 1) / 7) + 1} photo day` : 'Progress photo'}
              </span>
              <span className="block text-xs text-slate-400">Optional – it won't affect your day, but you'll love the before/after.</span>
            </span>
            <span className="text-sm font-semibold text-sky-300">Add</span>
          </Card>
        </button>
      )}

      {result && date < today && <PastDayActions result={result} challenge={challenge} evaluation={evaluation} />}

      <div className="space-y-2 mb-4">
        {ev.tasks.map((t) => (
          <button key={t.key} onClick={action(t)}
            className={cx('w-full text-left rounded-2xl border p-3 flex items-center gap-3 transition',
              t.done ? 'border-emerald-800 bg-emerald-950/30' : 'border-slate-800 bg-slate-900 hover:border-slate-600')}>
            <span className="text-2xl w-8 text-center">{ICONS[t.key] ?? '⭐'}</span>
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold text-white truncate">{t.label}</span>
                <span className="text-xs text-slate-400 shrink-0">{t.detail.length < 28 ? t.detail : ''}</span>
              </span>
              {t.detail.length >= 28 && <span className="block text-xs text-slate-400 truncate">{t.detail}</span>}
              {t.progress > 0 && t.progress < 1 && <Bar value={t.progress} className="mt-2" />}
            </span>
            <span className={cx('h-7 w-7 shrink-0 rounded-full border-2 flex items-center justify-center text-sm',
              t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600')}>
              {t.done ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>

      <Card className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-white">💧 Quick water</h3>
          <span className="text-sm text-slate-400">{formatWater(getDay(date).waterMl, units)}</span>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {waterQuickAdds(units).map((ml) => (
            <button key={ml} onClick={() => db.water.add({ date, amountMl: Math.round(ml), createdAt: Date.now() })}
              className="rounded-xl bg-sky-950 border border-sky-900 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-900">
              +{formatWater(ml, units).replace(' ', '')}
            </button>
          ))}
          <button onClick={() => setSheet('water')} className="rounded-xl bg-slate-800 py-2 text-sm text-slate-300">Other</button>
        </div>
        {!!water?.length && (
          <button className="text-xs text-slate-500 mt-2 underline" onClick={() => db.water.delete(water[water.length - 1].id!)}>
            Undo last ({formatWater(water[water.length - 1].amountMl, units)})
          </button>
        )}
      </Card>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {([['workout', '🏋️', 'Workout'], ['meal', '🍽️', 'Meal'], ['reading', '📖', 'Reading'], ['photo', '📸', 'Photo']] as const).map(
          ([k, icon, label]) => (
            <button key={k} onClick={() => setSheet(k)} className="rounded-2xl bg-slate-900 border border-slate-800 py-3 hover:border-slate-600">
              <div className="text-2xl">{icon}</div>
              <div className="text-xs text-slate-300 mt-1">+ {label}</div>
            </button>
          ),
        )}
      </div>

      {!!workouts?.length && (
        <Card className="mb-4">
          <h3 className="font-semibold text-white mb-2">Workouts</h3>
          {workouts.map((w) => (
            <div key={w.id} className="flex items-center justify-between py-2 border-t border-slate-800 first:border-0">
              <div>
                <div className="text-slate-100">{w.kind} · {w.durationMin} min</div>
                <div className="text-xs text-slate-500">
                  {[w.outdoor && '🌳 outdoor', w.recovery && '🧘 recovery', w.distanceKm && `${round1(w.distanceKm)} km`, w.notes].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button className="text-slate-500 hover:text-red-400 px-2" aria-label="Delete workout" onClick={() => db.workouts.delete(w.id!)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      {!!meals?.length && (
        <Card className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-white">Meals</h3>
            <span className="text-xs text-slate-400">
              {meals.reduce((s, m) => s + (m.calories ?? 0), 0) || '–'} kcal · {meals.reduce((s, m) => s + (m.proteinG ?? 0), 0) || '–'} g protein
            </span>
          </div>
          {meals.map((m) => (
            <div key={m.id} className="flex items-center justify-between py-2 border-t border-slate-800 first:border-0">
              <div>
                <div className="text-slate-100">{m.onPlan ? '' : '⚠️ '}{m.name}</div>
                <div className="text-xs text-slate-500">
                  {m.mealType} · {m.time}{m.calories ? ` · ${m.calories} kcal` : ''}{m.proteinG ? ` · ${m.proteinG} g protein` : ''}
                </div>
              </div>
              <button className="text-slate-500 hover:text-red-400 px-2" aria-label="Delete meal" onClick={() => db.meals.delete(m.id!)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      {!!reading?.length && (
        <Card className="mb-4">
          <h3 className="font-semibold text-white mb-2">Reading</h3>
          {reading.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 border-t border-slate-800 first:border-0">
              <div className="text-slate-100">
                {books?.find((b) => b.id === r.bookId)?.title ?? 'Reading'}
                <span className="text-xs text-slate-500"> · {r.pages ? `${r.pages} pages` : ''}{r.pages && r.minutes ? ', ' : ''}{r.minutes ? `${r.minutes} min` : ''}{r.audiobook ? ' 🎧' : ''}</span>
              </div>
              <button className="text-slate-500 hover:text-red-400 px-2" aria-label="Delete reading" onClick={() => db.reading.delete(r.id!)}>✕</button>
            </div>
          ))}
        </Card>
      )}

      <button onClick={() => setSheet('body')} className="w-full mb-4 text-left">
        <Card className="hover:border-slate-600">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">⚖️ Body & wellbeing</h3>
            <span className="text-sm text-accent">{body ? 'Edit' : 'Add'}</span>
          </div>
          {body && (
            <div className="text-sm text-slate-400 mt-1">
              {[
                body.weightKg && `${round1(kgToWeightUnit(body.weightKg, units))} ${weightUnitLabel(units)}`,
                body.sleepHrs && `${body.sleepHrs} h sleep`,
                body.mood && `mood ${body.mood}/5`,
                body.energy && `energy ${body.energy}/5`,
              ].filter(Boolean).join(' · ')}
            </div>
          )}
        </Card>
      </button>

      <JournalCard date={date} />

      <WorkoutSheet date={date} units={units} open={sheet === 'workout'} onClose={close} minMinutes={config.workoutMinutes} />
      <WaterSheet date={date} units={units} open={sheet === 'water'} onClose={close} />
      <MealSheet date={date} units={units} open={sheet === 'meal'} onClose={close} />
      <ReadingSheet date={date} units={units} open={sheet === 'reading'} onClose={close} unit={config.reading.unit} />
      <PhotoSheet date={date} open={sheet === 'photo'} onClose={close} />
      <BodyStatsSheet date={date} units={units} open={sheet === 'body'} onClose={close} />
    </div>
  );
}
