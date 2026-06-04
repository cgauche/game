import { describe, it, expect } from 'vitest';
import { carryPose, weaponAttackClip, weaponParryClip, isRangedFamily } from './weaponClips';
import { clipDuration } from './clips';
import type { Weapon } from '../../../engine/types';

// Libellés CANONIQUES (présents dans trappings.json) → résolus par Groupe.
const w = (name: string, type: 'melee' | 'ranged' = 'melee'): Weapon =>
  ({ name, type, damage: '+4', qualities: [] } as Weapon);

const windUp = (clip: ReturnType<typeof weaponAttackClip>) => clip.steps[0].pose;
const anyStep = (clip: ReturnType<typeof weaponAttackClip>, pred: (p: Record<string, number>) => boolean) =>
  clip.steps.some((s) => pred(s.pose as Record<string, number>));

describe('weaponAttackClip — gestes distincts par GROUPE canonique', () => {
  it('arme à deux mains (Grande hache) lève plus haut que la Base (Dague)', () => {
    expect(windUp(weaponAttackClip(w('Grande hache'))).epauleD!)
      .toBeLessThan(windUp(weaponAttackClip(w('Dague'))).epauleD!);
  });

  it('arme d’hast (Lance) perce : fente du buste/bassin, peu de lever de bras', () => {
    const lance = weaponAttackClip(w('Lance'));
    expect(anyStep(lance, (p) => (p.torse ?? 0) >= 10 && (p.bassin ?? 0) >= 8)).toBe(true);
    expect(Math.abs(windUp(lance).epauleD ?? 0)).toBeLessThan(40);
  });

  it('Arc utilise le bras GAUCHE tendu en avant (bande l’arc) et tire en arrière', () => {
    const arc = weaponAttackClip(w('Arc long', 'ranged'));
    expect(anyStep(arc, (p) => (p.epauleG ?? 0) > 20)).toBe(true);
    expect(anyStep(arc, (p) => (p.epauleD ?? 0) < -20)).toBe(true);
  });

  it('Escrime (Rapière) frappe plus vite qu’une arme à deux mains', () => {
    expect(clipDuration(weaponAttackClip(w('Rapière'))))
      .toBeLessThan(clipDuration(weaponAttackClip(w('Grande hache'))));
  });

  it('Poudre noire (Pistolet) : recul vers le haut (tête/torse reculent)', () => {
    const pistol = weaponAttackClip(w('Pistolet', 'ranged'));
    expect(anyStep(pistol, (p) => (p.tete ?? 0) <= -4 && (p.torse ?? 0) <= -6)).toBe(true);
  });

  it('fallback : arme non cataloguée → base (mêlée) / arc (distance)', () => {
    expect(weaponAttackClip(w('Truc bizarre', 'melee'))).toBe(weaponAttackClip(w('Dague')));
    expect(weaponAttackClip(w('Engin inconnu', 'ranged'))).toBe(weaponAttackClip(w('Arc long', 'ranged')));
  });
});

describe('carryPose — l’arme est tenue différemment au repos', () => {
  it('arc et arme de base diffèrent', () => {
    expect(carryPose(w('Arc long', 'ranged'))).not.toEqual(carryPose(w('Dague')));
  });
  it('arme d’hast (Pique) oriente la hampe (bone arme)', () => {
    expect(carryPose(w('Pique')).arme).toBeDefined();
  });
  it('sans arme → pose neutre', () => {
    expect(carryPose(undefined)).toEqual({});
  });
});

describe('weaponParryClip — garde adaptée', () => {
  it('avec bouclier → garde du bras gauche', () => {
    const p = weaponParryClip(w('Rapière'), true).steps[0].pose as Record<string, number>;
    expect(p.epauleG).toBeDefined();
  });
  it('arme une-main sans bouclier → garde du bras d’arme (droit)', () => {
    const p = weaponParryClip(w('Rapière'), false).steps[0].pose as Record<string, number>;
    expect(p.epauleD).toBeDefined();
  });
  it('arme à deux mains (Bâton de combat) → blocage des deux bras', () => {
    const p = weaponParryClip(w('Bâton de combat'), false).steps[0].pose as Record<string, number>;
    expect(p.epauleG).toBeDefined();
    expect(p.epauleD).toBeDefined();
  });
  it('un tireur (Arc) esquive au lieu de parer', () => {
    const p = weaponParryClip(w('Arc long', 'ranged'), false).steps[0].pose as Record<string, number>;
    expect(p.bassin).toBeDefined();
  });
});

describe('isRangedFamily (via Groupe canonique)', () => {
  it('classe les familles à distance', () => {
    expect(isRangedFamily(w('Arc long', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('Pistolet', 'ranged'))).toBe(true);
    expect(isRangedFamily(w('Dague'))).toBe(false);
  });
});
