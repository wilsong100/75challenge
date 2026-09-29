import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Button, Card, Field, Sheet, inputCls } from './ui';
import {
  cmToLengthUnit, kgToWeightUnit, lengthToCm, lengthUnitLabel, round1, weightToKg, weightUnitLabel,
} from '../lib/units';
import type { BodyStat, Units } from '../types';

const FACES = ['😫', '😕', '😐', '🙂', '😄'];

function Scale({ value, onChange }: { value?: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {FACES.map((f, i) => (
        <button key={f} type="button" onClick={() => onChange(i + 1)}
          className={`flex-1 rounded-xl py-2 text-xl border ${value === i + 1 ? 'border-accent bg-accent/15' : 'border-slate-700 bg-slate-800'}`}>
          {f}
        </button>
      ))}
    </div>
  );
}

export function BodyStatsSheet({ date, open, onClose, units }: { date: string; open: boolean; onClose: () => void; units: Units }) {
  const existing = useLiveQuery(() => db.bodyStats.get(date), [date, open]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [mood, setMood] = useState<number>();
  const [energy, setEnergy] = useState<number>();

  useEffect(() => {
    if (!open) return;
    const e = existing ?? ({ date } as BodyStat);
    const w = (v?: number) => (v === undefined ? '' : String(round1(kgToWeightUnit(v, units))));
    const l = (v?: number) => (v === undefined ? '' : String(round1(cmToLengthUnit(v, units))));
    setForm({ weight: w(e.weightKg), waist: l(e.waistCm), chest: l(e.chestCm), hips: l(e.hipsCm), arm: l(e.armCm), sleep: e.sleepHrs?.toString() ?? '' });
    setMood(e.mood);
    setEnergy(e.energy);
  }, [open, existing, date, units]);

  const num = (k: string) => (form[k] ? +form[k] : undefined);
  async function save() {
    const len = (k: string) => (num(k) === undefined ? undefined : lengthToCm(num(k)!, units));
    await db.bodyStats.put({
      date,
      weightKg: num('weight') === undefined ? undefined : weightToKg(num('weight')!, units),
      waistCm: len('waist'),
      chestCm: len('chest'),
      hipsCm: len('hips'),
      armCm: len('arm'),
      sleepHrs: num('sleep'),
      mood,
      energy,
    });
    onClose();
  }
  const input = (k: string, label: string) => (
    <Field label={label}>
      <input type="number" inputMode="decimal" className={inputCls} value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </Field>
  );
  const lu = lengthUnitLabel(units);
  return (
    <Sheet open={open} onClose={onClose} title="Body & wellbeing">
      <div className="grid grid-cols-2 gap-3">
        {input('weight', `Weight (${weightUnitLabel(units)})`)}
        {input('sleep', 'Sleep (hours)')}
        {input('waist', `Waist (${lu})`)}
        {input('chest', `Chest (${lu})`)}
        {input('hips', `Hips (${lu})`)}
        {input('arm', `Arm (${lu})`)}
      </div>
      <Field label="Mood"><Scale value={mood} onChange={setMood} /></Field>
      <Field label="Energy"><Scale value={energy} onChange={setEnergy} /></Field>
      <Button className="w-full" onClick={save}>Save</Button>
    </Sheet>
  );
}

export function JournalCard({ date }: { date: string }) {
  const entry = useLiveQuery(() => db.journal.get(date), [date]);
  const [text, setText] = useState('');
  const [win, setWin] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setText(entry?.text ?? '');
    setWin(entry?.win ?? '');
  }, [entry, date]);

  async function save() {
    if (text === (entry?.text ?? '') && win === (entry?.win ?? '')) return;
    await db.journal.put({ date, text, win, updatedAt: Date.now() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-white">✍️ Journal</h3>
        {saved && <span className="text-xs text-emerald-400">Saved</span>}
      </div>
      <input className={`${inputCls} mb-2`} placeholder="Win of the day 🏆" value={win} onChange={(e) => setWin(e.target.value)} onBlur={save} />
      <textarea className={`${inputCls} min-h-24`} placeholder="How did today go? What was hard? What will you do better tomorrow?"
        value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
    </Card>
  );
}
