import type { ChallengeEvaluation } from './rules';

export interface Badge {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
}

export interface BadgeStats {
  evaluation?: ChallengeEvaluation;
  totalWorkouts: number;
  outdoorWorkouts: number;
  waterDaysHit: number;
  booksFinished: number;
  photoCount: number;
  journalEntries: number;
  bestStreak: number;
}

export function computeBadges(s: BadgeStats): Badge[] {
  const done = s.evaluation?.completedDays ?? 0;
  const milestones: [number, string, string][] = [
    [1, '🌱', 'Day One'],
    [7, '🔥', 'First Week'],
    [14, '💪', 'Two Weeks Strong'],
    [21, '🧠', 'Habit Formed'],
    [30, '🏅', 'One Month'],
    [50, '🚀', 'Fifty Days'],
    [75, '🏆', 'Challenge Complete'],
  ];
  const badges: Badge[] = milestones.map(([n, icon, title]) => ({
    id: `days-${n}`,
    icon,
    title,
    description: `Complete ${n} day${n > 1 ? 's' : ''} of the current challenge`,
    earned: done >= n,
  }));
  badges.push(
    { id: 'perfect-week', icon: '⭐', title: 'Perfect Week', description: '7 complete days in a row', earned: s.bestStreak >= 7 },
    { id: 'streak-30', icon: '⚡', title: 'Unbreakable', description: '30 complete days in a row', earned: s.bestStreak >= 30 },
    { id: 'hydration', icon: '💧', title: 'Hydration Hero', description: 'Hit your water target on 30 days', earned: s.waterDaysHit >= 30 },
    { id: 'workouts-50', icon: '🏋️', title: 'Fifty Sessions', description: 'Log 50 workouts', earned: s.totalWorkouts >= 50 },
    { id: 'workouts-100', icon: '🦾', title: 'Century', description: 'Log 100 workouts', earned: s.totalWorkouts >= 100 },
    { id: 'outdoor-25', icon: '🌦️', title: 'Weatherproof', description: 'Log 25 outdoor workouts', earned: s.outdoorWorkouts >= 25 },
    { id: 'book-1', icon: '📖', title: 'Bookworm', description: 'Finish a book', earned: s.booksFinished >= 1 },
    { id: 'book-3', icon: '📚', title: 'Library Card', description: 'Finish 3 books', earned: s.booksFinished >= 3 },
    { id: 'photo-1', icon: '📸', title: 'Snapshot', description: 'Take your first progress photo', earned: s.photoCount >= 1 },
    { id: 'journal-10', icon: '✍️', title: 'Reflective', description: 'Write 10 journal entries', earned: s.journalEntries >= 10 },
  );
  return badges;
}

export function bestStreak(evaluation?: ChallengeEvaluation): number {
  let best = 0;
  let run = 0;
  for (const d of evaluation?.days ?? []) {
    run = d.complete ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}
