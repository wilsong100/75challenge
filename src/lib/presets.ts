import type { ChallengeConfig } from '../types';

export const CHALLENGE_DAYS = 75;

export const HARD_CONFIG: ChallengeConfig = {
  workoutsPerDay: 2,
  workoutMinutes: 45,
  outdoorRequired: true,
  recoveryDaysPerWeek: 0,
  waterTargetMl: 3785,
  diet: 'strict',
  dietNote: '',
  alcohol: 'none',
  reading: { unit: 'pages', amount: 10, nonFictionOnly: true, audiobooksAllowed: false },
  photo: 'daily',
  missedDay: { mode: 'restart' },
  customTasks: [],
};

export const SOFT_DEFAULTS: ChallengeConfig = {
  workoutsPerDay: 1,
  workoutMinutes: 45,
  outdoorRequired: false,
  recoveryDaysPerWeek: 1,
  waterTargetMl: 3000,
  diet: 'eat-well',
  dietNote: '',
  alcohol: 'social',
  reading: { unit: 'pages', amount: 10, nonFictionOnly: false, audiobooksAllowed: false },
  photo: 'weekly',
  missedDay: { mode: 'grace', graceDays: 2 },
  customTasks: [],
};

export const HARD_RULES = [
  'Two 45-minute workouts a day – one must be outdoors',
  'Follow a diet of your choice – no cheat meals',
  'No alcohol',
  'Drink 3.8 L (1 gallon) of water',
  'Read 10 pages of a non-fiction book (no audiobooks)',
  'Progress photo every day (a reminder – it never fails a day)',
  'Miss anything and you restart at Day 1',
];

export const SOFT_RULES = [
  'One 45-minute workout a day, with one active-recovery day each week',
  'Eat well – drink alcohol only on social occasions',
  'Drink 3 L of water',
  'Read 10 pages of any book',
  'You choose the details on the next screen',
];

export function describeConfig(c: ChallengeConfig): string[] {
  const water = c.waterTargetMl >= 1000 ? `${+(c.waterTargetMl / 1000).toFixed(2)} L` : `${c.waterTargetMl} ml`;
  const lines = [
    `${c.workoutsPerDay === 2 ? 'Two' : 'One'} ${c.workoutMinutes}-minute workout${c.workoutsPerDay === 2 ? 's' : ''} a day${
      c.outdoorRequired ? ' (one outdoors)' : ''
    }`,
  ];
  if (c.recoveryDaysPerWeek > 0)
    lines.push(`${c.recoveryDaysPerWeek} active-recovery day${c.recoveryDaysPerWeek > 1 ? 's' : ''} per week`);
  lines.push(`Drink ${water} of water`);
  if (c.diet === 'strict') lines.push('Follow your diet – no cheat meals');
  if (c.diet === 'eat-well') lines.push('Eat well');
  if (c.dietNote) lines.push(`Diet: ${c.dietNote}`);
  if (c.alcohol === 'none') lines.push('No alcohol');
  if (c.alcohol === 'social') lines.push('Alcohol only on social occasions');
  const r = c.reading;
  lines.push(
    `Read ${r.amount} ${r.unit}${r.nonFictionOnly ? ' of non-fiction' : ''}${r.audiobooksAllowed ? ' (audiobooks OK)' : ''}`,
  );
  if (c.photo !== 'off') lines.push(`Progress photo reminder ${c.photo === 'daily' ? 'every day' : 'once a week'} (optional)`);
  c.customTasks.forEach((t) => lines.push(t));
  lines.push(
    c.missedDay.mode === 'restart'
      ? 'Miss a day → restart at Day 1'
      : c.missedDay.mode === 'grace'
        ? `${c.missedDay.graceDays} grace day${c.missedDay.graceDays > 1 ? 's' : ''}, then restart`
        : 'Missed days are logged, no restart',
  );
  return lines;
}

export const CUSTOM_TASK_IDEAS = [
  'Meditate 10 minutes',
  'No social media',
  'Cold shower',
  '10,000 steps',
  'No added sugar',
  'In bed by 10:30pm',
  'Stretch 10 minutes',
];
