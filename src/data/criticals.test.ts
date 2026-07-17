import { describe, it, expect } from 'vitest';
import { CRITICAL_TABLES, criticalTableFor, type CritEntry } from './criticals';
import type { HitLocation } from '../engine/types';
import locJson from './localisation.json';

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

/**
 * Repli « Tableau des Bras » (LDB 76 l.21 : « Si un animal possède une Localisation sans Tableau de
 * Critiques, comme un tentacule, une queue ou une aile, faites un jet sur le Tableau des Bras et
 * décrivez le résultat de façon appropriée. ») — garde EXHAUSTIVE (la classe, pas les cas) : toute loc
 * produite par une forme de `localisation.json` doit résoudre une table (dédiée ou repli), et le repli
 * doit se déclencher réellement pour une loc future sans entrée dédiée (jamais du code mort).
 */
describe('criticalTableFor — repli Tableau des Bras (LDB 76 l.21)', () => {
  const shapes = (locJson as { personnage: { shapes: Record<string, { loc: HitLocation }[]> } }).personnage.shapes;
  const producedLocs = new Set<HitLocation>();
  for (const entries of Object.values(shapes)) for (const e of entries) producedLocs.add(e.loc);

  it('localisation.json (humanoide/serpent/araignee) ne produit que des locs déjà couvertes', () => {
    expect(producedLocs.size).toBeGreaterThan(0);
    for (const loc of producedLocs) {
      expect(criticalTableFor(loc).length, `loc ${loc}`).toBeGreaterThan(0);
    }
  });

  it('les 6 HitLocation résolvent TOUTES sur leur table dédiée (aucun trou aujourd\'hui)', () => {
    for (const loc of LOCS) expect(criticalTableFor(loc)).toBe(CRITICAL_TABLES[loc]);
  });

  it('une loc SANS table dédiée (tentacule/queue/aile future) retombe réellement sur la table des Bras', () => {
    for (const exotic of ['tentacule', 'queue', 'aile'] as unknown as HitLocation[]) {
      expect(criticalTableFor(exotic)).toBe(CRITICAL_TABLES.brasD);
    }
  });
});
