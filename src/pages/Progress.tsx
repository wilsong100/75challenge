import { useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { db } from '../db/db';
import { useApp } from '../AppContext';
import { Card, PageHeader, Stat } from '../components/ui';
import { prettyDate } from '../lib/dates';
import { CHALLENGE_DAYS } from '../lib/presets';
import { bestStreak } from '../lib/badges';
import {
  cmToLengthUnit, formatWater, kgToWeightUnit, lengthUnitLabel, mlToWaterUnit, round1, waterUnitLabel, weightUnitLabel,
} from '../lib/units';

// Categorical slots (dark-surface steps of the validated reference palette), fixed order.
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];
const GRID = '#1e293b';
const AXIS = { fill: '#94a3b8', fontSize: 11 };
const tooltipProps = {
  contentStyle: { background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0', fontSize: 12 },
  labelStyle: { color: '#94a3b8' },
  itemStyle: { color: '#e2e8f0' },
  cursor: { fill: 'rgba(148,163,184,0.08)', stroke: '#475569' },
};

function ChartCard({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: ReactNode; empty?: boolean }) {
  return (
    <Card className="mb-4">
      <h3 className="font-semibold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mb-2">{subtitle}</p>}
      {empty ? (
        <p className="text-sm text-slate-500 py-8 text-center">Nothing logged yet.</p>
      ) : (
        <div className="h-52 -ml-3 mt-2">
          <ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export default function Progress() {
  const { challenge, evaluation, getDay, settings, today } = useApp();
  const units = settings.units;
  const body = useLiveQuery(() => db.bodyStats.orderBy('date').toArray(), []);
  const workouts = useLiveQuery(() => db.workouts.toArray(), []);
  const books = useLiveQuery(() => db.books.where('status').equals('finished').count(), []);

  const upToToday = useMemo(() => evaluation?.days.filter((d) => d.date <= today) ?? [], [evaluation, today]);

  const daily = useMemo(
    () =>
      upToToday.map((d) => {
        const data = getDay(d.date);
        return {
          day: d.day,
          label: `Day ${d.day} · ${prettyDate(d.date)}`,
          pct: Math.round((d.tasks.filter((t) => t.done).length / d.tasks.length) * 100),
          water: round1(mlToWaterUnit(data.waterMl, units)),
          pages: data.readingPages,
        };
      }),
    [upToToday, getDay, units],
  );

  const weekly = useMemo(() => {
    const weeks: { week: string; minutes: number; sessions: number }[] = [];
    upToToday.forEach((d) => {
      const i = Math.floor((d.day - 1) / 7);
      weeks[i] ??= { week: `W${i + 1}`, minutes: 0, sessions: 0 };
      getDay(d.date).workouts.forEach((w) => {
        weeks[i].minutes += w.durationMin;
        weeks[i].sessions++;
      });
    });
    return weeks;
  }, [upToToday, getDay]);

  const weights = (body ?? [])
    .filter((b) => b.weightKg)
    .map((b) => ({ label: prettyDate(b.date), weight: round1(kgToWeightUnit(b.weightKg!, units)) }));
  const measures = (body ?? [])
    .filter((b) => b.waistCm || b.chestCm || b.hipsCm || b.armCm)
    .map((b) => {
      const l = (v?: number) => (v ? round1(cmToLengthUnit(v, units)) : undefined);
      return { label: prettyDate(b.date), Waist: l(b.waistCm), Chest: l(b.chestCm), Hips: l(b.hipsCm), Arm: l(b.armCm) };
    });
  const wellbeing = (body ?? [])
    .filter((b) => b.mood || b.energy || b.sleepHrs)
    .map((b) => ({ label: prettyDate(b.date), Mood: b.mood, Energy: b.energy, Sleep: b.sleepHrs }));

  if (!challenge || !evaluation) return null;

  const totalWater = daily.reduce((s, d) => s + getDay(upToToday[d.day - 1].date).waterMl, 0);
  const totalPages = daily.reduce((s, d) => s + d.pages, 0);
  const firstW = weights[0]?.weight;
  const lastW = weights[weights.length - 1]?.weight;
  const waterTarget = round1(mlToWaterUnit(challenge.config.waterTargetMl, units));
  const wu = waterUnitLabel(units);

  return (
    <div>
      <PageHeader title="Progress" subtitle={`Attempt ${challenge.attempt} · ${evaluation.completedDays}/${CHALLENGE_DAYS} days complete`} />

      <div className="mb-4">
        <div className="flex justify-between text-sm text-slate-400 mb-1">
          <span>Challenge progress</span>
          <span>{Math.round((evaluation.completedDays / CHALLENGE_DAYS) * 100)}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: `${(evaluation.completedDays / CHALLENGE_DAYS) * 100}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Current streak" value={`🔥 ${evaluation.streak}`} sub={`best ${bestStreak(evaluation)}`} />
        <Stat label="Workouts" value={workouts?.length ?? 0} sub={`${round1((workouts ?? []).reduce((s, w) => s + w.durationMin, 0) / 60)} h total`} />
        <Stat label="Water" value={formatWater(totalWater, units)} sub="this attempt" />
        <Stat label="Pages read" value={totalPages} sub={`${books ?? 0} book${books === 1 ? '' : 's'} finished`} />
        <Stat label="Weight change" value={firstW !== undefined && lastW !== undefined ? `${lastW - firstW > 0 ? '+' : ''}${round1(lastW - firstW)}` : '–'} sub={weightUnitLabel(units)} />
        <Stat label="Grace days used" value={evaluation.graceUsed} sub={challenge.config.missedDay.mode === 'grace' ? `of ${challenge.config.missedDay.graceDays}` : 'n/a'} />
      </div>

      <ChartCard title="Daily completion" subtitle="% of tasks done each day" empty={!daily.length}>
        <BarChart data={daily} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} tickLine={false} axisLine={false} width={40} unit="%" />
          <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload.label} formatter={(v) => [`${v}%`, 'Tasks done']} />
          <Bar maxBarSize={28} dataKey="pct" fill={SERIES[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title={`Water (${wu})`} subtitle={`Dashed line = your ${formatWater(challenge.config.waterTargetMl, units)} target`} empty={!daily.length}>
        <BarChart data={daily} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis domain={[0, (max: number) => Math.max(max, waterTarget)]} tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip {...tooltipProps} labelFormatter={(_, p) => p?.[0]?.payload.label} formatter={(v) => [`${v} ${wu}`, 'Water']} />
          <ReferenceLine y={waterTarget} stroke="#94a3b8" strokeDasharray="4 4" />
          <Bar maxBarSize={28} dataKey="water" fill={SERIES[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title="Workout minutes per week" empty={!weekly.some((w) => w.sessions)}>
        <BarChart data={weekly}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip {...tooltipProps} formatter={(v, _, p) => [`${v} min · ${p.payload.sessions} sessions`, 'Workouts']} />
          <Bar maxBarSize={48} dataKey="minutes" fill={SERIES[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartCard>

      <ChartCard title={`Weight (${weightUnitLabel(units)})`} empty={!weights.length}>
        <LineChart data={weights}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip {...tooltipProps} formatter={(v) => [`${v} ${weightUnitLabel(units)}`, 'Weight']} />
          <Line dataKey="weight" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#0f172a', fill: SERIES[1] }} />
        </LineChart>
      </ChartCard>

      <ChartCard title={`Measurements (${lengthUnitLabel(units)})`} empty={!measures.length}>
        <LineChart data={measures}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} />
          <Tooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          {['Waist', 'Chest', 'Hips', 'Arm'].map((k, i) => (
            <Line key={k} dataKey={k} stroke={SERIES[i]} strokeWidth={2} connectNulls dot={{ r: 4, strokeWidth: 2, stroke: '#0f172a', fill: SERIES[i] }} />
          ))}
        </LineChart>
      </ChartCard>

      <ChartCard title="Mood, energy & sleep" subtitle="Mood and energy 1–5, sleep in hours" empty={!wellbeing.length}>
        <LineChart data={wellbeing}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
          <Tooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
          {['Mood', 'Energy', 'Sleep'].map((k, i) => (
            <Line key={k} dataKey={k} stroke={SERIES[i]} strokeWidth={2} connectNulls dot={{ r: 4, strokeWidth: 2, stroke: '#0f172a', fill: SERIES[i] }} />
          ))}
        </LineChart>
      </ChartCard>
    </div>
  );
}
