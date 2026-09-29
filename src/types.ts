export type ChallengeType = 'hard' | 'soft';
export type Units = 'metric' | 'imperial';

export type MissedDayPolicy =
  | { mode: 'restart' }
  | { mode: 'grace'; graceDays: number }
  | { mode: 'log' };

export interface ReadingRule {
  unit: 'pages' | 'minutes';
  amount: number;
  nonFictionOnly: boolean;
  audiobooksAllowed: boolean;
}

export interface ChallengeConfig {
  workoutsPerDay: 1 | 2;
  workoutMinutes: number;
  outdoorRequired: boolean;
  /** Days per 7-day block where a logged active-recovery session satisfies the workout task. */
  recoveryDaysPerWeek: number;
  waterTargetMl: number;
  diet: 'strict' | 'eat-well' | 'none';
  dietNote: string;
  alcohol: 'none' | 'social' | 'no-rule';
  reading: ReadingRule;
  photo: 'daily' | 'weekly' | 'off';
  missedDay: MissedDayPolicy;
  customTasks: string[];
}

export type ChallengeStatus = 'active' | 'failed' | 'completed' | 'abandoned';

export interface Challenge {
  id?: number;
  type: ChallengeType;
  config: ChallengeConfig;
  /** yyyy-MM-dd */
  startDate: string;
  status: ChallengeStatus;
  attempt: number;
  failedOnDay?: number;
  endDate?: string;
  createdAt: number;
}

export const WORKOUT_KINDS = [
  'Walk', 'Run', 'Gym / weights', 'Cycling', 'Swim', 'HIIT', 'Sport', 'Yoga', 'Pilates', 'Hike', 'Other',
] as const;

export interface Workout {
  id?: number;
  date: string;
  kind: string;
  durationMin: number;
  outdoor: boolean;
  /** Active-recovery session (walk, stretch, yoga) – counts only on allowed recovery days. */
  recovery: boolean;
  distanceKm?: number;
  calories?: number;
  notes?: string;
  createdAt: number;
}

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface Meal {
  id?: number;
  date: string;
  time: string;
  mealType: MealType;
  name: string;
  calories?: number;
  proteinG?: number;
  onPlan: boolean;
  notes?: string;
  createdAt: number;
}

export interface WaterEntry {
  id?: number;
  date: string;
  amountMl: number;
  createdAt: number;
}

export interface ReadingEntry {
  id?: number;
  date: string;
  pages: number;
  minutes: number;
  bookId?: number;
  audiobook: boolean;
  createdAt: number;
}

export interface Book {
  id?: number;
  title: string;
  author: string;
  nonFiction: boolean;
  status: 'reading' | 'finished';
  finishedDate?: string;
  createdAt: number;
}

export type Pose = 'front' | 'side' | 'back';

export interface Photo {
  id?: number;
  date: string;
  pose: Pose;
  blob: Blob;
  createdAt: number;
}

/** Yes/no confirmations for a day: 'diet', 'alcohol', 'custom:<name>'. */
export interface Check {
  date: string;
  key: string;
  done: boolean;
}

export interface BodyStat {
  date: string;
  weightKg?: number;
  waistCm?: number;
  chestCm?: number;
  hipsCm?: number;
  armCm?: number;
  sleepHrs?: number;
  mood?: number;
  energy?: number;
}

export interface JournalEntry {
  date: string;
  text: string;
  win: string;
  updatedAt: number;
}

export interface ReminderSettings {
  enabled: boolean;
  waterEveryHours: number;
  waterFrom: string;
  waterTo: string;
  workout: string;
  reading: string;
  endOfDay: string;
}

export interface Settings {
  id: 'app';
  name: string;
  units: Units;
  /** Hour of the next morning until which the previous day can still be completed. */
  cutoffHour: number;
  reminders: ReminderSettings;
}
