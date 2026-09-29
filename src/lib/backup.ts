import { db } from '../db/db';
import type { Photo } from '../types';

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(b);
  });

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob();

const TABLES = ['challenges', 'workouts', 'meals', 'water', 'reading', 'books', 'checks', 'bodyStats', 'journal', 'settings'] as const;

export async function exportBackup(includePhotos = true): Promise<string> {
  const data: Record<string, unknown> = { app: '75challenge', version: 1, exportedAt: new Date().toISOString() };
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  if (includePhotos) {
    const photos = await db.photos.toArray();
    data.photos = await Promise.all(photos.map(async (p) => ({ ...p, blob: await blobToDataUrl(p.blob) })));
  }
  return JSON.stringify(data);
}

export async function importBackup(json: string) {
  const data = JSON.parse(json);
  if (data.app !== '75challenge') throw new Error('This file is not a 75 Day Challenge backup.');
  const photos: Photo[] = data.photos
    ? await Promise.all(data.photos.map(async (p: Photo & { blob: string }) => ({ ...p, blob: await dataUrlToBlob(p.blob) })))
    : [];
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.photos], async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      if (Array.isArray(data[t])) await db.table(t).bulkAdd(data[t]);
    }
    if (data.photos) {
      await db.photos.clear();
      await db.photos.bulkAdd(photos);
    }
  });
}
