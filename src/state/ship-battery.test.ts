import { describe, it, expect } from 'vitest';
import { resolveBattery } from './shipBattery';
import type { Combatant, ShipPoste, SkillInstance } from '../engine/types';
import type { FireArc } from '../engine/types';
import type { RNG } from '../engine/dice';

/** Combattant d'équipage minimal (carac d'instance = Dex → valeur prévisible). Calqué sur crew-roles.test.ts. */
const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [],
  }) as unknown as Combatant;
const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };

const poste = (side: FireArc, uid: string): ShipPoste => ({ item: { uid, name: `Canon ${side}` } as never, side });
const hull = (postes: ShipPoste[]): Combatant =>
  ({ id: 'hull', name: 'Galère', pos: { x: 5, y: 5 }, postes, conditions: [], weapons: [] }) as unknown as Combatant;
const target = (x: number, y: number): Combatant =>
  ({ id: 'cible', name: 'Cible', pos: { x, y }, conditions: [], weapons: [] }) as unknown as Combatant;
const artilleur = () => mk({ Dex: 80 }, [{ skillId: 'projectiles', advances: 0, spec: 'Poudre noire' }]); // valeur 80

/**
 * Tir de batterie (MDG ch.14 l.126-130) : « le total de DR s'applique à toutes les armes à feu tournées vers
 * l'ennemi ». Le résolveur PUR détermine la bordée qui porte + ses pièces + le DR PARTAGÉ (Test d'équipage
 * Artilleur essentiel). L'application par pièce (Dégâts + DR) est le suivi (flux/modale).
 */
describe('resolveBattery — lâcher une bordée (DR partagé, MDG ch.14)', () => {
  it('cap Nord, cible plein EST → bordée TRIBORD ; seules SES pièces tirent ; DR = total du Test d’équipage', () => {
    const h = hull([poste('tribord', 't1'), poste('tribord', 't2'), poste('babord', 'b1')]);
    const plan = resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))!;
    expect(plan.side).toBe('tribord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['t1', 't2']); // pas la pièce bâbord
    expect(plan.dr).toBe(plan.crewTest.total); // le DR partagé = le total du Test d'équipage
    expect(plan.crewTest.contributions[0].essential).toBe(true); // Artilleur = rôle ESSENTIEL (DR ×2)
  });

  it('cible plein OUEST → bordée BÂBORD (le bord opposé tire)', () => {
    const h = hull([poste('tribord', 't1'), poste('babord', 'b1'), poste('babord', 'b2')]);
    const plan = resolveBattery(h, target(1, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))!;
    expect(plan.side).toBe('babord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['b1', 'b2']);
  });

  it('aucune pièce sur la bordée qui porte → null (rien à lâcher, pas de Test gaspillé)', () => {
    const h = hull([poste('babord', 'b1')]); // que bâbord ; cible à l'est → tribord
    expect(resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))).toBeNull();
  });

  it('positions non résolues → null (défensif)', () => {
    const h = hull([poste('tribord', 't1')]);
    h.pos = undefined as never;
    expect(resolveBattery(h, target(9, 5), 'N', [], 80, seq([30]))).toBeNull();
  });
});
