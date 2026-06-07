import { describe, it, expect } from 'vitest';
import { weaponRest, weaponAttackClip, weaponParryClip, isRangedFamily } from './weaponClips';
import { clipDuration } from './clips';
import type { Weapon } from '../../../engine/types';

// Libellés CANONIQUES → résolus par la FORME (handlingClass), pas par le Groupe de règles.
const w = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ name, type, damage: '+4', qualities: [] } as Weapon);

const windUp = (clip: ReturnType<typeof weaponAttackClip>) => clip.steps[0].pose;
const anyStep = (clip: ReturnType<typeof weaponAttackClip>, pred: (p: Record<string, number>) => boolean) =>
  clip.steps.some((s) => pred(s.pose as Record<string, number>));

describe('weaponAttackClip — gestes distincts par CLASSE DE MANIEMENT', () => {
  it('lourde 2 mains (Grande hache) lève plus haut que la lame 1 main (Dague)', () => {
    expect(windUp(weaponAttackClip(w('Grande hache'))).epauleD!)
      .toBeLessThan(windUp(weaponAttackClip(w('Dague'))).epauleD!);
  });

  it('hampe (Lance) perce : fente du buste/bassin vers l’avant, peu de lever de bras', () => {
    const lance = weaponAttackClip(w('Lance'));
    expect(anyStep(lance, (p) => (p.torse ?? 0) >= 6 && (p.bassin ?? 0) >= 3)).toBe(true);
    expect(Math.abs(windUp(lance).epauleD ?? 0)).toBeLessThan(40);
  });

  it('hampe : la hampe se ramène pointe en avant (gros delta `arme` à l’apex)', () => {
    expect(anyStep(weaponAttackClip(w('Lance')), (p) => (p.arme ?? 0) >= 90)).toBe(true);
  });

  it('Arc utilise le bras GAUCHE tendu en avant (pousse l’arc) et tire en arrière', () => {
    const arc = weaponAttackClip(w('Arc long', 'ranged'));
    expect(anyStep(arc, (p) => (p.epauleG ?? 0) > 20)).toBe(true);
    expect(anyStep(arc, (p) => (p.epauleD ?? 0) < -20)).toBe(true);
  });

  it('Escrime (Rapière) frappe plus vite qu’une lourde 2 mains', () => {
    expect(clipDuration(weaponAttackClip(w('Rapière'))))
      .toBeLessThan(clipDuration(weaponAttackClip(w('Grande hache'))));
  });

  it('Arme à feu (Pistolet) : recul vers le haut (tête/torse reculent)', () => {
    const pistol = weaponAttackClip(w('Pistolet', 'ranged'));
    expect(anyStep(pistol, (p) => (p.tete ?? 0) <= -4 && (p.torse ?? 0) <= -6)).toBe(true);
  });

  it('la FORME prime : bec-de-corbin (Groupe Cavalerie) frappe comme une lame 1 main, pas comme une lance', () => {
    expect(weaponAttackClip(w('Marteau à bec-de-corbin'))).toBe(weaponAttackClip(w('Dague')));
  });

  it('fallback : arme non cataloguée → lame1m (mêlée) / arc (distance)', () => {
    expect(weaponAttackClip(w('Truc bizarre', 'melee'))).toBe(weaponAttackClip(w('Dague')));
    expect(weaponAttackClip(w('Engin inconnu', 'ranged'))).toBe(weaponAttackClip(w('Arc long', 'ranged')));
  });
});

describe('weaponRest — l’arme est tenue/orientée selon la classe', () => {
  it('classes différentes → repos différents (Arc vs Dague)', () => {
    expect(weaponRest(w('Arc long', 'ranged'))).not.toEqual(weaponRest(w('Dague')));
  });
  it('hampe (Pique) oriente l’arme et engage les deux mains', () => {
    const r = weaponRest(w('Pique'));
    expect(r.arme).toBeDefined(); // hampe relevée (pas pointe-bas)
    expect(r.epauleG).toBeDefined(); // main gauche amenée sur la hampe
  });
  it('lame 1 main (Dague) = repos neutre (pointe-bas au côté)', () => {
    expect(weaponRest(w('Dague'))).toEqual({});
  });
  it('toute arme à 2 mains engage la main gauche au repos', () => {
    for (const n of ['Zweihänder', 'Hallebarde', 'Arquebuse']) {
      const type = n === 'Arquebuse' ? 'ranged' : 'melee';
      expect(weaponRest(w(n, type)).epauleG, n).toBeDefined();
    }
  });
  it('sans arme → pose neutre', () => {
    expect(weaponRest(undefined)).toEqual({});
  });
});

describe('weaponParryClip — garde adaptée à la classe', () => {
  it('avec bouclier → garde du bras gauche', () => {
    const p = weaponParryClip(w('Rapière'), true).steps[0].pose as Record<string, number>;
    expect(p.epauleG).toBeDefined();
  });
  it('escrime sans bouclier → opposition du bras d’arme (droit)', () => {
    const p = weaponParryClip(w('Rapière'), false).steps[0].pose as Record<string, number>;
    expect(p.epauleD).toBeDefined();
  });
  it('mêlée à deux mains (Bâton de combat) → blocage des deux bras', () => {
    const p = weaponParryClip(w('Bâton de combat'), false).steps[0].pose as Record<string, number>;
    expect(p.epauleG).toBeDefined();
    expect(p.epauleD).toBeDefined();
  });
  it('un tireur (Arc) esquive au lieu de parer', () => {
    const p = weaponParryClip(w('Arc long', 'ranged'), false).steps[0].pose as Record<string, number>;
    expect(p.bassin).toBeDefined();
  });
});

describe('isRangedFamily (via classe de maniement)', () => {
  it('classe les familles à distance', () => {
    expect(isRangedFamily(w('Arc long', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('Pistolet', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('Dague'))).toBe(false);
  });
});
