/**
 * Curation VDM des TALENTS (#734, chantier `chantier:VDM` #834) — preuves de CÂBLAGE, pas de témoins :
 * chaque assertion passe par le chemin réel du moteur (`effectiveEntry` → `talentTestSLBonus`), et
 * rougit si l'on débranche la variante, la règle qui la gate, ou la ligne « Tests » qu'elle republie.
 *
 * Périmètre PROUVÉ ici : la variante `magic-vdm-incantation` de *Concocter* (`VDM 12 l.411-421`).
 * Les 7 Talents `Empreint de (Vent)` neufs et `Assistant magique` (`VDM 13 l.461`/`l.487`) n'ont AUCUN
 * effet mécanique câblable aujourd'hui (aura de +DR portée par un TALENT, substitution de Compétence,
 * Soutien à +20) : ce fichier prouve donc ce qui existe pour eux — leur ligne « Tests » consommée par
 * la règle universelle de +DR de Talent (LDB 10 l.20).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setRule, resetRule } from './policy';
import { effectiveEntry, activeVariant } from './variants';
import { talentTestSLBonus } from './magic';
import { findTalentById } from '../data';
import type { Combatant } from './types';

const RULE = 'magic-vdm-incantation';
afterEach(() => resetRule(RULE));

function withTalents(ids: { talentId: string; times: number }[]): Combatant {
  return {
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: ids, movement: 4,
  } as unknown as Combatant;
}

describe('Concocter — variante « Règles d’incantation révisées » (VDM 12 l.411-421)', () => {
  const concocter = () => findTalentById('concocter')!;

  it('règle OFF : entrée LDB strictement inchangée (aucune variante active)', () => {
    const base = concocter() as unknown as { variants?: { when: { rule: string } }[] };
    expect(activeVariant(base.variants)).toBeUndefined();
    expect(effectiveEntry(concocter()).test?.raw).toBe('Savoir (Apothicaire)');
    expect(effectiveEntry(concocter()).source).toEqual({ book: 'livre-de-base', page: 135 });
  });

  it('règle ON : la ligne « Tests », la desc et l’ancre de source basculent sur la forme VDM', () => {
    setRule(RULE, true);
    const eff = effectiveEntry(concocter());
    expect(eff.test?.raw).toBe('Métier (Apothicaire) ou Métier (Alchimiste)');
    expect(eff.test?.matches).toEqual([
      { skill: 'metier', spec: 'apothicaire' },
      { skill: 'metier', spec: 'alchimiste' },
    ]);
    expect(eff.source).toEqual({ book: 'vents-de-la-magie', page: 161 });
    expect(eff.desc).toContain('Brasser une potion');
  });

  it('MORSURE — le +DR de Talent (LDB 10 l.20) change de Compétence avec la règle', () => {
    const c = withTalents([{ talentId: 'concocter', times: 1 }]);
    // OFF : le Talent bonifie Savoir (Apothicaire), pas Métier.
    expect(talentTestSLBonus(c, { skill: 'savoir', spec: 'Apothicaire' })).toBe(1);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'apothicaire' })).toBe(0);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(0);
    setRule(RULE, true);
    // ON : il bonifie Métier (Apothicaire) ET Métier (Alchimiste), plus Savoir.
    expect(talentTestSLBonus(c, { skill: 'savoir', spec: 'Apothicaire' })).toBe(0);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'apothicaire' })).toBe(1);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(1);
  });

  it('le +DR suit le nombre d’acquisitions sous la règle (×2 → +2 DR)', () => {
    const c = withTalents([{ talentId: 'concocter', times: 2 }]);
    setRule(RULE, true);
    expect(talentTestSLBonus(c, { skill: 'metier', spec: 'alchimiste' })).toBe(2);
  });
});

describe('Empreint de (Vent) — 8 Talents, un par Vent (VDM 13 l.461)', () => {
  /** Les 8 Vents de `domains.json`, avec le Talent qui les porte et la Compétence que sa ligne
   *  « Tests » désigne. `empreint-d-ulgu` est l'ANCRE NADAJ du même Talent, republié par VDM. */
  const WINDS: { id: string; skill?: { skill: string; spec?: string } }[] = [
    { id: 'empreint-d-aqshy' },
    { id: 'empreint-d-azyr', skill: { skill: 'perception' } },
    { id: 'empreint-de-chamon', skill: { skill: 'evaluation' } },
    { id: 'empreint-de-ghur', skill: { skill: 'emprise-sur-les-animaux' } },
    { id: 'empreint-de-ghyran', skill: { skill: 'soin-aux-animaux' } },
    { id: 'empreint-de-hysh', skill: { skill: 'recherche' } },
    { id: 'empreint-de-shyish', skill: { skill: 'intimidation' } },
    { id: 'empreint-d-ulgu', skill: { skill: 'discretion' } },
  ];

  it('les 8 existent, Maxi 1, et les 7 neufs sont ancrés au folio 186 des Vents de Magie', () => {
    for (const { id } of WINDS) {
      const t = findTalentById(id);
      expect(t, id).toBeTruthy();
      expect(t!.max, id).toBe(1);
    }
    const vdm = WINDS.filter((w) => w.id !== 'empreint-d-ulgu');
    expect(vdm).toHaveLength(7);
    for (const { id } of vdm) {
      expect(findTalentById(id)!.source, id).toEqual({ book: 'vents-de-la-magie', page: 186 });
    }
  });

  it('Empreint d’Ulgu (NADAJ 88) porte la republication VDM en emplacement SECONDAIRE, pas un doublon', () => {
    const ulgu = findTalentById('empreint-d-ulgu')! as unknown as { alsoIn?: { book: string; page: number }[] };
    expect(findTalentById('empreint-d-ulgu')!.source).toEqual({ book: 'nuits-agitees-et-dures-journees', page: 88 });
    expect(ulgu.alsoIn).toEqual([expect.objectContaining({ book: 'vents-de-la-magie', page: 186 })]);
  });

  it('MORSURE — la Compétence désignée par la ligne « Tests » de chaque Vent reçoit le +DR de Talent', () => {
    for (const { id, skill } of WINDS) {
      const c = withTalents([{ talentId: id, times: 1 }]);
      if (!skill) { // Aqshy ne désigne aucun Test : il octroie le Talent Frénésie
        expect(findTalentById(id)!.test?.matches, id).toEqual([]);
        continue;
      }
      expect(talentTestSLBonus(c, skill), id).toBe(1);
      expect(talentTestSLBonus(c, { skill: 'natation' }), id).toBe(0);
    }
  });
});

describe('Assistant magique — Talent de familier de pouvoir (VDM 13 l.487)', () => {
  it('existe, Maxi 1, ancré au folio 186, sans ligne « Tests »', () => {
    const t = findTalentById('assistant-magique')!;
    expect(t.max).toBe(1);
    expect(t.test).toBeNull();
    expect(t.source).toEqual({ book: 'vents-de-la-magie', page: 186 });
  });
});
