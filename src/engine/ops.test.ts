/**
 * engine/ops — vocabulaire d'effets partagé (sorts / tables de contrecoup /
 * mutations) : formules, applicateur, non-cumul des modificateurs (LDB l.168).
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG, type RNG } from './dice';
import { resolveFormula, applyOps, applyActiveEffect } from './ops';
import { hasTraitKey } from './traits/dispatch';
import { woundsFromHit } from './combat';
import type { Weapon } from './types';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Cobaye', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 45, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 38, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [],
    ...p,
  } as Combatant;
}

describe('resolveFormula', () => {
  it('littéral, (Bonus de X), (X) pleine, dés (RNG seedable)', () => {
    const c = hero(); // FM 38 → BFM 3 ; E 45 → BE 4
    expect(resolveFormula(7, c)).toBe(7);
    expect(resolveFormula({ bonusOf: 'FM' }, c)).toBe(3);
    expect(resolveFormula({ bonusOf: 'E' }, c)).toBe(4);
    expect(resolveFormula({ charOf: 'FM' }, c)).toBe(38);
    const rng = makeRNG(42);
    const v = resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, rng);
    expect(v).toBeGreaterThanOrEqual(3);
    expect(v).toBeLessThanOrEqual(12);
    // Déterminisme au seed
    expect(resolveFormula({ dice: { n: 1, sides: 10, plus: 2 } }, c, makeRNG(42))).toBe(v);
  });

  it('(Bonus de X) se résout contre la caractéristique EFFECTIVE (buffs compris)', () => {
    const c = hero({ activeEffects: [{ label: 'Buff', char: 'FM', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    expect(resolveFormula({ bonusOf: 'FM' }, c)).toBe(4); // 38+10 → 48 → bonus 4
  });
});

describe("op:'wounds' mode COUP D'ARME (S1) — délègue à woundsFromHit (qualités/armure/localisation)", () => {
  const sword = (qualities: { id: string; value?: number }[] = []): Weapon =>
    ({ name: 'Épée', type: 'melee', damage: { flat: 4, plusBF: true }, qualities, reach: 'Moyenne' }) as unknown as Weapon;

  it("weaponHit:true + ctx.weapon → Blessures == woundsFromHit (mêmes BE + PA à la localisation)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const w = sword();
    const expected = woundsFromHit(w, c, 'corps', 12); // 12 − BE(4) − PA(3) = 5
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'corps' });
    expect(before - c.wounds.current).toBe(expected);
    expect(expected).toBe(5);
  });

  it("respecte la LOCALISATION du contexte (PA d'une autre localisation)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 5, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } });
    const w = sword();
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'tete' }); // 12 − 4 − 5 = 3
    expect(before - c.wounds.current).toBe(woundsFromHit(w, c, 'tete', 12));
  });

  it("réutilise les QUALITÉS de l'arme (Perforante) via woundsFromHit — équivalence par construction", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 4, jambeG: 0, jambeD: 0 } });
    const w = sword([{ id: 'perforante' }]);
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], { weapon: w, location: 'corps' });
    expect(before - c.wounds.current).toBe(woundsFromHit(w, c, 'corps', 12));
  });

  it("weaponHit SANS ctx.weapon → repli en mode Formula (défaut : ignore BE+PA)", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const before = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 12, weaponHit: true }], {}); // pas d'arme → Formula : 12 brut
    expect(before - c.wounds.current).toBe(12);
  });

  it("mode Formula INCHANGÉ (sans weaponHit) : ignore BE+PA par défaut, déduit si flags", () => {
    const c = hero({ wounds: { current: 30, max: 30 }, armour: { tete: 0, brasG: 0, brasD: 0, corps: 3, jambeG: 0, jambeD: 0 } });
    const b1 = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 10 }], {}); // défaut : 10 brut
    expect(b1 - c.wounds.current).toBe(10);
    const b2 = c.wounds.current;
    applyOps(c, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false }], {}); // 10 − BE(4) − PA(3) = 3
    expect(b2 - c.wounds.current).toBe(3);
  });
});

describe('applyOps — opérations unitaires', () => {
  it('wounds : perte directe centralisée (Avantage purgé, À Terre à 0 PB)', () => {
    const c = hero({ advantage: 2, wounds: { current: 3, max: 12 } });
    const lines = applyOps(c, [{ op: 'wounds', amount: 5 }]);
    expect(c.wounds.current).toBe(0);
    expect(c.advantage).toBe(0);
    expect(c.conditions.some((x) => x.name === 'a-terre')).toBe(true);
    expect(lines[0]).toMatch(/subit 5 Blessure/);
  });

  it('wounds extraAP : PA situationnels du coup déduits AVEC les PA de Localisation (poupe/Bélier de collision)', () => {
    // E 45 → BE 4 ; armour.corps 0. Sans extraAP : 10 − 4 = 6 PB perdus ; avec extraAP 2 : 10 − 4 − 2 = 4.
    const a = hero({ wounds: { current: 12, max: 12 } });
    applyOps(a, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false }]);
    expect(a.wounds.current).toBe(12 - 6);
    const b = hero({ wounds: { current: 12, max: 12 } });
    applyOps(b, [{ op: 'wounds', amount: 10, ignoreTB: false, ignoreAP: false, extraAP: 2 }]);
    expect(b.wounds.current).toBe(12 - 4); // 2 PB de moins perdus — la mitigation reste DANS l'op
  });

  it('heal : plafonné au max de Blessures', () => {
    const c = hero({ wounds: { current: 10, max: 12 } });
    applyOps(c, [{ op: 'heal', amount: 5 }]);
    expect(c.wounds.current).toBe(12);
  });

  it('giveTrapping : crée l’objet dans l’inventaire (réel → stats, échelle au DR)', () => {
    const c = hero({ items: [] });
    // Générosité de Manann : 1 Ration + 1 par +2 DR → à DR 4, 1 + floor(4/2) = 3 Rations.
    applyOps(c, [{ op: 'giveTrapping', custom: 'Ration (1 jour)', perSL: { every: 2, amount: 1 } }], { sl: 4 });
    const rations = (c.items ?? []).filter((it) => /^ration/i.test(it.name));
    expect(rations.length).toBe(3);
  });

  it('giveTrapping : nom inconnu → objet CUSTOM (jamais null, comme l’Effet de scène)', () => {
    const c = hero({ items: [] });
    applyOps(c, [{ op: 'giveTrapping', custom: 'Babiole onirique XYZ' }]);
    expect((c.items ?? []).some((it) => it.name === 'Babiole onirique XYZ')).toBe(true);
  });

  it('grantTrait onlyGroups (Bannissement) : Instable n’atteint que Mort-vivant/Démon', () => {
    const undead = hero({ groups: ['Mort-vivant'] });
    const human = hero({ groups: ['Humain'] });
    const op = { op: 'grantTrait' as const, traitId: 'instable', onlyGroups: ['Mort-vivant', 'Démon'] };
    applyOps(undead, [op]);
    applyOps(human, [op]);
    expect(hasTraitKey(undead.traits, 'instable')).toBe(true);
    expect(hasTraitKey(human.traits, 'instable')).toBe(false); // gate de Groupe : non affecté
  });

  it('condition : ajout avec valeur en formule (Bonus de FM du référent caster)', () => {
    const caster = hero({ id: 'c', name: 'Lanceur', characteristics: { ...hero().characteristics, FM: 52 } });
    const c = hero();
    applyOps(c, [{ op: 'condition', name: 'hemorragique', value: { bonusOf: 'FM' } }], { caster });
    expect(c.conditions.find((x) => x.name === 'hemorragique')?.value).toBe(5);
  });

  it('removeCondition sans nom : retire le 1er État porté ; sans État → journal explicite', () => {
    const c = hero({ conditions: [{ name: 'extenue', value: 2 }] });
    const lines = applyOps(c, [{ op: 'removeCondition' }]);
    expect(c.conditions.find((x) => x.name === 'extenue')?.value).toBe(1);
    expect(lines[0]).toMatch(/retire 1 État Exténué/);
    const sain = hero();
    expect(applyOps(sain, [{ op: 'removeCondition' }])[0]).toMatch(/aucun État à retirer/);
  });

  it('charMod : durée du contexte (sort), agrégé en UNE ligne de journal', () => {
    const c = hero();
    const lines = applyOps(
      c,
      [
        { op: 'charMod', char: 'Ag', mod: -10 },
        { op: 'charMod', char: 'Dex', mod: -10 },
      ],
      { label: 'Écorce', defaultDurationRounds: 6 },
    );
    expect(c.activeEffects).toHaveLength(2);
    expect(c.activeEffects![0]).toMatchObject({ label: 'Écorce', char: 'Ag', bonus: -10, duration: { scale: 'rounds', left: 6 } });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('Cobaye : Écorce (-10 Agilité, -10 Dextérité, 6 rounds).');
  });

  it('sourceSpell : marque les ActiveEffect POSÉS du sort (NI/identité), pas les pré-existants (Dissipation LDB 46)', () => {
    const c = hero({ activeEffects: [{ label: 'Vieux buff', char: 'FM', bonus: 10, duration: { scale: 'rounds', left: 3 } }] });
    const spell = { spellId: 'ecorce', ni: 4, casterId: 'mage-1', label: 'Écorce' };
    applyOps(c, [{ op: 'charMod', char: 'Ag', mod: -10 }], { label: 'Écorce', defaultDurationRounds: 6, sourceSpell: spell });
    const old = c.activeEffects!.find((e) => e.label === 'Vieux buff')!;
    const posed = c.activeEffects!.find((e) => e.char === 'Ag')!;
    expect(old.spell).toBeUndefined(); // pré-existant : non marqué
    expect(posed.spell).toEqual(spell); // posé par CE sort : marqué (identité + NI)
  });

  it('charMod : durée permanente par défaut → « durée hors combat » au journal', () => {
    const c = hero();
    const lines = applyOps(c, [{ op: 'charMod', char: 'E', mod: 20 }], { label: 'Armure' });
    expect(c.activeEffects![0].duration).toEqual({ scale: "permanent" });
    expect(lines[0]).toMatch(/durée hors combat/);
  });

  // #125 — Aux Armes « main/bras inutilisable Nd10[-BE] Rounds » (l.2557/2562/2588) : effet TEMPORAIRE,
  // durée intrinsèque à l'entrée de Critique (pas du ctx — la résolution AA n'en porte pas).
  it("maxWeaponHands : durationRounds INLINE → ActiveEffect à durée ROUNDS, indépendant du ctx", () => {
    const c = hero();
    const rng = makeRNG(7);
    applyOps(c, [{ op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }], { rng });
    expect(c.activeEffects).toHaveLength(1);
    const eff = c.activeEffects![0];
    expect(eff.maxWeaponHands).toBe(1);
    expect(eff.duration.scale).toBe('rounds');
    if (eff.duration.scale === 'rounds') {
      expect(eff.duration.left).toBeGreaterThanOrEqual(1);
      expect(eff.duration.left).toBeLessThanOrEqual(10);
    }
  });

  it('maxWeaponHands : sans durationRounds → comportement INCHANGÉ (durée du ctx, rétro-compatible)', () => {
    const c = hero();
    applyOps(c, [{ op: 'maxWeaponHands', hands: 1 }], { defaultDurationRounds: 3 });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 3 });
  });

  it('maxWeaponHands : formule « 1d10 − BE » plancher à 1 (minimum de 1, « Choc au bras » l.2557)', () => {
    const c = hero({ characteristics: { ...hero().characteristics, E: 45 } }); // BE 4
    const rng: RNG = { int: () => 1 }; // 1d10 tiré au plus bas (1) − BE 4 → négatif → plancher 1
    applyOps(c, [{
      op: 'maxWeaponHands', hands: 1,
      durationRounds: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'E' }, factor: -1 } }] },
    }], { rng });
    expect(c.activeEffects![0].duration).toEqual({ scale: 'rounds', left: 1 });
  });

  // (Un Test imbriqué est un nœud Flow `{kind:'test'}` résolu cadence-aware (héros manuel = jet
  //  influençable, ennemi = inline). Sa résolution + branches + gates sont couvertes par
  //  `state/combat/run-combat-flow.test.ts` et `state/combat/venin-test.test.ts`.)

  it('reduceToZero seul : PB à 0, SANS Inconscient automatique (LDB 40)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.name === 'inconscient')).toBe(false);
  });

  it('reduceToZero + condition inconscient : Châtiment (LDB 40 l.101-105)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }, { op: 'condition', name: 'inconscient' }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.name === 'inconscient')).toBe(true);
  });

  it('reduceToZero + condition en-flammes : Tonnerre et foudre (LDB 40 l.126-130)', () => {
    const c = hero();
    applyOps(c, [{ op: 'reduceToZero' }, { op: 'condition', name: 'en-flammes', value: 1 }]);
    expect(c.wounds.current).toBe(0);
    expect(c.conditions.some((x) => x.name === 'en-flammes')).toBe(true);
    expect(c.conditions.some((x) => x.name === 'inconscient')).toBe(false);
  });
});

describe('applyActiveEffect — non-cumul (LDB l.168)', () => {
  it('meilleur bonus conservé, pire pénalité conservée, bonus+pénalité coexistent', () => {
    const c = hero();
    applyActiveEffect(c, { label: 'A', char: 'FM', bonus: 10, duration: { scale: 'rounds', left: 3 } });
    applyActiveEffect(c, { label: 'B', char: 'FM', bonus: 20, duration: { scale: 'rounds', left: 2 } });
    applyActiveEffect(c, { label: 'C', char: 'FM', bonus: 5, duration: { scale: 'rounds', left: 9 } });
    applyActiveEffect(c, { label: 'D', char: 'FM', bonus: -10, duration: { scale: 'rounds', left: 1 } });
    const fm = c.activeEffects!.filter((e) => e.char === 'FM');
    expect(fm).toHaveLength(2); // un bonus (le meilleur : B +20) + une pénalité (D -10)
    expect(fm.find((e) => e.bonus > 0)).toMatchObject({ label: 'B', bonus: 20 });
    expect(fm.find((e) => e.bonus < 0)).toMatchObject({ label: 'D', bonus: -10 });
  });

  it('buff de F/E/FM recale les Blessures max (LDB 85)', () => {
    const c = hero({ wounds: { current: 10, max: 12, base: 12 } });
    applyActiveEffect(c, { label: 'Vigueur', char: 'E', bonus: 10, duration: { scale: 'rounds', left: 6 } });
    expect(c.wounds.max).toBeGreaterThan(12); // E 45→55 : BE 4→5 → +2 PB (2×BE)
  });
});

describe("op:'grantPsychTrait' / op:'removePsychTrait' — Traits psychologiques (c.psychTraits)", () => {
  it("grantPsychTrait pose le Trait dans c.psychTraits (type + cible)", () => {
    const c = hero({ psychTraits: [] });
    applyOps(c, [{ op: 'grantPsychTrait', psychType: 'phobie', cible: 'Araignées' }]);
    expect(c.psychTraits).toEqual([{ type: 'phobie', cible: 'Araignées' }]);
  });
  it("grantPsychTrait sans cible (Frénésie)", () => {
    const c = hero({ psychTraits: [] });
    applyOps(c, [{ op: 'grantPsychTrait', psychType: 'frenesie' }]);
    expect(c.psychTraits).toEqual([{ type: 'frenesie' }]);
  });
  it("removePsychTrait { psychType } retire le Trait correspondant (laisse les autres)", () => {
    const c = hero({ psychTraits: [{ type: 'phobie', cible: 'Araignées' }, { type: 'haine', cible: 'Skavens' }] });
    applyOps(c, [{ op: 'removePsychTrait', psychType: 'phobie' }]);
    expect(c.psychTraits).toEqual([{ type: 'haine', cible: 'Skavens' }]);
  });
  it("removePsychTrait sans type retire UN Trait au choix (le 1er) ; aucun → inerte", () => {
    const c = hero({ psychTraits: [{ type: 'animosite', cible: 'Elfes' }] });
    applyOps(c, [{ op: 'removePsychTrait' }]);
    expect(c.psychTraits).toEqual([]);
    expect(() => applyOps(c, [{ op: 'removePsychTrait' }])).not.toThrow();
    expect(c.psychTraits).toEqual([]);
  });
});

describe("op:'sinMod' — Points de Péché ± (LDB 40 l.36 ; ACE Annexe I « Pénitence »)", () => {
  it('ajoute et retire, plancher 0, delta réel journalisé', () => {
    const c = hero({ sinPoints: 1 });
    applyOps(c, [{ op: 'sinMod', amount: 2 }]);
    expect(c.sinPoints).toBe(3);
    applyOps(c, [{ op: 'sinMod', amount: -1 }]);
    expect(c.sinPoints).toBe(2);
    applyOps(c, [{ op: 'sinMod', amount: -5 }]); // « enlevez … » ne descend jamais sous 0
    expect(c.sinPoints).toBe(0);
    const lines = applyOps(c, [{ op: 'sinMod', amount: -1 }]); // à 0 : inerte (delta 0)
    expect(c.sinPoints).toBe(0);
    expect(lines).toHaveLength(1);
  });
});

describe("op:'corruptionExposure' — Exposition différée (LDB 19 l.23-75)", () => {
  it('avec ctx.onCorruptionExposure : le hook reçoit niveau + compétence (Test par modale côté state)', () => {
    const c = hero();
    const seen: unknown[] = [];
    const lines = applyOps(c, [{ op: 'corruptionExposure', level: 'mineure', skill: 'resistance' }], {
      onCorruptionExposure: (level, skill) => { seen.push([level, skill]); return ['ouvert']; },
    });
    expect(seen).toEqual([['mineure', 'resistance']]);
    expect(lines).toEqual(['ouvert']);
    expect(c.corruption ?? 0).toBe(0); // rien de tiré en silence : le Test vit dans la modale
  });
  it('sans contexte (moteur pur) : journalisée inerte, aucune Corruption ajoutée', () => {
    const c = hero();
    const lines = applyOps(c, [{ op: 'corruptionExposure', level: 'moderee' }]);
    expect(lines).toHaveLength(1);
    expect(c.corruption ?? 0).toBe(0);
  });
});
