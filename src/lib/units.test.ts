import { describe, expect, it } from 'vitest';
import { formatWater, kgToWeightUnit, weightToKg } from './units';

describe('units', () => {
  it('formats water', () => {
    expect(formatWater(3000, 'metric')).toBe('3 L');
    expect(formatWater(2500, 'metric')).toBe('2.5 L');
    expect(formatWater(750, 'metric')).toBe('750 ml');
    expect(formatWater(3785, 'imperial')).toBe('128 oz');
  });
  it('round-trips weight', () => {
    expect(weightToKg(kgToWeightUnit(80, 'imperial'), 'imperial')).toBeCloseTo(80);
  });
});
