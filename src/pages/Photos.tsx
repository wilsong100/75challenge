import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useApp } from '../AppContext';
import { Button, Card, PageHeader, Segmented, cx } from '../components/ui';
import { PhotoSheet } from '../components/LogSheets';
import { prettyDate } from '../lib/dates';
import { dayNumber } from '../lib/rules';
import type { Photo, Pose } from '../types';

function usePhotoUrls(photos?: Photo[]) {
  const urls = useMemo(() => new Map((photos ?? []).map((p) => [p.id!, URL.createObjectURL(p.blob)])), [photos]);
  useEffect(() => () => urls.forEach((u) => URL.revokeObjectURL(u)), [urls]);
  return urls;
}

function CompareSlider({ before, after, labels }: { before: string; after: string; labels: [string, string] }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative w-full aspect-[3/4] overflow-hidden rounded-2xl bg-black select-none">
      <img src={after} alt={labels[1]} className="absolute inset-0 h-full w-full object-contain" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt={labels[0]} className="absolute inset-0 h-full w-full object-contain" />
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white/90" style={{ left: `${pos}%` }} />
      <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{labels[0]}</span>
      <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{labels[1]}</span>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)}
        aria-label="Compare position" className="absolute bottom-3 left-4 right-4 w-[calc(100%-2rem)] accent-orange-500" />
    </div>
  );
}

export default function Photos() {
  const { challenge, today } = useApp();
  const [pose, setPose] = useState<Pose | 'all'>('all');
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Photo | null>(null);
  const [compare, setCompare] = useState<number[]>([]);
  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), []);
  const urls = usePhotoUrls(photos);

  const shown = (photos ?? []).filter((p) => pose === 'all' || p.pose === pose);
  const label = (p: Photo) => {
    const d = challenge ? dayNumber(challenge.startDate, p.date) : 0;
    return d >= 1 && d <= 75 ? `Day ${d}` : prettyDate(p.date, 'd MMM');
  };

  // Default comparison: first vs latest photo of the chosen pose.
  const pair =
    compare.length === 2
      ? compare.map((id) => shown.find((p) => p.id === id)).filter(Boolean) as Photo[]
      : shown.length >= 2
        ? [shown[0], shown[shown.length - 1]]
        : [];

  const toggleCompare = (id: number) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  return (
    <div>
      <PageHeader title="Photos" subtitle={`${photos?.length ?? 0} progress photos`} right={<Button onClick={() => setAdding(true)}>+ Photo</Button>} />
      <div className="mb-4">
        <Segmented value={pose} onChange={(v) => { setPose(v); setCompare([]); }}
          options={[{ value: 'all', label: 'All' }, { value: 'front', label: 'Front' }, { value: 'side', label: 'Side' }, { value: 'back', label: 'Back' }]} />
      </div>

      {pair.length === 2 && (
        <Card className="mb-4">
          <h3 className="font-semibold text-white mb-1">Before / after</h3>
          <p className="text-xs text-slate-400 mb-3">Drag the slider. Tap ⇄ on any two photos below to compare them.</p>
          <CompareSlider before={urls.get(pair[0].id!)!} after={urls.get(pair[1].id!)!} labels={[label(pair[0]), label(pair[1])]} />
        </Card>
      )}

      {!shown.length ? (
        <Card className="text-center py-10">
          <div className="text-4xl mb-2">📸</div>
          <p className="text-slate-400">No photos yet. Your Day 1 photo will be the best thing you ever took.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {shown.map((p) => (
            <div key={p.id} className={cx('relative aspect-[3/4] overflow-hidden rounded-xl bg-slate-900', compare.includes(p.id!) && 'ring-2 ring-accent')}>
              <button className="absolute inset-0" onClick={() => setViewing(p)} aria-label={`View ${label(p)}`}>
                <img src={urls.get(p.id!)} alt={label(p)} className="h-full w-full object-cover" loading="lazy" />
              </button>
              <span className="absolute left-1 bottom-1 rounded bg-black/60 px-1.5 text-[10px] text-white">{label(p)} · {p.pose}</span>
              <button onClick={() => toggleCompare(p.id!)} aria-label="Select for comparison"
                className={cx('absolute right-1 top-1 rounded-full h-7 w-7 text-xs', compare.includes(p.id!) ? 'bg-accent text-white' : 'bg-black/60 text-white')}>⇄</button>
            </div>
          ))}
        </div>
      )}

      {viewing && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center justify-between p-4 pt-safe text-white">
            <span>{label(viewing)} · {prettyDate(viewing.date, 'd MMM yyyy')} · {viewing.pose}</span>
            <button
              className="text-red-400 text-sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm('Delete this photo?')) {
                  db.photos.delete(viewing.id!);
                  setViewing(null);
                }
              }}
            >
              Delete
            </button>
          </div>
          <img src={urls.get(viewing.id!)} alt="" className="flex-1 min-h-0 object-contain" />
        </div>
      )}
      <PhotoSheet date={today} open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
