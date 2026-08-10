import { describe, it, expect } from 'vitest';
import { castTestTalentDR } from '../engine/magic';
import type { Combatant } from '../engine/types';

/**
 * Aura de Dhar (frenchy-bzh 295 l.233 / 313 l.341, deux entrées : Slaanesh 10 m, Nurgle 11 m). Câblée en
 * DONNÉE : `TraitData.aura` porte des op `skillDRBonus` filtrées par Groupe de dieu (`affectsGroups`) et
 * `includesSelf` ; le hook `recompute-auras` les projette dans `auraMods` des cibles, et le LANCEMENT les
 * lit via `castTestTalentDR` (qui somme `skillDRBonus` comme un Talent). Ici on vérifie le versant
 * cast↔aura : un caster dont `auraMods` porte le bonus voit son DR d'incantation augmenté.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'm', name: 'Mage', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 40, sociabilite: 30 },
  skills: [], talents: [], traits: [], conditions: [], activeEffects: [],
  ...over,
}) as unknown as Combatant;

/** Une op d'aura telle que la PROJETTE le hook `recompute-auras` : emballée en `PassiveMod`, avec le
 *  trait émetteur en `src`. */
const aura = (op: unknown) => ({ op, src: { category: 'traits', id: 'aura-de-dhar-slaanesh' } });

describe('Aura de Dhar — +1 DR au lancement lu depuis auraMods (cast↔aura)', () => {
  it('castTestTalentDR somme le skillDRBonus d’aura (Langue (Magick) ET Focalisation)', () => {
    const c = mk({ auraMods: [aura({ op: 'skillDRBonus', skill: 'langue', spec: 'magick', bonus: 1 }), aura({ op: 'skillDRBonus', skill: 'focalisation', bonus: 1 })] as never });
    expect(castTestTalentDR(c, 'langue', 'magick')).toBe(1);
    expect(castTestTalentDR(c, 'focalisation')).toBe(1);
    expect(castTestTalentDR(c, 'priere')).toBe(0); // l’aura ne porte pas de DR de Prière
  });

  it('la spec est respectée : Langue (Magick) boostée, mais PAS Langue (Bretonnien)', () => {
    const c = mk({ auraMods: [aura({ op: 'skillDRBonus', skill: 'langue', spec: 'magick', bonus: 1 })] as never });
    expect(castTestTalentDR(c, 'langue', 'magick')).toBe(1);
    expect(castTestTalentDR(c, 'langue', 'Bretonnien')).toBe(0); // spec ≠ → aucun bonus (le sort seul est boosté)
  });

  it('sans aura → aucun bonus de DR', () => {
    expect(castTestTalentDR(mk(), 'langue', 'magick')).toBe(0);
  });

  it('cumule avec un second exemplaire d’aura (sources distinctes — DR additif)', () => {
    const c = mk({ auraMods: [aura({ op: 'skillDRBonus', skill: 'langue', spec: 'magick', bonus: 1 }), aura({ op: 'skillDRBonus', skill: 'langue', spec: 'magick', bonus: 1 })] as never });
    expect(castTestTalentDR(c, 'langue', 'magick')).toBe(2);
  });
});
