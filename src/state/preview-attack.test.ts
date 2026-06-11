import { describe, it, expect } from 'vitest';
import { previewAttack, resolveAttack, eligibleAttackTargetIds, outOfSightTargetIds } from './combatFlow';
import { seedBattleRng } from './battleRng';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import type { Scene } from './scene';

/**
 * LOT 3 (R4) — `previewAttack` rejoue le MÊME env + modificateurs que la résolution, sans tirer le dé :
 * l'aperçu affiché AVANT « Lancer » ne doit jamais mentir (parité aperçu↔jet).
 */
const combatant = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'A', name: 'A', kind: 'hero',
    characteristics: { CC: 50, CT: 50, F: 35, E: 35, I: 30, Ag: 35, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 14, max: 14 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: '+BF+4', reach: 'Moyenne', qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    ...over,
  }) as unknown as Combatant;

const scene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 8, h: 8 }, ambiance: 'jour', tiles: new Array(64).fill('herbe'), entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: scene(), battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;

describe('previewAttack — parité aperçu ↔ résolution (R4)', () => {
  it('la valeur de toucher prévue == la cible du jet réellement résolu', () => {
    const a = combatant({ id: 'A', advantage: 1 });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const preview = previewAttack(get, a, b);
    expect(preview.inRange).toBe(true);
    seedBattleRng(1);
    const r = resolveAttack(get, a, b);
    expect(r).not.toBeNull();
    expect(preview.target).toBe(r!.res.attackerDetail!.target); // l'aperçu ne ment pas
  });

  it('estimation de dégâts : dmg = arme + Force, soak = Endurance + PA', () => {
    const a = combatant({ id: 'A' }); // F 35 → BF 3 ; Épée +BF+4 → 7
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 2, jambeG: 0, jambeD: 0 } as never }); // E 35 → BE 3, PA corps 2
    const p = previewAttack(mkGet([a, b]), a, b, 'corps');
    expect(p.dmg).toBe(7);
    expect(p.soak).toBe(5); // BE 3 + PA 2
  });

  it('mêlée hors de portée (au-delà de l’Allonge) → inRange false', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 5, y: 0 } });
    expect(previewAttack(mkGet([a, b]), a, b).inRange).toBe(false);
  });

  it('le surnombre (2 contre 1) augmente la valeur de toucher prévue de +20 (LDB 14 l.92)', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const ally = combatant({ id: 'A2', pos: { x: 1, y: 1 } }); // 2e attaquant au contact de B
    const solo = previewAttack(mkGet([a, b]), a, b).target;
    const duo = previewAttack(mkGet([a, ally, b]), a, b).target;
    expect(duo - solo).toBe(20);
  });

  it('choix d’arme : previewAttack(weaponUid) prend l’arme choisie + applique le -20 main secondaire, parité résolution', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [
      { name: 'Épée', type: 'melee', damage: '+BF+4', reach: 'Moyenne', qualities: [], hand: 'main', hands: 1, uid: 'm' },
      { name: 'Dague', type: 'melee', damage: '+BF', reach: 'Très courte', qualities: [], hand: 'off', hands: 1, uid: 'o' },
    ] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 1, y: 0 } });
    const get = mkGet([a, b]);
    const main = previewAttack(get, a, b); // auto → Épée (main), aucune pénalité
    expect(main.weapon.name).toBe('Épée');
    expect(main.mods.some((m) => m.label === 'Main secondaire')).toBe(false);
    const off = previewAttack(get, a, b, undefined, { weaponUid: 'o' }); // Dague (main secondaire) → -20
    expect(off.weapon.name).toBe('Dague');
    expect(off.mods.find((m) => m.label === 'Main secondaire')?.value).toBe(-20);
    seedBattleRng(2);
    const r = resolveAttack(get, a, b, undefined, undefined, undefined, undefined, 'o');
    expect(r!.weapon.name).toBe('Dague'); // parité : la résolution utilise la même arme choisie
  });

  it('eligibleAttackTargetIds : seuls les ennemis vivants à portée sont éligibles', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 } }); // épée, Allonge Moyenne = 1 case
    const near = combatant({ id: 'E1', kind: 'enemy', pos: { x: 1, y: 0 } }); // adjacent → éligible
    const far = combatant({ id: 'E2', kind: 'enemy', pos: { x: 5, y: 0 } }); // hors de portée → non
    const dead = combatant({ id: 'E3', kind: 'enemy', pos: { x: 1, y: 1 }, wounds: { current: 0, max: 10 } as never }); // mort → non
    const get = (() => ({ scene: scene(), battle: { combatants: [a, near, far, dead], order: ['A', 'E1', 'E2', 'E3'], turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    const ids = eligibleAttackTargetIds(get);
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
  });

  it('tir sans Ligne de Vue → blocked', () => {
    const a = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] }] as never });
    const b = combatant({ id: 'B', kind: 'enemy', pos: { x: 6, y: 0 } });
    const s = scene();
    (s.tiles as string[])[3] = 'mur'; // mur intercalé sur la ligne (x=3,y=0)
    const get = (() => ({ scene: s, battle: { combatants: [a, b], movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    expect(previewAttack(get, a, b).blocked).toBe(true);
  });

  it('outOfSightTargetIds (grisage hors-LdV) : ennemi derrière un mur grisé au tir, pas en mêlée, pas les morts', () => {
    const s = scene();
    (s.tiles as string[])[3] = 'mur'; // mur sur la ligne y=0 entre x=0 et x=6
    const archer = combatant({ id: 'A', pos: { x: 0, y: 0 }, weapons: [{ name: 'Arc', type: 'ranged', damage: '+8', range: 60, qualities: [] }] as never });
    const hidden = combatant({ id: 'E1', kind: 'enemy', pos: { x: 6, y: 0 } }); // derrière le mur
    const seen = combatant({ id: 'E2', kind: 'enemy', pos: { x: 0, y: 5 } }); // ligne dégagée
    const deadHidden = combatant({ id: 'E3', kind: 'enemy', pos: { x: 6, y: 1 }, wounds: { current: 0, max: 10 } as never });
    const mk = (cs: Combatant[], order: string[]) =>
      (() => ({ scene: s, battle: { combatants: cs, order, turn: 0, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;
    const ids = outOfSightTargetIds(mk([archer, hidden, seen, deadHidden], ['A', 'E1', 'E2', 'E3']));
    expect(ids.has('E1')).toBe(true);
    expect(ids.has('E2')).toBe(false);
    expect(ids.has('E3')).toBe(false);
    // En mêlée la LdV ne bloque pas le ciblage → aucun grisage.
    const swordsman = combatant({ id: 'A', pos: { x: 0, y: 0 } });
    expect(outOfSightTargetIds(mk([swordsman, hidden, seen], ['A', 'E1', 'E2'])).size).toBe(0);
  });
});
