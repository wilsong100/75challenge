import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { Button, Field, Segmented, Sheet, Toggle, inputCls } from './ui';
import { compressImage } from '../lib/image';
import { distanceToKm, distanceUnitLabel, waterToMl, waterUnitLabel } from '../lib/units';
import { WORKOUT_KINDS, type MealType, type Pose, type Units } from '../types';

interface SheetProps {
  date: string;
  open: boolean;
  onClose: () => void;
  units: Units;
}

export function WorkoutSheet({ date, open, onClose, units, minMinutes }: SheetProps & { minMinutes: number }) {
  const [kind, setKind] = useState<string>('Walk');
  const [duration, setDuration] = useState(String(minMinutes));
  const [outdoor, setOutdoor] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');

  async function save() {
    await db.workouts.add({
      date,
      kind,
      durationMin: Math.max(0, +duration || 0),
      outdoor,
      recovery,
      distanceKm: distance ? distanceToKm(+distance, units) : undefined,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    });
    setNotes('');
    setDistance('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log workout">
      <Field label="Type">
        <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value)}>
          {WORKOUT_KINDS.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
      </Field>
      <Field label="Duration (minutes)">
        <div className="flex gap-2 mb-2">
          {[30, 45, 60, 90].map((m) => (
            <button key={m} type="button" onClick={() => setDuration(String(m))}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700">{m}</button>
          ))}
        </div>
        <input type="number" inputMode="numeric" className={inputCls} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </Field>
      <Toggle checked={outdoor} onChange={setOutdoor} label="🌳 Outdoors" />
      <Toggle checked={recovery} onChange={setRecovery} label="🧘 Active-recovery session" />
      <Field label={`Distance (${distanceUnitLabel(units)}, optional)`}>
        <input type="number" inputMode="decimal" className={inputCls} value={distance} onChange={(e) => setDistance(e.target.value)} />
      </Field>
      <Field label="Notes (optional)">
        <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Button className="w-full mt-2" onClick={save}>Save workout</Button>
    </Sheet>
  );
}

export function WaterSheet({ date, open, onClose, units }: SheetProps) {
  const [amount, setAmount] = useState('');
  async function save() {
    const ml = waterToMl(+amount || 0, units);
    if (ml > 0) await db.water.add({ date, amountMl: Math.round(ml), createdAt: Date.now() });
    setAmount('');
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Add water">
      <Field label={`Amount (${waterUnitLabel(units)})`} hint="Use a negative number to correct a mistake.">
        <input type="number" inputMode="decimal" autoFocus className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Button className="w-full" onClick={save}>Add</Button>
    </Sheet>
  );
}

const nowTime = () => new Date().toTimeString().slice(0, 5);
const guessMealType = (): MealType => {
  const h = new Date().getHours();
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 17 ? 'Snack' : 'Dinner';
};

export function MealSheet({ date, open, onClose }: SheetProps) {
  const [mealType, setMealType] = useState<MealType>(guessMealType);
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [onPlan, setOnPlan] = useState(true);
  const recent = useLiveQuery(async () => {
    const meals = await db.meals.orderBy('id').reverse().limit(50).toArray();
    const seen = new Map<string, (typeof meals)[number]>();
    meals.forEach((m) => !seen.has(m.name.toLowerCase()) && seen.set(m.name.toLowerCase(), m));
    return [...seen.values()].slice(0, 8);
  }, [open]);

  async function save() {
    if (!name.trim()) return;
    await db.meals.add({
      date,
      time: nowTime(),
      mealType,
      name: name.trim(),
      calories: calories ? +calories : undefined,
      proteinG: protein ? +protein : undefined,
      onPlan,
      createdAt: Date.now(),
    });
    setName('');
    setCalories('');
    setProtein('');
    setOnPlan(true);
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log meal">
      <Field label="Meal">
        <Segmented value={mealType} onChange={setMealType}
          options={(['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const).map((m) => ({ value: m, label: m }))} />
      </Field>
      <Field label="What did you eat?">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chicken, rice & greens" />
      </Field>
      {!!recent?.length && (
        <div className="flex flex-wrap gap-2 -mt-1 mb-3">
          {recent.map((m) => (
            <button key={m.id} type="button" className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
              onClick={() => {
                setName(m.name);
                setCalories(m.calories ? String(m.calories) : '');
                setProtein(m.proteinG ? String(m.proteinG) : '');
              }}>
              ↺ {m.name}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Calories (optional)">
          <input type="number" inputMode="numeric" className={inputCls} value={calories} onChange={(e) => setCalories(e.target.value)} />
        </Field>
        <Field label="Protein g (optional)">
          <input type="number" inputMode="numeric" className={inputCls} value={protein} onChange={(e) => setProtein(e.target.value)} />
        </Field>
      </div>
      <Toggle checked={onPlan} onChange={setOnPlan} label="✅ On my diet plan" />
      <Button className="w-full mt-2" disabled={!name.trim()} onClick={save}>Save meal</Button>
    </Sheet>
  );
}

export function ReadingSheet({ date, open, onClose, unit }: SheetProps & { unit: 'pages' | 'minutes' }) {
  const books = useLiveQuery(() => db.books.where('status').equals('reading').toArray(), []);
  const [pages, setPages] = useState('10');
  const [minutes, setMinutes] = useState(unit === 'minutes' ? '10' : '');
  const [bookId, setBookId] = useState<number | 'new' | ''>('');
  const [newTitle, setNewTitle] = useState('');
  const [nonFiction, setNonFiction] = useState(true);
  const [audiobook, setAudiobook] = useState(false);
  const [finished, setFinished] = useState(false);

  const selected = bookId === '' ? (books?.[0]?.id ?? 'new') : bookId;

  async function save() {
    let id: number | 'new' | undefined = selected;
    if (selected === 'new') {
      id = await db.books.add({ title: newTitle.trim(), author: '', nonFiction, status: 'reading', createdAt: Date.now() });
    }
    await db.reading.add({
      date,
      pages: +pages || 0,
      minutes: +minutes || 0,
      bookId: typeof id === 'number' ? id : undefined,
      audiobook,
      createdAt: Date.now(),
    });
    if (finished && typeof id === 'number') await db.books.update(id, { status: 'finished', finishedDate: date });
    setFinished(false);
    setNewTitle('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log reading">
      <Field label="Book">
        <select className={inputCls} value={selected} onChange={(e) => setBookId(e.target.value === 'new' ? 'new' : +e.target.value)}>
          {books?.map((b) => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
          <option value="new">+ New book…</option>
        </select>
      </Field>
      {selected === 'new' && (
        <>
          <Field label="Title">
            <input className={inputCls} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </Field>
          <Toggle checked={nonFiction} onChange={setNonFiction} label="Non-fiction" />
        </>
      )}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <Field label="Pages">
          <input type="number" inputMode="numeric" className={inputCls} value={pages} onChange={(e) => setPages(e.target.value)} />
        </Field>
        <Field label="Minutes">
          <input type="number" inputMode="numeric" className={inputCls} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
      </div>
      <Toggle checked={audiobook} onChange={setAudiobook} label="🎧 Audiobook" />
      {selected !== 'new' && <Toggle checked={finished} onChange={setFinished} label="🎉 I finished this book" />}
      <Button className="w-full mt-2" onClick={save} disabled={selected === 'new' && !newTitle.trim()}>Save reading</Button>
    </Sheet>
  );
}

export function PhotoSheet({ date, open, onClose }: Omit<SheetProps, 'units'>) {
  const [pose, setPose] = useState<Pose>('front');
  const [busy, setBusy] = useState(false);
  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const blob = await compressImage(file);
      await db.photos.add({ date, pose, blob, createdAt: Date.now() });
      onClose();
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="Progress photo">
      <Field label="Pose">
        <Segmented value={pose} onChange={setPose}
          options={[{ value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
      </Field>
      <p className="text-sm text-slate-400 mb-4">Tip: same spot, same lighting, same time of day makes comparisons much clearer.</p>
      <label className="block">
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <span className="block w-full text-center rounded-xl bg-accent px-4 py-3 font-semibold text-white cursor-pointer">
          {busy ? 'Saving…' : '📷 Take or choose photo'}
        </span>
      </label>
    </Sheet>
  );
}
