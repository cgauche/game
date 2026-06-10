import { describe, it, expect } from 'vitest';
import { aiBestMissile, aiOvercastPlan } from './combatFlow';
import { creatureToCombatant } from './spawn';
import { findCreature, findSpell } from '../data';
import type { Combatant } from '../engine/types';

/** Héros minimal posé en (x,y) pour les plans de ciblage. */
function foeAt(id: string, x: number, y: number): Combatant {
  return {
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12, base: 12 },
    advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y },
  } as Combatant;
}

describe('aiBestMissile — choix du Projectile magique de l’IA (DR ≥ NI exigé, LDB 46)', () => {
  const eusapia = () => creatureToCombatant(findCreature('Eusapia Balacañon')!, 'e1', { x: 0, y: 0 });

  it('Eusapia (Langue (Magick) 63, SL max 6) : Carreau (NI 4, Dégâts +4) plutôt que Fléchette (+0)', () => {
    expect(aiBestMissile(eusapia())).toBe('Carreau');
  });

  it('avec 2 Avantages (+20 au Test, LDB 46 l.176) : La lance d’Ambre (NI 8, Dégâts +12) devient jouable', () => {
    const c = eusapia();
    c.advantage = 2;
    expect(aiBestMissile(c)).toBe("La lance d'Ambre");
  });

  it('les DR de Talent lié au Test (LDB 10 l.20) comptent : Diction instinctive ×2 → SL max 8 → La lance d’Ambre', () => {
    const c = eusapia();
    c.talents = [...c.talents, { name: 'Diction instinctive', times: 2 }];
    expect(aiBestMissile(c)).toBe("La lance d'Ambre"); // 63/10 = 6, +2 de Talent ≥ NI 8
  });

  it('aucun NI atteignable → repli sur le moins exigeant (rien d’injouable choisi en boucle)', () => {
    const c = eusapia();
    c.skills = []; // plus de Langue (Magick) : valeur = Int 48 → SL max 4… on coupe aussi Int
    c.characteristics.Int = 20; // SL max 2 < NI 4 (Carreau) : seul Fléchette (NI 0) aboutira
    expect(aiBestMissile(c)).toBe('Fléchette');
  });

  it('sans sorts → undefined', () => {
    const c = eusapia();
    c.spells = [];
    expect(aiBestMissile(c)).toBeUndefined();
  });
});

describe('aiOvercastPlan — Surincantation automatique de l’IA (LDB 47 l.28-31 : +1 Cible par +2 DR)', () => {
  const eusapia = () => creatureToCombatant(findCreature('Eusapia Balacañon')!, 'e1', { x: 0, y: 0 });
  const carreau = findSpell('Carreau')!; // NI 4, Portée (Force Mentale) mètres → FM 53 → 26 cases

  it('surplus de 4 DR au-dessus du NI → 2 cibles supplémentaires, les plus proches À PORTÉE', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0), foeAt('h3', 5, 0), foeAt('h4', 90, 0)]; // h4 hors portée
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 8 }, foes); // 8 − NI 4 = +4 DR
    expect(plan.overcast).toEqual({ duration: 0, targets: 2 });
    expect(plan.extraTargetIds).toEqual(['h2', 'h3']); // h1 = cible principale, exclue ; h4 trop loin
  });

  it('DR juste au NI (pas de surplus) ou sort raté → aucun plan', () => {
    const c = eusapia();
    const foes = [foeAt('h1', 1, 0), foeAt('h2', 3, 0)];
    expect(aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 5 }, foes)).toEqual({}); // surplus 1 < 2
    expect(aiOvercastPlan(c, 'h1', carreau, { cast: false, sl: 9 }, foes)).toEqual({});
  });

  it('budget plafonné par les adversaires disponibles', () => {
    const c = eusapia();
    const plan = aiOvercastPlan(c, 'h1', carreau, { cast: true, sl: 12 }, [foeAt('h1', 1, 0), foeAt('h2', 2, 0)]);
    expect(plan.extraTargetIds).toEqual(['h2']); // budget 4 mais une seule cible en plus
  });
});
