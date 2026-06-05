import { describe, it, expect } from 'vitest';
import { CRITICAL_TABLES, type CritEntry } from './criticals';
import type { HitLocation } from '../engine/types';

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

describe('CRITICAL_TABLES — tables de Blessures critiques (LDB 18-Traumatisme)', () => {
  for (const loc of LOCS) {
    it(`${loc} : couvre tout le d100 (1..100) sans trou ni chevauchement`, () => {
      const table = CRITICAL_TABLES[loc];
      expect(table.length).toBeGreaterThan(0);
      const covered = new Array(101).fill(0); // index 1..100
      for (const e of table) for (let r = e.min; r <= e.max; r++) covered[r]++;
      for (let r = 1; r <= 100; r++) expect(covered[r], `roll ${r} sur ${loc}`).toBe(1);
    });
    it(`${loc} : a exactement une entrée létale (00)`, () => {
      const lethal = CRITICAL_TABLES[loc].filter((e: CritEntry) => e.lethal);
      expect(lethal.length).toBe(1);
      expect(lethal[0].max).toBe(100); // « 00 » = 100
    });
  }
});
