/**
 * IA — SORTS de SOUTIEN / UTILITAIRE (grimoire NON-dégât : heal/buff/débuff/invocation/other).
 *
 * Deux niveaux, comme les autres `ai*.test.ts` :
 *  - CLASSIFICATION (`aiSpellPlan`, combatFlow) : chaque sort connu est mappé à une catégorie depuis ses
 *    DONNÉES (ops du Flow, portée, ZdE, Prière) — JAMAIS par nom. Arcane ET Prière. Exhaustif (rien
 *    d'« invisible » : un utilitaire non décisif tombe en `other`).
 *  - DÉCISION PURE (`chooseEnemyAction`, ai.ts) : avec `supportSpells` fourni, l'IA énumère des candidats
 *    `cast` (soin de l'allié le plus bas, buff non redondant, débuff du plus menaçant, invocation en
 *    sous-nombre) et les SCORE ; un soutien redondant/inutile PERD face à l'attaque (anti-spam + repli).
 *
 * Tout passe par le MÊME `cast` (résolu par `castSpell` côté store → IA = héros). PUR/déterministe.
 */
import { describe, it, expect } from 'vitest';
import { aiSpellPlan } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput, type SupportSpellOpt } from './ai';
import { emptyScene } from './scene';
import { findSpellById } from '../data';
import type { Combatant, Weapon } from '../engine/types';

// ════════════════════════════════════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════════════════════════════════════
const MELEE: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

/** Lanceur générique avec une valeur de Langue (Magick) ÉLEVÉE (SL max ≥ 10 → tous nos sorts cn≤9 passent)
 *  et la compétence de Prière (Soc) pour les bénédictions. */
function caster(id: string, pos: { x: number; y: number }, spells: string[], opts: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, kind: 'enemy', pos,
    characteristics: { CC: 40, CT: 40, F: 40, E: 40, I: 40, Ag: 40, Dex: 40, Int: 99, FM: 60, Soc: 99 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [
      { skillId: 'langue', spec: 'Magick', advances: 80, characteristic: 'Int' },
      { skillId: 'priere', advances: 80, characteristic: 'Soc' },
    ] as never,
    talents: [], movement: 4, spells, ...opts,
  } as Combatant;
}

function foeAt(id: string, x: number, y: number, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, name: id, kind: 'hero',
    characteristics: { CC: 35, CT: 35, F: 35, E: 35, I: 35, Ag: 35, Dex: 35, Int: 35, FM: 35, Soc: 35 },
    wounds: { current: 12, max: 12, base: 12 }, advantage: 0, conditions: [], weapons: [MELEE],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, pos: { x, y }, ...opts,
  } as Combatant;
}

const scene = emptyScene(20, 20);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, ...extra };
}

const cat = (plan: SupportSpellOpt[], id: string) => plan.find((o) => o.id === id)?.cat;

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 1. CLASSIFICATION data-driven (aiSpellPlan)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('aiSpellPlan — classification EXHAUSTIVE depuis les DONNÉES (jamais par nom)', () => {
  it('buff ARCANE sur soi (Armure aethyrique, op ap, portée Vous) → buffSelf', () => {
    const c = caster('e', { x: 0, y: 0 }, ['armure-aethyrique']);
    expect(cat(aiSpellPlan(c), 'armure-aethyrique')).toBe('buffSelf');
  });

  it('BÉNÉDICTION (Prière, cn null → toujours faisable) +10 CC sur un allié → buffAlly', () => {
    const c = caster('e', { x: 0, y: 0 }, ['benediction-de-bataille']);
    const plan = aiSpellPlan(c);
    expect(cat(plan, 'benediction-de-bataille')).toBe('buffAlly');
    expect(plan.find((o) => o.id === 'benediction-de-bataille')!.cn).toBe(0); // Prière : pas de NI
  });

  it('SOIN (op heal) — Prière de guérison ET soin arcanique → heal', () => {
    const c = caster('e', { x: 0, y: 0 }, ['benediction-de-guerison', 'lumiere-de-guerison']);
    const plan = aiSpellPlan(c);
    expect(cat(plan, 'benediction-de-guerison')).toBe('heal');
    expect(cat(plan, 'lumiere-de-guerison')).toBe('heal');
  });

  it('DÉBUFF pur (Enchevêtrement → Empêtré, op condition SANS wounds) → debuff + condNames', () => {
    const c = caster('e', { x: 0, y: 0 }, ['enchevetrement']);
    const plan = aiSpellPlan(c);
    const o = plan.find((x) => x.id === 'enchevetrement')!;
    expect(o.cat).toBe('debuff');
    expect(o.condNames).toContain('empetre');
  });

  it('INVOCATION (op summon allyOfCaster) → summon + summonCount', () => {
    const c = caster('e', { x: 0, y: 0 }, ['menace-rampante']); // cn 6, summon Rat géant ×1 allié
    const o = aiSpellPlan(c).find((x) => x.id === 'menace-rampante')!;
    expect(o.cat).toBe('summon');
    expect(o.summonCount).toBeGreaterThanOrEqual(1);
  });

  it('sort de DÉGÂTS (missile) EXCLU du plan (géré par aiBestMissile, pas dupliqué)', () => {
    const c = caster('e', { x: 0, y: 0 }, ['carreau']); // Projectile magique
    expect(aiSpellPlan(c).some((o) => o.id === 'carreau')).toBe(false);
  });

  it('NI hors d’atteinte (cn > SL max) → écarté du plan (faisabilité RAW, LDB 46)', () => {
    const c = caster('e', { x: 0, y: 0 }, ['enchevetrement']);
    c.characteristics.Int = 10; c.skills = []; // SL max 1 < NI 3
    expect(aiSpellPlan(c).some((o) => o.id === 'enchevetrement')).toBe(false);
  });

  it('aucun sort « invisible » : chaque sort connu (hors missile) reçoit UNE catégorie', () => {
    const ids = ['armure-aethyrique', 'benediction-de-bataille', 'benediction-de-guerison', 'enchevetrement', 'menace-rampante'];
    const c = caster('e', { x: 0, y: 0 }, ids);
    const plan = aiSpellPlan(c);
    for (const id of ids) expect(plan.some((o) => o.id === id), `${id} doit être classé`).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 2. DÉCISIONS PURES (chooseEnemyAction) — heal / buff / debuff / summon / repli / anti-spam
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('chooseEnemyAction — soutien : décisions pures', () => {
  // Sorts factices CLASSÉS (le test pur ne dépend pas des données : on fournit `supportSpells` directement,
  // comme l'appelant impur le ferait via aiSpellPlan).
  const HEAL: SupportSpellOpt = { id: 'soin', cat: 'heal', cn: 0, range: 20, magnitude: 6 };
  const BUFF_ALLY: SupportSpellOpt = { id: 'buff', cat: 'buffAlly', cn: 0, range: 20, magnitude: 4 };
  const BUFF_SELF: SupportSpellOpt = { id: 'autobuff', cat: 'buffSelf', cn: 0, range: 0, magnitude: 4 };
  const DEBUFF: SupportSpellOpt = { id: 'entrave', cat: 'debuff', cn: 0, range: 20, magnitude: 2, condNames: ['empetre'] };
  const SUMMON: SupportSpellOpt = { id: 'invoc', cat: 'summon', cn: 0, range: 0, magnitude: 6, summonCount: 3 };

  it('SOIGNE l’allié le plus BAS (et PAS un allié plein)', () => {
    const e = caster('e', { x: 5, y: 5 }, []);
    const hurt = caster('a-hurt', { x: 6, y: 5 }, [], { wounds: { current: 2, max: 12 } });
    const full = caster('a-full', { x: 4, y: 5 }, [], { wounds: { current: 12, max: 12 } });
    const h = foeAt('h', 5, 12); // héros LOIN (l'attaque vaut peu → le soin gagne)
    const a = chooseEnemyAction(input(e, [h], { squad: [hurt, full], supportSpells: [HEAL] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') { expect(a.spell).toBe('soin'); expect(a.targetId).toBe('a-hurt'); }
  });

  it('allié PLEIN partout → PAS de soin (repli ATTAQUE)', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { weapons: [MELEE] });
    const ally = caster('a', { x: 4, y: 5 }, [], { wounds: { current: 12, max: 12 } });
    const h = foeAt('h', 5, 6); // au contact → attaque utile
    const a = chooseEnemyAction(input(e, [h], { squad: [ally], supportSpells: [HEAL] }));
    expect(a).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('BUFFE un allié pertinent (cible à portée, pas déjà buffé)', () => {
    const e = caster('e', { x: 5, y: 5 }, []);
    const ally = caster('a', { x: 6, y: 5 }, []);
    const h = foeAt('h', 5, 14); // héros très loin → attaque négligeable
    const a = chooseEnemyAction(input(e, [h], { squad: [ally], supportSpells: [BUFF_ALLY] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') expect(a.spell).toBe('buff');
  });

  it('ANTI-SPAM : buff DÉJÀ actif sur la cible (activeEffects) → ne réapplique pas → ATTAQUE', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { weapons: [MELEE] });
    const ally = caster('a', { x: 6, y: 5 }, [], {
      activeEffects: [{ label: 'buff', bonus: 0, duration: { scale: 'rounds', rounds: 3 }, spell: { spellId: 'buff', ni: 0, casterId: 'e', label: 'buff' } }] as never,
    });
    // soi aussi déjà buffé → aucune cible de buff valide ; un héros au contact → l'attaque doit l'emporter.
    e.activeEffects = [{ label: 'buff', bonus: 0, duration: { scale: 'rounds', rounds: 3 }, spell: { spellId: 'buff', ni: 0, casterId: 'e', label: 'buff' } }] as never;
    const h = foeAt('h', 5, 6);
    const a = chooseEnemyAction(input(e, [h], { squad: [ally], supportSpells: [BUFF_ALLY] }));
    expect(a).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('DÉBUFFE le héros le plus MENAÇANT à portée', () => {
    const e = caster('e', { x: 5, y: 5 }, []);
    const weak = foeAt('weak', 5, 12, { weapons: [], characteristics: { CC: 10, CT: 10, F: 10, E: 35, I: 10, Ag: 10, Dex: 10, Int: 10, FM: 10, Soc: 10 } as never });
    const strong = foeAt('strong', 5, 7, { weapons: [{ name: 'Hache', type: 'melee', damage: { plusBF: true, flat: 6 }, qualities: [] }], wounds: { current: 12, max: 12 } });
    const a = chooseEnemyAction(input(e, [weak, strong], { supportSpells: [DEBUFF] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') { expect(a.spell).toBe('entrave'); expect(a.targetId).toBe('strong'); }
  });

  it('ANTI-SPAM débuff : héros porte DÉJÀ l’État → ne réapplique pas (autre cible ou attaque)', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { weapons: [MELEE] });
    const h = foeAt('h', 5, 6, { conditions: [{ name: 'empetre', value: 1 }] });
    const a = chooseEnemyAction(input(e, [h], { supportSpells: [DEBUFF] }));
    expect(a).toEqual({ kind: 'melee', targetId: 'h' }); // empêtré déjà posé → on frappe
  });

  it('INVOQUE en INFÉRIORITÉ numérique (3 héros, 1 ennemi seul)', () => {
    const e = caster('e', { x: 5, y: 5 }, []);
    const heroes = [foeAt('h1', 5, 14), foeAt('h2', 6, 14), foeAt('h3', 7, 14)]; // loin → attaque négligeable
    const a = chooseEnemyAction(input(e, heroes, { squad: [], supportSpells: [SUMMON] }));
    expect(a.kind).toBe('cast');
    if (a.kind === 'cast') expect(a.spell).toBe('invoc');
  });

  it('PAS de boucle d’invocation : déjà en SUPÉRIORITÉ (beaucoup d’alliés) → n’invoque pas → attaque', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { weapons: [MELEE] });
    const allies = [caster('a1', { x: 4, y: 5 }, []), caster('a2', { x: 6, y: 5 }, []), caster('a3', { x: 5, y: 4 }, [])];
    const h = foeAt('h', 5, 6); // 4 alliés (soi+3) vs 1 héros → invocation nulle
    const a = chooseEnemyAction(input(e, [h], { squad: allies, supportSpells: [SUMMON] }));
    expect(a).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('REPLI ATTAQUE : aucun soutien utile (rien à soigner, buff déjà actif, pas en sous-nombre) → attaque', () => {
    const e = caster('e', { x: 5, y: 5 }, [], {
      weapons: [MELEE],
      activeEffects: [{ label: 'autobuff', bonus: 0, duration: { scale: 'rounds', rounds: 3 }, spell: { spellId: 'autobuff', ni: 0, casterId: 'e', label: 'autobuff' } }] as never,
    });
    const h = foeAt('h', 5, 6);
    const a = chooseEnemyAction(input(e, [h], { supportSpells: [HEAL, BUFF_SELF, SUMMON] }));
    // soi plein (rien à soigner), buffSelf DÉJÀ actif (anti-spam), pas en sous-nombre (1v1) → on frappe.
    expect(a).toEqual({ kind: 'melee', targetId: 'h' });
  });

  it('FRÉNÉSIE : aucun sort de soutien (le frénétique ne lance RIEN, LDB 21 l.34)', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { psychState: [{ type: 'frenesie' }] } as Partial<Combatant>);
    const ally = caster('a', { x: 6, y: 5 }, [], { wounds: { current: 1, max: 12 } });
    const h = foeAt('h', 5, 6);
    const a = chooseEnemyAction(input(e, [h], { squad: [ally], supportSpells: [HEAL, BUFF_ALLY, SUMMON] }));
    expect(a.kind).not.toBe('cast'); // pas de soutien sous Frénésie
  });

  it('supportSpells ABSENT → comportement INCHANGÉ (parité golden : pas de candidat de soutien)', () => {
    const e = caster('e', { x: 5, y: 5 }, [], { weapons: [MELEE] });
    const h = foeAt('h', 5, 6);
    expect(chooseEnemyAction(input(e, [h]))).toEqual({ kind: 'melee', targetId: 'h' });
  });
});

// ════════════════════════════════════════════════════════════════════════════════════════════════
// 3. Contre-sort : prière non dissipable vs buff arcanique dissipable (via les DONNÉES)
// ════════════════════════════════════════════════════════════════════════════════════════════════
describe('Dissipabilité (LDB 46) — donnée, pas de chemin spécial IA', () => {
  it('une Prière (isPrayer) n’est PAS dissipable ; un Sort arcanique l’est', () => {
    const priere = findSpellById('benediction-de-bataille')!;
    const arcane = findSpellById('armure-aethyrique')!;
    expect(priere.isPrayer).toBe(true);
    expect(!!arcane.isPrayer).toBe(false);
  });
});
