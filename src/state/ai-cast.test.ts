import { describe, it, expect } from 'vitest';
import { aiBestMissile, aiOvercastPlan, aiFocusPlan, aiAreaSpell } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { creatureToCombatant } from './spawn';
import { emptyScene } from './scene';
import { findCreature, findSpell, findSpellById } from '../data';
import type { Combatant, Weapon } from '../engine/types';

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
    expect(aiBestMissile(eusapia())).toBe('carreau');
  });

  it('avec 2 Avantages (+20 au Test, LDB 46 l.176) : La lance d’Ambre (NI 8, Dégâts +12) devient jouable', () => {
    const c = eusapia();
    c.advantage = 2;
    expect(aiBestMissile(c)).toBe('la-lance-d-ambre');
  });

  it('les DR de Talent lié au Test (LDB 10 l.20) comptent : Diction instinctive ×2 → SL max 8 → La lance d’Ambre', () => {
    const c = eusapia();
    c.talents = [...c.talents, { talentId: 'diction-instinctive', times: 2 }];
    expect(aiBestMissile(c)).toBe('la-lance-d-ambre'); // 63/10 = 6, +2 de Talent ≥ NI 8
  });

  it('aucun NI atteignable → repli sur le moins exigeant (rien d’injouable choisi en boucle)', () => {
    const c = eusapia();
    c.skills = []; // plus de Langue (Magick) : valeur = Int 48 → SL max 4… on coupe aussi Int
    c.characteristics.Int = 20; // SL max 2 < NI 4 (Carreau) : seul Fléchette (NI 0) aboutira
    expect(aiBestMissile(c)).toBe('flechette');
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

describe('aiFocusPlan — Focalisation de l’IA (LDB 46) : DONNÉES de sort, pas de nom en dur', () => {
  const eusapia = () => creatureToCombatant(findCreature('Eusapia Balacañon')!, 'e1', { x: 0, y: 0 });

  it('un sort arcanique infaisable en un jet ET focalisable → focusableSpell ; rien de PRÊT', () => {
    const c = eusapia();
    // Force la Focalisation possédée (Eusapia n’a pas forcément la Compétence) — la donnée gate, pas un nom.
    if (!c.skills.some((s) => s.skillId === 'focalisation')) c.skills.push({ skillId: 'focalisation', advances: 10, characteristic: 'FM' } as never);
    c.characteristics.Int = 20; // SL max très bas → les NI ≥ 4 (Carreau…) deviennent infaisables d’un jet
    c.skills = c.skills.filter((s) => s.skillId !== 'langue').concat([{ skillId: 'focalisation', advances: 10, characteristic: 'FM' } as never]);
    const plan = aiFocusPlan(c);
    expect(plan.readyFocusedSpell).toBeUndefined();
    expect(plan.focusableSpell).toBeTruthy(); // un sort arcanique connu, hors d’atteinte d’un seul jet
  });

  it('sans Compétence de Focalisation → aucun focusableSpell (la donnée gate, pas l’envie)', () => {
    const c = eusapia();
    c.skills = c.skills.filter((s) => s.skillId !== 'focalisation');
    c.traits = (c.traits ?? []).filter((tr) => !/lanceur/i.test(JSON.stringify(tr))); // au cas où
    c.characteristics.Int = 20;
    expect(aiFocusPlan(c).focusableSpell).toBeUndefined();
  });

  it('un sort déjà focalisé et PRÊT (focus.dr ≥ NI) → readyFocusedSpell', () => {
    const c = eusapia();
    const sp = (c.spells ?? []).map((id) => findSpellById(id)).find((s) => s && (s.cn ?? 0) > 0 && s.family === 'arcane' && s.missile === true);
    expect(sp).toBeTruthy();
    c.focus = { spell: sp!.id, dr: (sp!.cn ?? 0) + 1 }; // assez de DR cumulés
    expect(aiFocusPlan(c).readyFocusedSpell).toBe(sp!.id);
  });
});

describe('aiAreaSpell — sort de ZONE de dégâts castable (LDB 47 l.44)', () => {
  it('Eusapia (SL max 6) : aucun sort de ZONE faisable d’un jet (NI ≥ 8) → undefined', () => {
    const c = creatureToCombatant(findCreature('Eusapia Balacañon')!, 'e1', { x: 0, y: 0 });
    expect(aiAreaSpell(c)).toBeUndefined();
  });

  it('lanceur surpuissant connaissant un sort ZdE+Projectile faisable → renvoie id/rayon/portée', () => {
    const c = creatureToCombatant(findCreature('Eusapia Balacañon')!, 'e1', { x: 0, y: 0 });
    c.characteristics.Int = 99; c.characteristics.FM = 99;
    c.skills = c.skills.map((s) => (s.skillId === 'langue' ? { ...s, advances: 90 } : s));
    c.spells = [...(c.spells ?? []), 'vortex-d-ames']; // arcane, missile, ZdE, NI 8
    const a = aiAreaSpell(c);
    expect(a?.spell).toBe('vortex-d-ames');
    expect(a!.radius).toBeGreaterThanOrEqual(0);
  });
});

describe('chooseEnemyAction — décisions MAGIQUES pures (focus / cast focalisé / ZdE)', () => {
  const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };
  const scene = emptyScene(16, 16);
  function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
    return {
      id, name: id, kind, pos, wounds: { current: 10, max: 10 }, weapons: [MELEE],
      characteristics: {} as never, advantage: 0, conditions: [], armour: {} as never,
      skills: [], talents: [], movement: 4, ...opts,
    } as Combatant;
  }
  function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
    return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, ...extra };
  }

  it('readyFocusedSpell → lance CE sort (NI 0) sur la cible, même sans missile faisable', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    const a = chooseEnemyAction(input(e, [h], { readyFocusedSpell: 'carreau', spellRange: 20 }));
    expect(a).toEqual({ kind: 'cast', targetId: 'h', spell: 'carreau' });
  });

  it('cn > maxSL focalisable et rien de faisable → FOCALISE (au lieu de planter)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h = mk('h', 'hero', { x: 5, y: 9 });
    const a = chooseEnemyAction(input(e, [h], { focusableSpell: 'vortex-d-ames' }));
    expect(a).toEqual({ kind: 'focus', spell: 'vortex-d-ames' });
  });

  it('focalisable MAIS adversaire au contact + arme de mêlée → se replie en mêlée (risque d’interruption, LDB 46 l.193)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [MELEE] });
    const adj = mk('adj', 'hero', { x: 5, y: 6 });
    const a = chooseEnemyAction(input(e, [adj], { focusableSpell: 'vortex-d-ames' }));
    expect(a).toEqual({ kind: 'melee', targetId: 'adj' }); // pas de focus sous la menace
  });

  it('ZdE : ≥2 héros groupés et sort de zone castable → castArea auto-posé couvrant le paquet', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [] });
    const h1 = mk('h1', 'hero', { x: 5, y: 9 });
    const h2 = mk('h2', 'hero', { x: 6, y: 9 }); // collés (Chebyshev 1)
    const a = chooseEnemyAction(input(e, [h1, h2], { areaSpell: { spell: 'vortex-d-ames', radius: 1, range: 20, cn: 8 } }));
    expect(a.kind).toBe('castArea');
    if (a.kind === 'castArea') {
      expect(a.spell).toBe('vortex-d-ames');
      // le centre couvre les 2 héros (Chebyshev ≤ radius)
      const cov = [h1, h2].filter((h) => Math.max(Math.abs(h.pos!.x - a.center.x), Math.abs(h.pos!.y - a.center.y)) <= 1).length;
      expect(cov).toBe(2);
    }
  });

  it('ZdE : héros DISPERSÉS (aucun centre ne couvre 2) → pas de castArea (repli missile/mêlée)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { weapons: [], spells: ['carreau'] });
    const h1 = mk('h1', 'hero', { x: 1, y: 1 });
    const h2 = mk('h2', 'hero', { x: 14, y: 14 });
    const a = chooseEnemyAction(input(e, [h1, h2], {
      areaSpell: { spell: 'vortex-d-ames', radius: 1, range: 30, cn: 8 },
      offensiveSpell: 'carreau', spellRange: 30,
    }));
    expect(a.kind).toBe('cast'); // pas de ZdE : on retombe sur le missile mono-cible
  });
});
