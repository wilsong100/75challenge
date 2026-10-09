import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, withDefaults } from './db';
import { emptyDay, evaluateChallenge, reconcileStatus, type ChallengeEvaluation, type DayData } from '../lib/rules';
import { todayStr } from '../lib/dates';
import type { Challenge, Settings } from '../types';

/** Re-render every minute so "today", cut-offs and reminders stay current. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useSettings(): Settings {
  return withDefaults(useLiveQuery(() => db.settings.get('app'), []));
}

export interface AppData {
  loading: boolean;
  settings: Settings;
  challenges: Challenge[];
  /** The most recent attempt (active, failed or completed). */
  challenge?: Challenge;
  evaluation?: ChallengeEvaluation;
  getDay: (date: string) => DayData;
  today: string;
  now: Date;
}

export function useAppData(): AppData {
  const now = useNow();
  const today = todayStr(now);
  const settings = useSettings();
  const challenges = useLiveQuery(() => db.challenges.toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const water = useLiveQuery(() => db.water.toArray(), []);
  const reading = useLiveQuery(() => db.reading.toArray(), []);
  const checks = useLiveQuery(() => db.checks.toArray(), []);
  const photoDates = useLiveQuery(() => db.photos.orderBy('date').keys(), []);

  const dayMap = useMemo(() => {
    const map = new Map<string, DayData>();
    const get = (date: string) => {
      let d = map.get(date);
      if (!d) map.set(date, (d = emptyDay()));
      return d;
    };
    workouts?.forEach((w) => get(w.date).workouts.push(w));
    water?.forEach((w) => (get(w.date).waterMl += w.amountMl));
    reading?.forEach((r) => {
      const d = get(r.date);
      d.readingPages += r.pages || 0;
      d.readingMinutes += r.minutes || 0;
    });
    checks?.forEach((c) => (get(c.date).checks[c.key] = c.done));
    photoDates?.forEach((date) => (get(String(date)).hasPhoto = true));
    return map;
  }, [workouts, water, reading, checks, photoDates]);

  const getDay = useMemo(() => (date: string) => dayMap.get(date) ?? emptyDay(), [dayMap]);

  const sorted = useMemo(() => [...(challenges ?? [])].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)), [challenges]);
  const challenge = sorted[0];

  const evaluation = useMemo(
    () => (challenge ? evaluateChallenge(challenge, getDay, now, settings.cutoffHour, settings.units) : undefined),
    // `today` (not `now`) keeps this stable within a day except when cut-off hour passes
    [challenge, getDay, today, now.getHours(), settings.cutoffHour, settings.units],
  );

  // Keep the stored status in line with the rules: end, complete, or reopen the latest attempt.
  // Setting a field to undefined makes Dexie delete it.
  useEffect(() => {
    if (!challenge?.id || !evaluation) return;
    const update = reconcileStatus(challenge, evaluation);
    if (update) db.challenges.update(challenge.id, update);
  }, [challenge, evaluation]);

  const loading = [challenges, workouts, water, reading, checks, photoDates].some((x) => x === undefined);

  return { loading, settings, challenges: sorted, challenge, evaluation, getDay, today, now };
}
