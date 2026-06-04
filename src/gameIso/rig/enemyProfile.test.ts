import { describe, it, expect } from 'vitest';
import { classifyEnemy, enemyRigProfile } from './enemyProfile';
import type { Combatant, Weapon, ItemInstance, ArmourPoints } from '../../engine/types';

const noArmour: ArmourPoints = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function mkEnemy(name: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'e1',
    name,
    kind: 'enemy',
    characteristics: {} as Combatant['characteristics'],
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+4', qualities: [] } as Weapon],
    armour: { ...noArmour },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  } as Combatant;
}

describe('classifyEnemy (cosmétique : humanoïde peau-humaine → rig, sinon créature)', () => {
  it('humanoïdes à équiper → rig', () => {
    for (const n of [
      'Bandit', 'Cultiste', 'Mutant', "Soldat de l'Empire", 'Guerrier du Chaos',
      'Humain', 'Nain', 'Flagellant', 'Noble', 'Sorcier', 'Répurgateur', 'Mercenaire',
      'Garde de la ville', 'Voleur', 'Sectateur', 'Halfling', 'Ogre',
    ]) {
      expect(classifyEnemy(n), n).toBe('rig');
    }
  });
  it('bêtes / morts-vivants / peaux-vertes / skavens / démons → créature', () => {
    for (const n of [
      'Rat géant', 'Orc', 'Gobelin', 'Snotling', 'Squelette', 'Zombie', 'Goule de crypte',
      'Guerrier des clans', 'Rat ogre', 'Vermine de choc', 'Gor', 'Ungor', 'Minotaure',
      'Troll', 'Dragon', 'Démonette de Slaanesh', 'Sanguinaire de Khorne', 'Loup', 'Ours',
    ]) {
      expect(classifyEnemy(n), n).toBe('creature');
    }
  });
});

describe('enemyRigProfile', () => {
  it('null pour une créature non-humanoïde', () => {
    expect(enemyRigProfile(mkEnemy('Rat géant'))).toBeNull();
  });

  it('non-null pour un humanoïde, et reprend les armes du combattant', () => {
    const c = mkEnemy('Bandit');
    const p = enemyRigProfile(c)!;
    expect(p).not.toBeNull();
    expect(p.equip.weapons).toBe(c.weapons);
  });

  it('déterministe : même id ⇒ même apparence', () => {
    const a = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    const b = enemyRigProfile(mkEnemy('Bandit', { id: 'abc' }))!;
    expect(a.appearance).toEqual(b.appearance);
  });

  it('espèce détectée du nom', () => {
    expect(enemyRigProfile(mkEnemy('Nain mercenaire'))!.appearance.species).toBe('Nain');
    expect(enemyRigProfile(mkEnemy('Cultiste'))!.appearance.species).toBe('Humain');
    expect(enemyRigProfile(mkEnemy('Ogre brise-fer'))!.appearance.species).toBe('Ogre');
  });

  it('carrière mappée pour la tenue', () => {
    expect(enemyRigProfile(mkEnemy('Flagellant'))!.career).toBe('Flagellant');
    expect(enemyRigProfile(mkEnemy('Bandit'))!.career).toBe('Voleur');
    expect(enemyRigProfile(mkEnemy('Garde'))!.career).toBe('Soldat');
    expect(enemyRigProfile(mkEnemy('Noble dépravé'))!.career).toBe('Noble');
  });

  it('armure synthétisée depuis les PA quand pas d’inventaire', () => {
    const c = mkEnemy('Soldat', { armour: { ...noArmour, corps: 4, tete: 2 } });
    const p = enemyRigProfile(c)!;
    const torse = p.equip.armour.find((i) => (i.locs ?? []).includes('corps'));
    expect(torse).toBeTruthy();
    expect(torse!.pa).toBe(4);
    expect(p.equip.armour.some((i) => (i.locs ?? []).includes('tete'))).toBe(true);
  });

  it('utilise l’inventaire du combattant s’il en a un', () => {
    const item: ItemInstance = {
      uid: 'a1', name: 'Brigandine', kind: 'armor', qualities: [], pa: 2,
      locs: ['corps'], enc: 1, equipped: true,
    };
    const c = mkEnemy('Bandit', { items: [item], armour: { ...noArmour, corps: 9 } });
    const p = enemyRigProfile(c)!;
    expect(p.equip.armour).toContain(item); // l'inventaire prime sur la synthèse
  });

  it('mutation : Mutant a des calques, Bandit non', () => {
    expect((enemyRigProfile(mkEnemy('Mutant'))!.overlays ?? []).length).toBeGreaterThanOrEqual(1);
    expect((enemyRigProfile(mkEnemy('Guerrier du Chaos'))!.overlays ?? []).length).toBeGreaterThanOrEqual(1);
    expect((enemyRigProfile(mkEnemy('Bandit'))!.overlays ?? []).length).toBe(0);
  });
});
