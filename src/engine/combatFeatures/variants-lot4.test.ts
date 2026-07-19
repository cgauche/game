/**
 * Preuve de COMPORTEMENT — migration `descAA`/`combat.aa` → `variants` (#563/#564 Lot 4, talents.json).
 * 3 provenances de lecture de la MÊME variante réglée, sur de VRAIES entités du catalogue (jamais un id
 * synthétique) : (1) la capacité MÉCANIQUE (`dispatch.ts`, `effectiveFeature`/`featuresOf`), (2) l'affichage
 * Codex (`activeVariant` direct, même primitive que `registry.ts`), (3) le câblage `combatFlow` (Frappe
 * blessante → `hasCritRollTwiceTalent`/`critRollTwiceFor`). Chaque cas couvre les DEUX modes (règle
 * `combat-aa-avantage-groupe` active/inactive).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from '../policy';
import { activeVariant } from '../variants';
import { findTalentById } from '../../data';
import { slugId } from '../../data/slug';
import {
  hasStealAdvantage, stealsOneAdvantage, shieldReactionCost, shieldAdvantageLevel,
  retreatAdvantageCost, keptAdvantageOnDisengage, canDisengageWithLessAdvantage,
  fearSizeAsMount, advantageTransferWeight, reloadGrantsAssessAdvantage, hasCritRollTwiceTalent,
  talentCritExtraWounds,
} from './dispatch';
import type { Combatant, Weapon } from '../types';

afterEach(() => resetRule('combat-aa-avantage-groupe'));

const w = (over: Partial<Weapon> = {}): Weapon =>
  ({ label: 'Bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 2 }], ...over });

function mk(names: string[], over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: names.map((n) => ({ talentId: slugId(n), times: 1 })), movement: 4,
    ...over,
  } as Combatant;
}

describe('provenance 1 — capacité MÉCANIQUE (dispatch.featuresOf, via effectiveFeature)', () => {
  it('Renversement (cas d’école) : LDB = vole TOUT ; mode groupe = vole 1 dans la réserve adverse', () => {
    const c = mk(['Renversement']);
    expect(hasStealAdvantage(c)).toBe(true);
    expect(stealsOneAdvantage(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(hasStealAdvantage(c)).toBe(false); // LDB steal-all ÉTEINT en mode groupe
    expect(stealsOneAdvantage(c)).toBe(true);
  });

  it('Porte-Bouclier : LDB = Avantage au porteur si perdant ; mode groupe = réaction à coût (2)', () => {
    const c = mk(['Porte-Bouclier', 'Porte-Bouclier']); // 2 acquisitions = niveau 2
    expect(shieldAdvantageLevel(c, w())).toBe(2);
    expect(shieldReactionCost(c, w())).toBe(0);
    setRule('combat-aa-avantage-groupe', true);
    expect(shieldAdvantageLevel(c, w())).toBe(0); // shieldAdvantage ÉTEINT en mode groupe
    expect(shieldReactionCost(c, w())).toBe(2);
  });

  it('Impitoyable : LDB = garde niveau Avantages + Désengagement sans supériorité ; mode groupe = coût de Retraite à 1', () => {
    const c = mk(['Impitoyable']);
    expect(keptAdvantageOnDisengage(c)).toBe(1);
    expect(canDisengageWithLessAdvantage(c)).toBe(true);
    expect(retreatAdvantageCost(c)).toBe(2); // défaut LDB
    setRule('combat-aa-avantage-groupe', true);
    expect(keptAdvantageOnDisengage(c)).toBe(0);
    expect(canDisengageWithLessAdvantage(c)).toBe(false);
    expect(retreatAdvantageCost(c)).toBe(1);
  });

  it('Cavalier émérite : aucune capacité LDB (le Talent n’a pas de mécanique de combat de base) ; mode groupe → Taille de Peur = celle de la monture', () => {
    const c = mk(['Cavalier émérite']);
    expect(fearSizeAsMount(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(fearSizeAsMount(c)).toBe(true);
  });

  it('Coude-à-coude : mode groupe → poids de transfert 2 (défaut 1 hors mode groupe / sans Talent)', () => {
    const c = mk(['Coude-à-coude']);
    expect(advantageTransferWeight(c)).toBe(1);
    setRule('combat-aa-avantage-groupe', true);
    expect(advantageTransferWeight(c)).toBe(2);
  });

  it('Artilleur / Rechargement rapide : mode groupe → recharger compte comme Évaluer (+1 Avantage)', () => {
    const c = mk(['Artilleur', 'Rechargement rapide']);
    expect(reloadGrantsAssessAdvantage(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(reloadGrantsAssessAdvantage(c)).toBe(true);
  });

  it('Frappe blessante : LDB = +niveau Blessures sur Critique ; mode groupe = deux lancers, garde le préféré (pas de bonus de Blessures)', () => {
    const c = mk(['Frappe blessante']);
    expect(talentCritExtraWounds(c)).toBe(1);
    expect(hasCritRollTwiceTalent(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(talentCritExtraWounds(c)).toBe(0);
    expect(hasCritRollTwiceTalent(c)).toBe(true);
  });
});

describe('provenance 2 — affichage CODEX (activeVariant direct, même primitive que ui/compendium/registry.ts)', () => {
  it('la desc de chaque talent migré bascule LDB ↔ AA avec la règle, verbatim dans variants[0]', () => {
    for (const id of ['artilleur', 'battement', 'cavalier-emerite', 'coude-a-coude', 'distraire', 'impitoyable', 'porte-bouclier', 'rechargement-rapide', 'renversement', 'frappe-blessante']) {
      const t = findTalentById(id)!;
      const td = t as unknown as { variants?: { when: { rule: string }; desc?: string }[] };
      expect(activeVariant(td.variants)).toBeUndefined(); // mode LDB : aucune variante active
      setRule('combat-aa-avantage-groupe', true);
      const v = activeVariant(td.variants);
      expect(v?.desc).toBeTruthy();
      expect(v?.desc).not.toBe(t.desc); // la variante AA diffère toujours du texte LDB
      resetRule('combat-aa-avantage-groupe');
    }
  });
});

describe('provenance 3 — câblage combatFlow (Frappe blessante variante AA → hasCritRollTwiceTalent, même point que Bénédiction de Sauvagerie)', () => {
  it('un porteur de Frappe blessante ne porte le drapeau permanent QUE sous la règle active', () => {
    const c = mk(['Frappe blessante']);
    expect(hasCritRollTwiceTalent(c)).toBe(false);
    setRule('combat-aa-avantage-groupe', true);
    expect(hasCritRollTwiceTalent(c)).toBe(true);
    resetRule('combat-aa-avantage-groupe');
    expect(hasCritRollTwiceTalent(c)).toBe(false);
  });
});
