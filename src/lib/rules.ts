import type { Challenge, ChallengeConfig, Units, Workout } from '../types';
import { CHALLENGE_DAYS } from './presets';
import { addDaysStr, diffDays, todayStr } from './dates';
import { formatWater } from './units';

/** Everything logged for one calendar date, reduced to what the rules need. */
export interface DayData {
  workouts: Workout[];
  waterMl: number;
  readingPages: number;
  readingMinutes: number;
  hasPhoto: boolean;
  checks: Record<string, boolean>;
}

export const emptyDay = (): DayData => ({
  workouts: [],
  waterMl: 0,
  readingPages: 0,
  readingMinutes: 0,
  hasPhoto: false,
  checks: {},
});

export type TaskKey = 'workout' | 'water' | 'diet' | 'alcohol' | 'reading' | 'photo' | `custom:${string}`;

export interface TaskStatus {
  key: TaskKey;
  label: string;
  detail: string;
  done: boolean;
  /** 0..1 */
  progress: number;
}

export interface DayEvaluation {
  tasks: TaskStatus[];
  complete: boolean;
  usedRecovery: boolean;
}

export const dayNumber = (startDate: string, date: string) => diffDays(date, startDate) + 1;
export const dateForDay = (startDate: string, day: number) => addDaysStr(startDate, day - 1);
export const weekIndex = (day: number) => Math.floor((day - 1) / 7);

export const photoRequired = (config: ChallengeConfig, day: number) =>
  config.photo === 'daily' || (config.photo === 'weekly' && (day - 1) % 7 === 0);

export const dietLabel = (config: ChallengeConfig) =>
  config.diet === 'strict'
    ? 'Followed my diet – no cheat meals'
    : config.diet === 'eat-well'
      ? 'Ate well today'
      : '';

export const alcoholLabel = (config: ChallengeConfig) =>
  config.alcohol === 'none' ? 'No alcohol' : config.alcohol === 'social' ? 'Alcohol only if social occasion' : '';

export function evaluateDay(
  config: ChallengeConfig,
  day: number,
  data: DayData,
  recoveryUsedThisWeek: number,
  units: Units = 'metric',
): DayEvaluation {
  const tasks: TaskStatus[] = [];

  // Workouts
  const qualifying = data.workouts.filter((w) => !w.recovery && w.durationMin >= config.workoutMinutes);
  const hasOutdoor = qualifying.some((w) => w.outdoor);
  let workoutDone = qualifying.length >= config.workoutsPerDay && (!config.outdoorRequired || hasOutdoor);
  let usedRecovery = false;
  const hasRecovery = data.workouts.some((w) => w.recovery);
  if (!workoutDone && hasRecovery && recoveryUsedThisWeek < config.recoveryDaysPerWeek) {
    workoutDone = true;
    usedRecovery = true;
  }
  const count = Math.min(qualifying.length, config.workoutsPerDay);
  let workoutProgress = count / config.workoutsPerDay;
  if (config.outdoorRequired && !hasOutdoor && workoutProgress === 1) workoutProgress = 0.75;
  const detailParts = [`${count}/${config.workoutsPerDay} × ${config.workoutMinutes} min`];
  if (config.outdoorRequired) detailParts.push(hasOutdoor ? 'outdoor ✓' : 'outdoor needed');
  tasks.push({
    key: 'workout',
    label: config.workoutsPerDay === 2 ? 'Two workouts' : 'Workout',
    detail: usedRecovery ? 'Active recovery day' : detailParts.join(' · '),
    done: workoutDone,
    progress: workoutDone ? 1 : workoutProgress,
  });

  // Water
  tasks.push({
    key: 'water',
    label: 'Water',
    detail: `${formatWater(data.waterMl, units)} / ${formatWater(config.waterTargetMl, units)}`,
    done: data.waterMl >= config.waterTargetMl,
    progress: Math.min(data.waterMl / config.waterTargetMl, 1),
  });

  // Diet & alcohol are self-confirmed
  if (config.diet !== 'none') {
    const done = !!data.checks.diet;
    tasks.push({ key: 'diet', label: 'Diet', detail: dietLabel(config), done, progress: done ? 1 : 0 });
  }
  if (config.alcohol !== 'no-rule') {
    const done = !!data.checks.alcohol;
    tasks.push({ key: 'alcohol', label: 'Alcohol', detail: alcoholLabel(config), done, progress: done ? 1 : 0 });
  }

  // Reading
  const read = config.reading.unit === 'pages' ? data.readingPages : data.readingMinutes;
  tasks.push({
    key: 'reading',
    label: 'Reading',
    detail: `${read}/${config.reading.amount} ${config.reading.unit}`,
    done: read >= config.reading.amount,
    progress: Math.min(read / config.reading.amount, 1),
  });

  // Photo
  if (photoRequired(config, day)) {
    tasks.push({
      key: 'photo',
      label: 'Progress photo',
      detail: config.photo === 'weekly' ? 'Weekly photo day' : 'Daily photo',
      done: data.hasPhoto,
      progress: data.hasPhoto ? 1 : 0,
    });
  }

  for (const name of config.customTasks) {
    const key = `custom:${name}` as const;
    const done = !!data.checks[key];
    tasks.push({ key, label: name, detail: 'Custom task', done, progress: done ? 1 : 0 });
  }

  return { tasks, complete: tasks.every((t) => t.done), usedRecovery };
}

export type DayState = 'complete' | 'partial' | 'missed' | 'grace' | 'today' | 'future' | 'open';

export interface DayResult extends DayEvaluation {
  day: number;
  date: string;
  state: DayState;
  /** Past its cut-off – can no longer be completed. */
  final: boolean;
}

export interface ChallengeEvaluation {
  days: DayResult[];
  /** Day number that ended the attempt, if the rules say it failed. */
  failedOnDay?: number;
  completed: boolean;
  currentDay: number;
  completedDays: number;
  graceUsed: number;
  streak: number;
}

/** A date is final once the next morning's cut-off hour has passed. */
export function isFinal(date: string, now: Date, cutoffHour: number): boolean {
  const today = todayStr(now);
  const gap = diffDays(today, date);
  if (gap >= 2) return true;
  if (gap === 1) return now.getHours() >= cutoffHour;
  return false;
}

export function evaluateChallenge(
  challenge: Pick<Challenge, 'startDate' | 'config'>,
  getDay: (date: string) => DayData,
  now: Date = new Date(),
  cutoffHour = 10,
  units: Units = 'metric',
): ChallengeEvaluation {
  const { config, startDate } = challenge;
  const today = todayStr(now);
  const days: DayResult[] = [];
  const recoveryPerWeek: number[] = [];
  let failed = 0;
  let failedOnDay: number | undefined;
  let graceUsed = 0;
  const graceAllowed = config.missedDay.mode === 'grace' ? config.missedDay.graceDays : 0;

  for (let day = 1; day <= CHALLENGE_DAYS; day++) {
    const date = dateForDay(startDate, day);
    const wk = weekIndex(day);
    const used = recoveryPerWeek[wk] ?? 0;
    const ev = evaluateDay(config, day, getDay(date), used, units);
    if (ev.usedRecovery) recoveryPerWeek[wk] = used + 1;
    const final = isFinal(date, now, cutoffHour);
    let state: DayState;
    if (ev.complete) state = 'complete';
    else if (date > today) state = 'future';
    else if (date === today) state = 'today';
    else if (!final) state = 'open';
    else {
      failed++;
      if (config.missedDay.mode === 'grace' && failed <= graceAllowed) {
        state = 'grace';
        graceUsed++;
      } else {
        state = 'missed';
        if (failedOnDay === undefined && config.missedDay.mode !== 'log') failedOnDay = day;
      }
    }
    if (state === 'today' && ev.tasks.some((t) => t.progress > 0)) state = 'partial';
    days.push({ ...ev, day, date, state, final });
  }

  const currentDay = Math.max(1, Math.min(dayNumber(startDate, today), CHALLENGE_DAYS));
  const last = days[CHALLENGE_DAYS - 1];
  const completed = failedOnDay === undefined && (last.complete || last.final);

  // Streak: consecutive complete days ending today (or yesterday if today isn't done yet).
  let streak = 0;
  let i = Math.min(dayNumber(startDate, today), CHALLENGE_DAYS) - 1;
  if (i >= 0 && i < CHALLENGE_DAYS && !days[i].complete) i--;
  for (; i >= 0 && days[i].complete; i--) streak++;

  return {
    days,
    failedOnDay,
    completed,
    currentDay,
    completedDays: days.filter((d) => d.complete).length,
    graceUsed,
    streak,
  };
}
