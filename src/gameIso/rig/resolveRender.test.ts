import { describe, it, expect } from 'vitest';
import { resolveRender, resolveById, resolveSpecies } from './bodyPlan';
import { defByName } from './creatures';
import { isSwarm } from '../../engine/traits/dispatch';
import { creatures } from '../../data';

/**
 * `resolveRender` est désormais 100% DATA-DRIVEN (de-POC P5/5d) : l'espèce vient de l'argument
 * explicite, sinon du RECORD (`findCreature`), sinon le NOM s'il EST une espèce canonique (lookup
 * EXACT `defByName`), sinon bipède Humain. PLUS AUCUN match flou (aliases/priorité supprimés).
 */
describe('resolveRender — résolution de rendu 100% data-driven (plus de name-match flou)', () => {
  it('espèce EXPLICITE → plan de la def (defByName) ; Nuée → swarm ; sinon rig bipède', () => {
    for (const c of creatures) {
      const sp = c.appearance?.species;
      if (!sp) continue;
      const r = resolveRender(sp, c.traits, c.id);
      const d = defByName(sp);
      const expected = isSwarm(c.traits) ? 'plan' : d && d.plan !== 'biped' ? 'plan' : 'rig';
      expect(r.kind, c.label).toBe(expected);
      if (r.kind === 'rig') expect(r.plan, c.label).toBe('biped');
    }
  });

  it('le REPLI par ID (sans espèce passée) lit le RECORD — identique à passer l’espèce du record', () => {
    for (const c of creatures) {
      const sp = c.appearance?.species;
      if (!sp) continue; // les Nuée sans espèce sont couvertes par le trait (cas suivant)
      expect(resolveById(c.id), c.label).toEqual(resolveRender(sp, c.traits, c.id));
    }
  });

  it('une ESPÈCE EXPLICITE (resolveSpecies) résout sans record (lookup EXACT defByName, pas de fuzzy)', () => {
    // « Varghulf » : def ailé SANS record creatures.json → résolu par l’espèce explicite.
    expect(resolveSpecies('Varghulf').plan).toBe(defByName('Varghulf')?.plan);
    expect(resolveSpecies('Varghulf').plan).toBe('winged');
    // « Liche » : def bipède sans record → espèce = l’arg explicite (exact).
    expect(resolveSpecies('Liche')).toMatchObject({ kind: 'rig', plan: 'biped', species: 'Liche' });
  });

  it('une espèce INCONNUE (rôle générique sans def) → bipède (rig) ; l’espèce explicite est conservée', () => {
    // L'arg explicite gagne et est préservé tel quel ; sans def il rend en bipède (race via baseSpeciesOf).
    for (const n of ['Cultiste', 'Soldat', 'Rôle totalement inconnu xyz'])
      expect(resolveSpecies(n), n).toMatchObject({ kind: 'rig', plan: 'biped', species: n });
  });
});
