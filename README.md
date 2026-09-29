# 75 Day Challenge

An installable web app (PWA) for tracking **75 Hard** or a customised **75 Soft** challenge.
Works offline and installs to your phone's home screen. All data stays on your device.

## Features
- **Setup:** choose 75 Hard (fixed rules) or 75 Soft. For Soft you pick workouts per day, length,
  outdoor rule, active-recovery days, water target, diet and alcohol rules, reading rule,
  photo frequency, missed-day policy (restart / 1–3 grace days / just log) and extra daily habits.
- **Today:** live checklist for the day, quick water buttons, log workouts, meals, reading
  (with a book log), progress photos, body stats (weight, measurements, sleep, mood, energy) and a journal.
- **Rules enforced:** 75 Hard sends you back to Day 1 when a day is missed (all history kept).
  You can still finish yesterday until a cut-off hour the next morning (default 10:00, set in Settings).
- **Calendar:** colour-coded days (complete / in progress / missed / grace); tap any day to view or edit it.
- **Progress:** daily completion, water vs target, weekly workout minutes, weight, measurements,
  mood/energy/sleep, plus stat tiles.
- **Photos:** gallery by pose with a before/after comparison slider.
- **More:** badges, journal history, books, past attempts, settings, reminders, backup/restore.
- **Reminders:** in-app notifications while the app is open, plus an `.ics` export that adds daily
  reminders to your phone's calendar.

## Run locally
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for the rules engine
npm run build      # production build in dist/
```

## Deploy (Netlify or Vercel)
Both configs are included (`netlify.toml`, `vercel.json`).
1. Sign in to Netlify or Vercel with GitHub and import this repository.
2. Build command `npm run build`, output directory `dist` (auto-detected).
3. Open the URL on your phone → Share → **Add to Home Screen** (iOS) or **Install app** (Android).

## Your data
Data is stored in the browser's IndexedDB on that device only. Use **More → Settings → Export**
regularly for a backup (includes photos). Clearing browser data will delete it.

## Code map
- `src/lib/rules.ts` – rules engine (day evaluation, grace days, restarts, streaks) + tests
- `src/lib/presets.ts` – 75 Hard rules and 75 Soft defaults
- `src/db/` – Dexie database and the `useAppData` hook (swap for a cloud backend later)
- `src/pages/` – Onboarding, Today (`DayView`), Calendar, Progress, Photos, More
