import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import {
  mightFromRelation, estimateMightFromAspects, warMachineMight, normalizeMights,
  mightReduction, rollMightTest, resolveClash, applyMightDelta,
  battleOutcome, isDestroyed, inspireDifficulty, difficultyFromModifier, roundToTen,
  battleHazard, battleSceneById, battleActivityById, clampMight, MIGHT_MODIFIERS, POWER_ESTIMATE,
  WAR_MACHINES, STRUCTURES, BATTLE_HAZARDS,
  sceneDeltas, sceneChains, effectAmount, condMet, testResolution, combatResolution,
  rallyHealAmount, activityOutcomes,
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
  it('montant signé d\'un effet : perDR × DR, perHit × touches, perKill × kills, fixed plat', () => {
    const win = combatResolution(5, 1, 1); // 5 touches, 1 kill
    // Motivation : ally +DR (l.151).
    expect(effectAmount({ side: 'ally', scale: 'perDR', amount: 1 }, testResolution(true, 4))).toBe(4);
    // Charge (l.139) : −1 par touche, −2 par kill.
    expect(effectAmount({ side: 'enemy', scale: 'perHit', amount: -1 }, win)).toBe(-5);
    expect(effectAmount({ side: 'enemy', scale: 'perKill', amount: -2 }, win)).toBe(-2);
    // Duel : enemy −20 plat (l.225).
    expect(effectAmount({ side: 'enemy', scale: 'fixed', amount: -20 }, win)).toBe(-20);
  });

  it('Charge (l.139) : deltas = −1/touche ET −2/kill (5 touches + 1 kill = −7)', () => {
    const charge = battleSceneById('charge')!;
    const deltas = sceneDeltas(charge, combatResolution(5, 1, 1));
    const total = deltas.reduce((s, d) => s + d.amount, 0);
    expect(total).toBe(-7); // 5×−1 + 1×−2 (l.139 : « touché » −1, « neutralisé » −2 de plus)
  });

  it('Ligne de mire (l.208) : −5 de base, −5 de PLUS si le général tombe (Succès Stupéfiant)', () => {
    const ldm = battleSceneById('ligne-de-mire')!;
    expect(sceneDeltas(ldm, testResolution(true, 2)).reduce((s, d) => s + d.amount, 0)).toBe(-5);
    expect(sceneDeltas(ldm, testResolution(true, 6)).reduce((s, d) => s + d.amount, 0)).toBe(-10);
  });

  it('Survol (l.217) : −5, et −15 de PLUS si le général tombe ; Échec Stupéfiant → Charge', () => {
    const survol = battleSceneById('survol')!;
    expect(sceneDeltas(survol, testResolution(true, 2)).reduce((s, d) => s + d.amount, 0)).toBe(-5);
    expect(sceneDeltas(survol, testResolution(true, 6)).reduce((s, d) => s + d.amount, 0)).toBe(-20);
    // Échec Stupéfiant (DR ≤ −6) : chute + Charge imposée au Round suivant.
    expect(sceneChains(survol, testResolution(false, -6))).toEqual(['charge']);
    expect(sceneChains(survol, testResolution(false, -2))).toEqual([]);
  });

  it('Duel (l.225) : −20 en solo, −10 + Charge si intervention', () => {
    const duel = battleSceneById('duel')!;
    // Victoire solo (1 frappeur) → −20, pas de Charge.
    expect(sceneDeltas(duel, combatResolution(3, 1, 1)).reduce((s, d) => s + d.amount, 0)).toBe(-20);
    expect(sceneChains(duel, combatResolution(3, 1, 1))).toEqual([]);
    // Intervention (2 frappeurs) → −10 + Charge enchaînée.
    expect(sceneDeltas(duel, combatResolution(4, 1, 2)).reduce((s, d) => s + d.amount, 0)).toBe(-10);
    expect(sceneChains(duel, combatResolution(4, 1, 2))).toEqual(['charge']);
  });

  it('condMet : un effet sans `when` s\'applique sur Succès ; les `when` gatent le reste', () => {
    expect(condMet(undefined, testResolution(true, 0))).toBe(true);
    expect(condMet(undefined, testResolution(false, 0))).toBe(false);
    expect(condMet('failure', testResolution(false, -2))).toBe(true);
    expect(condMet('stunningFailure', testResolution(false, -6))).toBe(true);
    expect(condMet('stunningFailure', testResolution(false, -3))).toBe(false);
    expect(condMet('generalDown', testResolution(true, 6))).toBe(true);
    expect(condMet('generalDown', testResolution(true, 3))).toBe(false);
  });

  it('enchaînements sur échec : Compte à rebours → Motivation ; Percée → Charge', () => {
    expect(sceneChains(battleSceneById('compte-a-rebours')!, testResolution(false, -2))).toEqual(['motivation']);
    expect(sceneChains(battleSceneById('percee')!, testResolution(false, -2))).toEqual(['charge']);
    expect(sceneChains(battleSceneById('percee')!, testResolution(true, 2))).toEqual([]);
  });

  it('les gains d\'une Scène sont plafonnés à la Puissance de départ (l.135)', () => {
    expect(applyMightDelta(55, 60, 10)).toBe(60);
    expect(applyMightDelta(6, 60, -10)).toBe(0);
    expect(applyMightDelta(40, 60, 10)).toBe(50);
  });

  it('catalogue de Scènes data-driven — 12 Scènes + menace Intrus', () => {
    expect(battleSceneById('motivation')?.kind).toBe('test');
    expect(battleSceneById('charge')?.kind).toBe('combat');
    expect(battleSceneById('intrus')?.kind).toBe('threat');
    expect(battleSceneById('intrus')?.threat?.penalty).toBe(-20);
    expect(battleSceneById('duel')?.effects).toEqual([
      { side: 'enemy', scale: 'fixed', amount: -20, when: 'noIntervention' },
      { side: 'enemy', scale: 'fixed', amount: -10, when: 'intervention' },
    ]);
  });
});

describe('Rassemblement (l.122) & Activités pré-combat (l.79-106)', () => {
  it('Rassemblement : guérit DR + Bonus d\'Endurance', () => {
    expect(rallyHealAmount(3, 4)).toBe(7);
    expect(rallyHealAmount(0, 4)).toBe(4);
    expect(rallyHealAmount(-2, 4)).toBe(4); // DR négatif borné à 0
  });

  it('Activités : Succès Stupéfiant remplace le Succès ; Échec Stupéfiant applique sa pénalité', () => {
    const plan = battleActivityById('planification')!;
    expect(activityOutcomes(plan, true, 2)).toEqual([{ target: 'allyTestMod', amount: 10 }]); // Succès +10 (l.81)
    expect(activityOutcomes(plan, true, 6)).toEqual([{ target: 'allyTestMod', amount: 20 }]); // Stupéfiant +20
    const rassembler = battleActivityById('rassembler-des-forces')!;
    expect(activityOutcomes(rassembler, true, 6)).toEqual([{ target: 'allyMight', amount: 10 }]);
    expect(activityOutcomes(rassembler, false, -6)).toEqual([{ target: 'allyMight', amount: -10 }]); // mutinerie (l.96)
    expect(activityOutcomes(rassembler, false, -2)).toEqual([]);
    // Sabotage : −5 / −10 sur la Puissance ennemie (l.106).
    const sab = battleActivityById('sabotage')!;
    expect(activityOutcomes(sab, true, 6)).toEqual([{ target: 'enemyMight', amount: -10 }]);
  });

  it('prérequis d\'Activités data-driven', () => {
    expect(battleActivityById('infiltration')?.requires).toBe('planned');
    expect(battleActivityById('sabotage')?.requires).toBe('scouted');
    expect(battleActivityById('reperage')?.grantsFlag).toBe('scouted');
    expect(battleActivityById('planification')?.grantsFlag).toBe('planned');
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
