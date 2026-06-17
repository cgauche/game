import { describe, it, expect } from 'vitest';
import { resolveRender, resolveByName } from './bodyPlan';
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

  it('le REPLI (sans espèce) lit le RECORD — identique à passer l’espèce du record', () => {
    for (const c of creatures) {
      const sp = c.appearance?.species;
      if (!sp) continue; // les 7 Nuée sans espèce sont couvertes par le trait (cas suivant)
      expect(resolveByName(c.id), c.label).toEqual(resolveRender(sp, c.traits, c.id));
    }
  });

  it('un NOM exact d’espèce canonique résout sans record (lookup EXACT defByName, pas de fuzzy)', () => {
    // « Varghulf » : def ailé SANS record creatures.json → résolu par defByName(nom).
    expect(resolveByName('Varghulf').plan).toBe(defByName('Varghulf')?.plan);
    expect(resolveByName('Varghulf').plan).toBe('winged');
    // « Liche » : def bipède sans record → espèce = le nom (exact).
    expect(resolveByName('Liche')).toMatchObject({ kind: 'rig', plan: 'biped', species: 'Liche' });
  });

  it('un nom INCONNU (rôle générique sans record ni def) → bipède Humain par défaut', () => {
    for (const n of ['Cultiste', 'Soldat', 'Rôle totalement inconnu xyz'])
      expect(resolveByName(n), n).toMatchObject({ kind: 'rig', plan: 'biped', species: 'Humain' });
  });
});
