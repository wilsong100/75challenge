import { describe, expect, it } from 'vitest';
import { DAY_CONFIRMED, DAY_MISSED, emptyDay, evaluateChallenge, evaluateDay, isFinal, type DayData } from './rules';
import { HARD_CONFIG, SOFT_DEFAULTS } from './presets';
import { addDaysStr } from './dates';
import type { ChallengeConfig, Workout } from '../types';

const w = (min: number, outdoor = false, recovery = false): Workout => ({
  date: '', kind: 'Run', durationMin: min, outdoor, recovery, createdAt: 0,
});

function perfect(config: ChallengeConfig): DayData {
  return {
    workouts: Array.from({ length: config.workoutsPerDay }, (_, i) => w(config.workoutMinutes, i === 0)),
    waterMl: config.waterTargetMl,
    readingPages: 10,
    readingMinutes: 20,
    hasPhoto: true,
    checks: { diet: true, alcohol: true, ...Object.fromEntries(config.customTasks.map((t) => [`custom:${t}`, true])) },
  };
}

describe('evaluateDay – 75 Hard', () => {
  it('passes a perfect day', () => {
    expect(evaluateDay(HARD_CONFIG, 1, perfect(HARD_CONFIG), 0).complete).toBe(true);
  });

  it('requires one of the two workouts to be outdoors', () => {
    const d = { ...perfect(HARD_CONFIG), workouts: [w(45), w(45)] };
    const ev = evaluateDay(HARD_CONFIG, 1, d, 0);
    expect(ev.tasks.find((t) => t.key === 'workout')!.done).toBe(false);
    expect(ev.complete).toBe(false);
  });

  it('does not count short workouts', () => {
    const d = { ...perfect(HARD_CONFIG), workouts: [w(45, true), w(30)] };
    expect(evaluateDay(HARD_CONFIG, 1, d, 0).complete).toBe(false);
  });

  it('requires water, reading, photo, diet and no alcohol', () => {
    for (const patch of [{ waterMl: 3000 }, { readingPages: 9 }, { hasPhoto: false }, { checks: { diet: true } }]) {
      expect(evaluateDay(HARD_CONFIG, 1, { ...perfect(HARD_CONFIG), ...patch }, 0).complete).toBe(false);
    }
  });

  it('never allows recovery days', () => {
    const d = { ...perfect(HARD_CONFIG), workouts: [w(20, true, true)] };
    expect(evaluateDay(HARD_CONFIG, 1, d, 0).complete).toBe(false);
  });
});

describe('evaluateDay – 75 Soft', () => {
  it('only needs a weekly photo on days 1, 8, 15…', () => {
    const d = { ...perfect(SOFT_DEFAULTS), hasPhoto: false };
    expect(evaluateDay(SOFT_DEFAULTS, 1, d, 0).complete).toBe(false);
    expect(evaluateDay(SOFT_DEFAULTS, 2, d, 0).complete).toBe(true);
    expect(evaluateDay(SOFT_DEFAULTS, 8, d, 0).complete).toBe(false);
  });

  it('accepts an active-recovery session while recovery days remain', () => {
    const d = { ...perfect(SOFT_DEFAULTS), workouts: [w(20, false, true)] };
    const ev = evaluateDay(SOFT_DEFAULTS, 3, d, 0);
    expect(ev.complete).toBe(true);
    expect(ev.usedRecovery).toBe(true);
    expect(evaluateDay(SOFT_DEFAULTS, 4, d, 1).complete).toBe(false);
  });

  it('skips diet/alcohol tasks when there is no rule and supports minutes reading', () => {
    const config: ChallengeConfig = {
      ...SOFT_DEFAULTS,
      diet: 'none',
      alcohol: 'no-rule',
      reading: { unit: 'minutes', amount: 20, nonFictionOnly: false, audiobooksAllowed: true },
      customTasks: ['Meditate'],
    };
    const d = { ...perfect(config), checks: { 'custom:Meditate': true } };
    const ev = evaluateDay(config, 2, d, 0);
    expect(ev.tasks.map((t) => t.key)).toEqual(['workout', 'water', 'reading', 'custom:Meditate']);
    expect(ev.complete).toBe(true);
  });
});

describe('isFinal', () => {
  const now = new Date(2026, 8, 29, 9, 0); // 29 Sep 09:00
  it('keeps yesterday open until the cut-off hour', () => {
    expect(isFinal('2026-09-28', now, 10)).toBe(false);
    expect(isFinal('2026-09-28', now, 9)).toBe(true);
    expect(isFinal('2026-09-27', now, 10)).toBe(true);
    expect(isFinal('2026-09-29', now, 10)).toBe(false);
  });
});

describe('evaluateChallenge', () => {
  const start = '2026-09-01';
  const now = new Date(2026, 8, 11, 12, 0); // day 11, noon
  const dayOf = (date: string) => Math.round((new Date(date).getTime() - new Date(start).getTime()) / 864e5) + 1;
  /** `missed` days were confirmed as missed by the user; `unlogged` days were simply left empty. */
  const days = (config: ChallengeConfig, missed: number[], unlogged: number[] = []) => (date: string): DayData => {
    const day = dayOf(date);
    if (missed.includes(day)) return { ...emptyDay(), checks: { [DAY_MISSED]: true } };
    return unlogged.includes(day) || date > '2026-09-10' ? emptyDay() : perfect(config);
  };

  it('fails 75 Hard on the first missed day', () => {
    const ev = evaluateChallenge({ startDate: start, config: HARD_CONFIG }, days(HARD_CONFIG, [5]), now);
    expect(ev.failedOnDay).toBe(5);
    expect(ev.days[4].state).toBe('missed');
    expect(ev.streak).toBe(5); // days 6–10
  });

  it('uses grace days before failing a soft challenge', () => {
    const config: ChallengeConfig = { ...SOFT_DEFAULTS, missedDay: { mode: 'grace', graceDays: 2 } };
    const ok = evaluateChallenge({ startDate: start, config }, days(config, [3, 6]), now);
    expect(ok.failedOnDay).toBeUndefined();
    expect(ok.graceUsed).toBe(2);
    expect(ok.days[2].state).toBe('grace');
    const bad = evaluateChallenge({ startDate: start, config }, days(config, [3, 6, 9]), now);
    expect(bad.failedOnDay).toBe(9);
  });

  it('never fails in log mode', () => {
    const config: ChallengeConfig = { ...SOFT_DEFAULTS, missedDay: { mode: 'log' } };
    const ev = evaluateChallenge({ startDate: start, config }, days(config, [1, 2, 3]), now);
    expect(ev.failedOnDay).toBeUndefined();
    expect(ev.completedDays).toBe(7);
    expect(ev.currentDay).toBe(11);
  });

  it('asks about unlogged days instead of failing them', () => {
    const ev = evaluateChallenge({ startDate: start, config: HARD_CONFIG }, days(HARD_CONFIG, [], [4, 5]), now);
    expect(ev.failedOnDay).toBeUndefined();
    expect(ev.needsReview.map((d) => d.day)).toEqual([4, 5]);
    expect(ev.days[3].state).toBe('review');
    expect(ev.completed).toBe(false);
  });

  it('counts a day confirmed as done even when nothing was logged', () => {
    const getDay = (date: string) =>
      dayOf(date) === 4 ? { ...emptyDay(), checks: { [DAY_CONFIRMED]: true } } : days(HARD_CONFIG, [])(date);
    const ev = evaluateChallenge({ startDate: start, config: HARD_CONFIG }, getDay, now);
    expect(ev.days[3]).toMatchObject({ state: 'complete', confirmed: true });
    expect(ev.days[3].tasks.every((t) => t.done)).toBe(true);
    expect(ev.needsReview).toHaveLength(0);
    expect(ev.streak).toBe(10);
  });

  it('keeps yesterday open (no prompt) until the cut-off', () => {
    const morning = new Date(2026, 8, 11, 8, 0);
    const ev = evaluateChallenge({ startDate: start, config: HARD_CONFIG }, days(HARD_CONFIG, [], [10]), morning);
    expect(ev.days[9].state).toBe('open');
    expect(ev.needsReview).toHaveLength(0);
  });

  it('completes after 75 perfect days', () => {
    const later = new Date(2026, 10, 20, 12);
    const ev = evaluateChallenge({ startDate: start, config: HARD_CONFIG }, () => perfect(HARD_CONFIG), later);
    expect(ev.completed).toBe(true);
    expect(ev.completedDays).toBe(75);
    expect(addDaysStr(start, 74)).toBe(ev.days[74].date);
  });
});
