import { describe, it, expect } from 'vitest';
import { MORALE_BASE, MORALE_FACTORS, MORALE_BANDS, moraleBand, recalcMorale } from './crewMorale';
import { makeRNG } from './dice';

/**
 * MORAL d'équipage (MDG ch.14) — système PROPRE à la Mer des Griffes (aucun équivalent LDB/AA). Le code
 * est générique ; la donnée (facteurs + bandes) vit dans `crew-morale.json`. Les « Tests d'équipage »
 * réutilisent la primitive de Soutien (testée ailleurs) — on ne teste ici que le Moral.
 */
describe('Moral d’équipage — données verbatim + recalcul hebdomadaire', () => {
  it('débute à 75 (nouveau capitaine / nouvel équipage)', () => {
    expect(MORALE_BASE).toBe(75);
  });

  it('catalogue complet : 28 facteurs (ids stables) + 4 bandes contiguës couvrant tout le spectre', () => {
    expect(MORALE_FACTORS).toHaveLength(28);
    for (const f of MORALE_FACTORS) expect(f.id && f.label && f.effect).toBeTruthy();
    expect(MORALE_BANDS).toHaveLength(4);
  });

  it('bandes d’EFFET (DR + désertion) classées par score', () => {
    expect(moraleBand(120).id).toBe('mene-de-main-de-maitre'); // 101+ : Cmd +2 DR, équipage +1 DR
    expect(moraleBand(120)).toMatchObject({ captainCmdDR: 2, crewTestDR: 1 });
    expect(moraleBand(80).id).toBe('excellent-equipage'); // 76-100 : Cmd +1 DR
    expect(moraleBand(80)).toMatchObject({ captainCmdDR: 1, crewTestDR: 0 });
    expect(moraleBand(60).id).toBe('equipage-satisfait'); // 51-75 : désertion sur 04-
    expect(moraleBand(60).desertionRoll).toBe(4);
    expect(moraleBand(30).id).toBe('canailles'); // 50- : Cmd/équipage -1 DR, désertion sur 16-
    expect(moraleBand(30)).toMatchObject({ captainCmdDR: -1, crewTestDR: -1, desertionRoll: 16 });
  });

  it('recalcul hebdo : les facteurs ACTIFS montent/descendent le Moral (dés signés, déterministe)', () => {
    // « Pas de paie » (−3d10) + « capitaine lâche » (−2d10) font dégringoler le Moral.
    const down = recalcMorale(75, ['pas-de-paie', 'capitaine-lache'], makeRNG(1));
    expect(down.delta).toBeLessThan(0);
    expect(down.score).toBe(75 + down.delta);
    expect(down.lines).toHaveLength(2);
    // « Paie généreuse » (+2d10) + « capitaine compétent » (+2d10) le font remonter.
    const up = recalcMorale(50, ['paie-genereuse', 'capitaine-competent'], makeRNG(1));
    expect(up.delta).toBeGreaterThan(0);
    expect(up.score).toBe(50 + up.delta);
  });

  it('un id de facteur inconnu est ignoré (pas de NaN, pas de plantage)', () => {
    const r = recalcMorale(75, ['inexistant'], makeRNG(1));
    expect(r.delta).toBe(0);
    expect(r.score).toBe(75);
    expect(r.lines).toHaveLength(0);
  });

  it('borne basse : un score très négatif retombe sur « canailles » (findTableEntry)', () => {
    expect(moraleBand(-200).id).toBe('canailles');
    expect(moraleBand(50).id).toBe('canailles'); // 50 = borne haute de la bande basse
    expect(moraleBand(51).id).toBe('equipage-satisfait');
  });
});
