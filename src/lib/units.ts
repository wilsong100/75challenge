import type { Units } from '../types';

const ML_PER_OZ = 29.5735;
const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

export function formatWater(ml: number, units: Units): string {
  if (units === 'imperial') return `${Math.round(ml / ML_PER_OZ)} oz`;
  return Math.abs(ml) >= 1000 ? `${+(ml / 1000).toFixed(1)} L` : `${Math.round(ml)} ml`;
}

export const waterUnitLabel = (units: Units) => (units === 'imperial' ? 'oz' : 'ml');
export const waterToMl = (value: number, units: Units) => (units === 'imperial' ? value * ML_PER_OZ : value);
export const mlToWaterUnit = (ml: number, units: Units) => (units === 'imperial' ? ml / ML_PER_OZ : ml);

/** Quick-add buttons for water, in ml. */
export const waterQuickAdds = (units: Units): number[] =>
  units === 'imperial' ? [8, 16, 24, 32].map((oz) => oz * ML_PER_OZ) : [250, 500, 750, 1000];

export const weightUnitLabel = (units: Units) => (units === 'imperial' ? 'lb' : 'kg');
export const kgToWeightUnit = (kg: number, units: Units) => (units === 'imperial' ? kg * LB_PER_KG : kg);
export const weightToKg = (v: number, units: Units) => (units === 'imperial' ? v / LB_PER_KG : v);

export const lengthUnitLabel = (units: Units) => (units === 'imperial' ? 'in' : 'cm');
export const cmToLengthUnit = (cm: number, units: Units) => (units === 'imperial' ? cm / CM_PER_IN : cm);
export const lengthToCm = (v: number, units: Units) => (units === 'imperial' ? v * CM_PER_IN : v);

export const distanceUnitLabel = (units: Units) => (units === 'imperial' ? 'mi' : 'km');
export const kmToDistanceUnit = (km: number, units: Units) => (units === 'imperial' ? km / 1.60934 : km);
export const distanceToKm = (v: number, units: Units) => (units === 'imperial' ? v * 1.60934 : v);

export const round1 = (n: number) => Math.round(n * 10) / 10;
