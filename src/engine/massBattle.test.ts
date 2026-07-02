import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import {
  mightFromRelation, estimateMightFromAspects, warMachineMight, normalizeMights,
  mightReduction, rollMightTest, resolveClash, sceneMightDelta, applyMightDelta,
  battleOutcome, isDestroyed, inspireDifficulty, difficultyFromModifier, roundToTen,
  battleHazard, battleSceneById, clampMight, MIGHT_MODIFIERS, POWER_ESTIMATE,
  WAR_MACHINES, STRUCTURES, BATTLE_HAZARDS,
} from './massBattle';

/** RNG déterministe : renvoie tour à tour les d100 fournis (bornés à [min,max]). */
function seqRNG(...vals: number[]): RNG {
  let i = 0;
  return { int: (min, max) => Math.max(min, Math.min(max, vals[i++ % vals.length])) };
}

describe('Puissance de Bataille — estimation (ADE II 08 l.24-47)', () => {
  it('table de force relative (l.28-32) : couple {allié, ennemi}', () => {
    expect(mightFromRelation('egale')).toEqual({ ally: 50, enemy: 50 });
    expect(mightFromRelation('insignifiante')).toEqual({ ally: 30, enemy: 70 });
    expect(mightFromRelation('ecrasante')).toEqual({ ally: 70, enemy: 30 });
    expect(POWER_ESTIMATE).toHaveLength(5);
  });

  it('méthode des aspects (l.34-47) : 30 + Σ modificateurs', () => {
    // Chevaliers Panthères : Bien équipée (+10) + Vétérans (+10) → 50 (exemple l.48).
    expect(estimateMightFromAspects(['bien-equipee', 'unites-veterans'])).toBe(50);
    // Orcs Vétérans (+10) → 40 (exemple l.48).
    expect(estimateMightFromAspects(['unites-veterans'])).toBe(40);
    // Aucun aspect → base 30 (l.34).
    expect(estimateMightFromAspects([])).toBe(30);
    // Signe des modificateurs verbatim.
    expect(MIGHT_MODIFIERS.find((m) => m.id === 'taille-monstrueuse')!.mod).toBe(30);
    expect(MIGHT_MODIFIERS.find((m) => m.id === 'mal-equipee')!.mod).toBe(-10);
  });

  it('machines de guerre et Puissance (l.302-304)', () => {
    // +5 par machine.
    expect(warMachineMight([{}, {}])).toBe(10);
    // Siège offensif : +10 pour une machine à Atout Siège (mais +5 pour une machine sans Siège).
    expect(warMachineMight([{ siege: true }, { siege: false }], { siege: true, offensive: true })).toBe(15);
    // Équipage incomplet → contribution ÷2.
    expect(warMachineMight([{ fullCrew: false }])).toBe(2.5);
    // Hors siège : l'Atout Siège n'apporte que +5.
    expect(warMachineMight([{ siege: true }], { offensive: true })).toBe(5);
  });

  it('normalisation (l.34) : retirer 10 aux deux jusqu\'à ≤ 100 ; décidé si écart brut > 100', () => {
    expect(normalizeMights(50, 50)).toEqual({ ally: 50, enemy: 50, decided: false });
    // 120 vs 40 → −80 des deux (retire 20) → 100 vs 20.
    expect(normalizeMights(120, 40)).toEqual({ ally: 100, enemy: 20, decided: false });
    // Écart brut > 100 → issue déjà décidée ; l'ennemi tombe à 0 après clamp.
    const r = normalizeMights(150, 30);
    expect(r.decided).toBe(true);
    expect(r.ally).toBe(100);
    expect(r.enemy).toBe(0);
  });
});

describe('Test spectaculaire de Puissance (l.120)', () => {
  it('réduction = 10 + DR, minimum 5', () => {
    expect(mightReduction(0)).toBe(10);
    expect(mightReduction(3)).toBe(13);
    expect(mightReduction(-3)).toBe(7);
    expect(mightReduction(-6)).toBe(5); // 10 − 6 = 4 → plancher 5
    expect(mightReduction(-20)).toBe(5);
  });

  it('un Test NON opposé jette d100 ≤ Puissance', () => {
    const t = rollMightTest(60, 0, seqRNG(34));
    expect(t.roll).toBe(34);
    expect(t.success).toBe(true);
    expect(t.sl).toBe(3); // dizaines(60) − dizaines(34) = 6 − 3
  });

  it('affrontement simultané : chaque armée réduit l\'adverse de 10 + son DR (min 5)', () => {
    // Allié 60 → jette 34 (DR +3) ; Ennemi 40 → jette 55 (échec, DR −1 : dizaines 4 − 5).
    const c = resolveClash(60, 40, { rng: seqRNG(34, 55) });
    expect(c.allyTest.sl).toBe(3);
    expect(c.enemyTest.sl).toBe(-1);
    expect(c.enemyLoss).toBe(13); // 10 + 3
    expect(c.allyLoss).toBe(9); // 10 − 1
    expect(c.enemyMight).toBe(40 - 13); // 27
    expect(c.allyMight).toBe(60 - 9); // 51
  });

  it('les Puissances ne descendent jamais sous 0', () => {
    const c = resolveClash(4, 100, { rng: seqRNG(1, 1) });
    expect(c.allyMight).toBe(0); // 4 − (10 + DRmax) plancher 0
  });
});

describe('Discours inspirant (l.71)', () => {
  it('Difficulté depuis l\'écart de Puissance, arrondi à la dizaine', () => {
    expect(roundToTen(23)).toBe(20);
    expect(roundToTen(-24)).toBe(-20);
    // Allié en avance (60 vs 40, écart +20) → Test plus facile (Accessible +20).
    expect(inspireDifficulty(60, 40)).toBe('accessible');
    // Allié à égalité → Intermédiaire (+0).
    expect(inspireDifficulty(50, 50)).toBe('intermediaire');
    // Allié en retard (30 vs 60, écart −30) → Très difficile (−30).
    expect(inspireDifficulty(30, 60)).toBe('tresDifficile');
  });

  it('mappe un modificateur sur la bande de Difficulté la plus proche', () => {
    expect(difficultyFromModifier(0)).toBe('intermediaire');
    expect(difficultyFromModifier(40)).toBe('facile');
    expect(difficultyFromModifier(-20)).toBe('difficile');
  });
});

describe('Scènes cinématiques (l.135-225)', () => {
  it('delta signé : perDR × DR, perKill × ennemis, fixed plat', () => {
    // Motivation : ally +DR (l.151).
    expect(sceneMightDelta({ side: 'ally', scale: 'perDR', amount: 1 }, 4)).toBe(4);
    // Charge : enemy −2 par ennemi neutralisé (l.139).
    expect(sceneMightDelta({ side: 'enemy', scale: 'perKill', amount: -2 }, 3)).toBe(-6);
    // Duel : enemy −20 plat (l.225).
    expect(sceneMightDelta({ side: 'enemy', scale: 'fixed', amount: -20 }, 0)).toBe(-20);
  });

  it('les gains d\'une Scène sont plafonnés à la Puissance de départ (l.135)', () => {
    // Départ 60, courant 55 → +DR 10 plafonné à 60.
    expect(applyMightDelta(55, 60, 10)).toBe(60);
    // Une perte va jusqu'à 0.
    expect(applyMightDelta(6, 60, -10)).toBe(0);
    // Un gain sous le plafond passe.
    expect(applyMightDelta(40, 60, 10)).toBe(50);
  });

  it('catalogue de Scènes data-driven', () => {
    expect(battleSceneById('motivation')?.kind).toBe('test');
    expect(battleSceneById('charge')?.kind).toBe('combat');
    expect(battleSceneById('duel')?.effect).toEqual({ side: 'enemy', scale: 'fixed', amount: -20 });
  });
});

describe('Issue de la bataille (l.124) & aléa (l.309)', () => {
  it('l\'armée à la plus haute Puissance gagne', () => {
    expect(battleOutcome(30, 20)).toBe('ally');
    expect(battleOutcome(10, 40)).toBe('enemy');
    expect(battleOutcome(25, 25)).toBe('draw');
    expect(isDestroyed(0)).toBe(true);
    expect(isDestroyed(5)).toBe(false);
  });

  it('facteur environnemental 1d10 (l.311-322)', () => {
    expect(BATTLE_HAZARDS).toHaveLength(10);
    expect(battleHazard(1).label).toBe('Tempête');
    expect(battleHazard(10).label).toBe('Peur');
    // Table verbatim des structures/machines chargée.
    expect(STRUCTURES.find((s) => s.id === 'mur-en-pierre')).toMatchObject({ be: 12, wounds: 40 });
    expect(WAR_MACHINES.find((m) => m.id === 'canon')?.siege).toBe(true);
  });

  it('clampMight borne et arrondit', () => {
    expect(clampMight(-4)).toBe(0);
    expect(clampMight(130)).toBe(100);
    expect(clampMight(49.6)).toBe(50);
  });
});
