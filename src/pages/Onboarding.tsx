import { useState } from 'react';
import { db, saveSettings } from '../db/db';
import { Button, Card, Field, Segmented, Toggle, cx, inputCls } from '../components/ui';
import {
  CUSTOM_TASK_IDEAS, HARD_CONFIG, HARD_RULES, SOFT_DEFAULTS, SOFT_RULES, describeConfig,
} from '../lib/presets';
import { todayStr } from '../lib/dates';
import { weightToKg, weightUnitLabel } from '../lib/units';
import type { ChallengeConfig, ChallengeType, Settings } from '../types';

type ReadingPreset = 'nf-pages' | 'any-pages' | 'audio-pages' | 'min-10' | 'min-20';
const READING_PRESETS: Record<ReadingPreset, { label: string; rule: ChallengeConfig['reading'] }> = {
  'nf-pages': { label: '10 pages non-fiction', rule: { unit: 'pages', amount: 10, nonFictionOnly: true, audiobooksAllowed: false } },
  'any-pages': { label: '10 pages, any book', rule: { unit: 'pages', amount: 10, nonFictionOnly: false, audiobooksAllowed: false } },
  'audio-pages': { label: '10 pages, audiobooks OK', rule: { unit: 'pages', amount: 10, nonFictionOnly: false, audiobooksAllowed: true } },
  'min-10': { label: '10 minutes', rule: { unit: 'minutes', amount: 10, nonFictionOnly: false, audiobooksAllowed: true } },
  'min-20': { label: '20 minutes', rule: { unit: 'minutes', amount: 20, nonFictionOnly: false, audiobooksAllowed: true } },
};

function readingPresetOf(r: ChallengeConfig['reading']): ReadingPreset {
  if (r.unit === 'minutes') return r.amount >= 20 ? 'min-20' : 'min-10';
  if (r.nonFictionOnly) return 'nf-pages';
  return r.audiobooksAllowed ? 'audio-pages' : 'any-pages';
}

type MissedKey = 'restart' | 'grace-1' | 'grace-2' | 'grace-3' | 'log';
const missedKey = (c: ChallengeConfig): MissedKey =>
  c.missedDay.mode === 'grace' ? (`grace-${c.missedDay.graceDays}` as MissedKey) : c.missedDay.mode;

export default function Onboarding({
  settings,
  previous,
  onCancel,
  onDone,
}: {
  settings: Settings;
  previous?: { type: ChallengeType; config: ChallengeConfig; attempt: number };
  onCancel?: () => void;
  onDone?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ChallengeType | null>(previous?.type ?? null);
  const [config, setConfig] = useState<ChallengeConfig>(
    previous?.type === 'soft' ? previous.config : SOFT_DEFAULTS,
  );
  const [name, setName] = useState(settings.name);
  const [units, setUnits] = useState(settings.units);
  const [startDate, setStartDate] = useState(todayStr());
  const [weight, setWeight] = useState('');
  const [customDraft, setCustomDraft] = useState('');
  const [waterCustom, setWaterCustom] = useState(false);

  const finalConfig = type === 'hard' ? HARD_CONFIG : config;
  const set = (patch: Partial<ChallengeConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const steps = type === 'soft' ? ['version', 'rules', 'details', 'confirm'] : ['version', 'details', 'confirm'];
  const current = steps[step];

  const addCustom = (t: string) => {
    const v = t.trim();
    if (v && !config.customTasks.includes(v)) set({ customTasks: [...config.customTasks, v] });
    setCustomDraft('');
  };

  async function start() {
    await saveSettings({ name: name.trim(), units });
    const w = parseFloat(weight);
    if (w > 0) await db.bodyStats.put({ ...(await db.bodyStats.get(startDate)), date: startDate, weightKg: weightToKg(w, units) });
    await db.challenges.where('status').equals('active').modify({ status: 'abandoned', endDate: startDate });
    await db.challenges.add({
      type: type!,
      config: finalConfig,
      startDate,
      status: 'active',
      attempt: (previous?.attempt ?? 0) + 1,
      createdAt: Date.now(),
    });
    onDone?.();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pt-safe">
      <div className="flex gap-1.5 mb-6">
        {steps.map((s, i) => (
          <div key={s} className={cx('h-1 flex-1 rounded-full', i <= step ? 'bg-accent' : 'bg-slate-800')} />
        ))}
      </div>

      {current === 'version' && (
        <>
          <h1 className="text-3xl font-extrabold text-white">
            {previous ? 'Start a new challenge' : 'Welcome to your 75 Day Challenge'}
          </h1>
          <p className="text-slate-400 mt-2 mb-6">Which version are you doing?</p>
          {(['hard', 'soft'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cx(
                'w-full text-left rounded-2xl border p-4 mb-4 transition',
                type === t ? 'border-accent bg-accent/10' : 'border-slate-800 bg-slate-900 hover:border-slate-600',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-white">75 {t === 'hard' ? 'Hard' : 'Soft'}</span>
                <span className="text-xs rounded-full px-2 py-1 bg-slate-800 text-slate-300">
                  {t === 'hard' ? 'Strict rules' : 'Customisable'}
                </span>
              </div>
              <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                {(t === 'hard' ? HARD_RULES : SOFT_RULES).map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="text-accent">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </>
      )}

      {current === 'rules' && (
        <>
          <h1 className="text-2xl font-bold text-white">Customise 75 Soft</h1>
          <p className="text-slate-400 mt-1 mb-5">Defaults are the standard 75 Soft rules. Change anything you like.</p>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-3">🏋️ Workouts</h3>
            <Field label="Workouts per day">
              <Segmented value={config.workoutsPerDay} onChange={(v) => set({ workoutsPerDay: v })}
                options={[{ value: 1, label: 'One' }, { value: 2, label: 'Two' }]} />
            </Field>
            <Field label="Minimum length">
              <Segmented value={config.workoutMinutes} onChange={(v) => set({ workoutMinutes: v })}
                options={[30, 45, 60].map((m) => ({ value: m, label: `${m} min` }))} />
            </Field>
            <Field label="Active-recovery days per week" hint="A walk, stretch or yoga session counts as your workout on these days.">
              <Segmented value={config.recoveryDaysPerWeek} onChange={(v) => set({ recoveryDaysPerWeek: v })}
                options={[0, 1, 2].map((n) => ({ value: n, label: n === 0 ? 'None' : `${n}` }))} />
            </Field>
            <Toggle checked={config.outdoorRequired} onChange={(v) => set({ outdoorRequired: v })} label="One workout must be outdoors" />
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-3">💧 Water</h3>
            <Segmented
              value={waterCustom ? -1 : config.waterTargetMl}
              onChange={(v) => {
                setWaterCustom(v === -1);
                if (v !== -1) set({ waterTargetMl: v });
              }}
              options={[
                { value: 2000, label: '2 L' },
                { value: 2500, label: '2.5 L' },
                { value: 3000, label: '3 L' },
                { value: 3785, label: '3.8 L (1 gal)' },
                { value: -1, label: 'Custom' },
              ]}
            />
            {waterCustom && (
              <input type="number" className={cx(inputCls, 'mt-3')} placeholder="Target in ml"
                value={config.waterTargetMl} onChange={(e) => set({ waterTargetMl: Math.max(250, +e.target.value || 0) })} />
            )}
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-3">🥗 Diet & alcohol</h3>
            <Field label="Diet rule">
              <Segmented value={config.diet} onChange={(v) => set({ diet: v })}
                options={[{ value: 'strict', label: 'Strict plan, no cheat meals' }, { value: 'eat-well', label: 'Eat well' }, { value: 'none', label: 'No diet rule' }]} />
            </Field>
            {config.diet !== 'none' && (
              <Field label="Your diet (optional)" hint="e.g. high protein, no processed food, 2,000 kcal">
                <input className={inputCls} value={config.dietNote} onChange={(e) => set({ dietNote: e.target.value })} />
              </Field>
            )}
            <Field label="Alcohol">
              <Segmented value={config.alcohol} onChange={(v) => set({ alcohol: v })}
                options={[{ value: 'none', label: 'None' }, { value: 'social', label: 'Social occasions only' }, { value: 'no-rule', label: 'No rule' }]} />
            </Field>
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-3">📖 Reading</h3>
            <Segmented value={readingPresetOf(config.reading)} onChange={(v) => set({ reading: READING_PRESETS[v].rule })}
              options={(Object.keys(READING_PRESETS) as ReadingPreset[]).map((k) => ({ value: k, label: READING_PRESETS[k].label }))} />
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-1">📸 Progress photo reminder</h3>
            <p className="text-sm text-slate-400 mb-3">Just a nudge – a missing photo never counts against a day.</p>
            <Segmented value={config.photo} onChange={(v) => set({ photo: v })}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'off', label: 'Off' }]} />
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-3">⏪ If I miss a day</h3>
            <Segmented
              value={missedKey(config)}
              onChange={(v) =>
                set({
                  missedDay: v === 'restart' || v === 'log' ? { mode: v } : { mode: 'grace', graceDays: +v.split('-')[1] },
                })
              }
              options={[
                { value: 'restart', label: 'Restart at Day 1' },
                { value: 'grace-1', label: '1 grace day' },
                { value: 'grace-2', label: '2 grace days' },
                { value: 'grace-3', label: '3 grace days' },
                { value: 'log', label: 'Just log it' },
              ]}
            />
          </Card>

          <Card className="mb-4">
            <h3 className="font-semibold text-white mb-1">➕ Extra daily tasks</h3>
            <p className="text-sm text-slate-400 mb-3">Optional habits to tick off each day.</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {config.customTasks.map((t) => (
                <span key={t} className="rounded-full bg-accent/15 text-orange-300 px-3 py-1 text-sm">
                  {t}{' '}
                  <button className="ml-1" aria-label={`Remove ${t}`} onClick={() => set({ customTasks: config.customTasks.filter((x) => x !== t) })}>✕</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={inputCls} placeholder="Add your own…" value={customDraft}
                onChange={(e) => setCustomDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustom(customDraft)} />
              <Button variant="soft" onClick={() => addCustom(customDraft)}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {CUSTOM_TASK_IDEAS.filter((i) => !config.customTasks.includes(i)).map((i) => (
                <button key={i} onClick={() => addCustom(i)} className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400 hover:border-slate-500">
                  + {i}
                </button>
              ))}
            </div>
          </Card>
        </>
      )}

      {current === 'details' && (
        <>
          <h1 className="text-2xl font-bold text-white mb-5">A few details</h1>
          <Field label="Your name (optional)">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Units">
            <Segmented value={units} onChange={setUnits}
              options={[{ value: 'metric', label: 'Metric (L, kg)' }, { value: 'imperial', label: 'Imperial (oz, lb)' }]} />
          </Field>
          <Field label="Start date" hint="Day 1 of 75">
            <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value || todayStr())} />
          </Field>
          <Field label={`Starting weight (${weightUnitLabel(units)}, optional)`}>
            <input type="number" inputMode="decimal" className={inputCls} value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
        </>
      )}

      {current === 'confirm' && (
        <>
          <h1 className="text-2xl font-bold text-white">Your rules</h1>
          <p className="text-slate-400 mt-1 mb-5">75 {type === 'hard' ? 'Hard' : 'Soft'} · starting {startDate}</p>
          <Card>
            <ul className="space-y-2">
              {describeConfig(finalConfig).map((l) => (
                <li key={l} className="flex gap-2 text-slate-200">
                  <span className="text-accent">✓</span>
                  {l}
                </li>
              ))}
            </ul>
          </Card>
          <p className="text-sm text-slate-500 mt-4">
            Forgot to log a day? No problem – the app asks you to catch up and never marks a day as missed unless you say so.
          </p>
        </>
      )}

      <div className="flex gap-3 mt-8">
        {step > 0 ? (
          <Button variant="soft" onClick={() => setStep(step - 1)}>Back</Button>
        ) : (
          onCancel && <Button variant="soft" onClick={onCancel}>Cancel</Button>
        )}
        {current === 'confirm' ? (
          <Button className="flex-1" onClick={start}>Start Day 1 🚀</Button>
        ) : (
          <Button className="flex-1" disabled={!type} onClick={() => setStep(step + 1)}>Continue</Button>
        )}
      </div>
    </div>
  );
}
