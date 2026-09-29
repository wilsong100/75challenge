import Dexie, { type EntityTable } from 'dexie';
import type {
  BodyStat, Book, Challenge, Check, JournalEntry, Meal, Photo, ReadingEntry, Settings, WaterEntry, Workout,
} from '../types';

/**
 * All logs are keyed by calendar date rather than by challenge, so a restart keeps
 * everything already logged today and a challenge is simply a date window + rule set.
 */
export class ChallengeDB extends Dexie {
  challenges!: EntityTable<Challenge, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  meals!: EntityTable<Meal, 'id'>;
  water!: EntityTable<WaterEntry, 'id'>;
  reading!: EntityTable<ReadingEntry, 'id'>;
  books!: EntityTable<Book, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  checks!: Dexie.Table<Check, [string, string]>;
  bodyStats!: EntityTable<BodyStat, 'date'>;
  journal!: EntityTable<JournalEntry, 'date'>;
  settings!: EntityTable<Settings, 'id'>;

  constructor(name = 'challenge75') {
    super(name);
    this.version(1).stores({
      challenges: '++id, status, startDate',
      workouts: '++id, date',
      meals: '++id, date',
      water: '++id, date',
      reading: '++id, date, bookId',
      books: '++id, status',
      photos: '++id, date',
      checks: '[date+key], date',
      bodyStats: 'date',
      journal: 'date',
      settings: 'id',
    });
  }
}

export const db = new ChallengeDB();

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  name: '',
  units: 'metric',
  cutoffHour: 10,
  reminders: {
    enabled: false,
    waterEveryHours: 2,
    waterFrom: '08:00',
    waterTo: '20:00',
    workout: '07:00',
    reading: '21:00',
    endOfDay: '20:30',
  },
};

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('app')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>) {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'app' });
}

export async function setCheck(date: string, key: string, done: boolean) {
  await db.checks.put({ date, key, done });
}

/** Active challenge first, otherwise the most recent attempt. */
export async function latestChallenge(): Promise<Challenge | undefined> {
  const all = await db.challenges.toArray();
  return all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0];
}

export async function restartChallenge(prev: Challenge, startDate: string) {
  if (prev.id && prev.status === 'active') await db.challenges.update(prev.id, { status: 'abandoned', endDate: startDate });
  return db.challenges.add({
    type: prev.type,
    config: prev.config,
    startDate,
    status: 'active',
    attempt: prev.attempt + 1,
    createdAt: Date.now(),
  });
}
