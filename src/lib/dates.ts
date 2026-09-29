import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const toDateStr = (d: Date) => format(d, 'yyyy-MM-dd');
export const todayStr = (now: Date = new Date()) => toDateStr(now);
export const parseDate = (s: string) => parseISO(s);
export const addDaysStr = (s: string, n: number) => toDateStr(addDays(parseISO(s), n));
export const diffDays = (a: string, b: string) => differenceInCalendarDays(parseISO(a), parseISO(b));
export const prettyDate = (s: string, fmt = 'EEE d MMM') => format(parseISO(s), fmt);
