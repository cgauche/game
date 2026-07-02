import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { createHero } from './character';
import { makeRNG } from './dice';
import {
  rollRiverWind, tickRiverWind, riverWindEffect, savoirVoiesFluvialesBonus, riverPilotSkill,
  riverControlKept, rowingAgilityFactor, riverDayKm, riverDriftKm, navDifficultyWithPenalty,
  difficultyFromModifier, resolveCapsizeRighting, capsizeSinkTurns, holeSinkMinutes,
  riverCritical, resolveRiverImpact, rollBarrage, echouageDamage, findRiverPeril, RIVER_PERILS,
} from './riverNavigation';

/**
 * NAVIGATION FLUVIALE — couche PURE de T2C ch.5 (« Navigation fluviale »). Tables VERBATIM du chapitre,
 * jets déterministes (RNG injecté). Chaque assertion cite la ligne source.
 */

/** RNG constant : renvoie toujours la borne haute (d100 → 100, d10 → 10) ou basse (→ 1). */
const hi: RNG = { int: (_min, max) => max };
const lo: RNG = { int: (min) => min };

describe('Table des vents (T2C ch.5 l.21-33)', () => {
  it('force + direction tirées sur 1d10 chacun (bandes VERBATIM)', () => {
    expect(rollRiverWind(lo)).toEqual({ force: 'calme', dir: 'arriere' }); // d10=1 → Calme / Vent arrière
    expect(rollRiverWind(hi)).toEqual({ force: 'tres-fort', dir: 'contraire' }); // d10=10 → Très fort / contraire
  });

  it('effet du vent (%) — colonnes VERBATIM du Tableau des vents (l.29-33)', () => {
    expect(riverWindEffect('leger', 'arriere')).toEqual({ pct: 5 });
    expect(riverWindEffect('leger', 'contraire')).toEqual({ pct: -5 });
    expect(riverWindEffect('modere', 'cote')).toEqual({ pct: 5, tack: true }); // note 3 : louvoyer
    expect(riverWindEffect('fort', 'arriere')).toEqual({ pct: 20 });
    expect(riverWindEffect('calme', 'arriere')).toEqual({ drift: true }); // note 2 : Dérive
    expect(riverWindEffect('tres-fort', 'cote')).toEqual({ capsizeRisk: true }); // note 4 : chavirage
    expect(riverWindEffect('tres-fort', 'contraire')).toEqual({ pct: -25, riggingRisk: true }); // note 5
  });

  it('la force change d\'un cran sur un 1 (bornes : Calme→Léger, Très fort→Fort)', () => {
    // hi : d10=10 ≠ 1 → aucun changement.
    expect(tickRiverWind('modere', hi)).toBe('modere');
    // lo : d10=1 (== seuil), puis d10=1 ≤ 5 → forcir ; Calme ne peut que devenir Léger.
    expect(tickRiverWind('calme', lo)).toBe('leger');
    // Très fort borné : lo forcirait, mais Très fort ne peut que devenir Fort (l.21).
    expect(tickRiverWind('tres-fort', lo)).toBe('fort');
  });
});

describe('Navigation & rame (l.11-17)', () => {
  it('Savoir (Voies fluviales) → +1 DR si la Compétence est ACQUISE (avances > 0), sinon 0 (l.13)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'batelier', name: 'B', motivation: 'x', rng: makeRNG(1) });
    expect(savoirVoiesFluvialesBonus(h)).toBe(0);
    h.skills.push({ skillId: 'savoir', spec: 'Voies fluviales', characteristic: 'Int', advances: 10 });
    expect(savoirVoiesFluvialesBonus(h)).toBe(1);
  });

  it('embarcation : Voile si voilure, sinon Ramer — barque (l.11-13)', () => {
    expect(riverPilotSkill(true)).toBe('voile');
    expect(riverPilotSkill(false)).toBe('ramer');
  });

  it('contrôle gardé : réussite TOUJOURS ; échec de peu rattrapé par Savoir +1 DR (l.13)', () => {
    expect(riverControlKept(true, -5, 0)).toBe(true); // une réussite garde le cap
    expect(riverControlKept(false, -1, 1)).toBe(true); // échec −1 DR + Savoir +1 = 0 → rattrapé
    expect(riverControlKept(false, -1, 0)).toBe(false); // sans Savoir → contrôle perdu
    expect(riverControlKept(false, -5, 1)).toBe(false); // trop loin (−5 + 1 = −4) → perdu
  });

  it('Test d\'Agilité de rame : réussite = 1 ; échec = 0,8 (−20 %) ; Échec spectaculaire (−6 DR) = 0,5 (÷2) (l.17)', () => {
    expect(rowingAgilityFactor(true, 3)).toBe(1);
    expect(rowingAgilityFactor(false, -2)).toBeCloseTo(0.8);
    expect(rowingAgilityFactor(false, -6)).toBe(0.5);
    expect(rowingAgilityFactor(false, -7)).toBe(0.5);
  });

  it('km du jour = base × (1 + vent %) × Agilité ; dérive = 25 % de la base (l.29-33, note 2)', () => {
    expect(riverDayKm(48, 25, 1)).toBe(60); // vent arrière +25 %
    expect(riverDayKm(48, -25, 1)).toBe(36); // vent contraire −25 %
    expect(riverDayKm(48, 0, 0.8)).toBeCloseTo(38.4); // Agilité ratée
    expect(riverDriftKm(48)).toBe(12); // 25 %
  });

  it('difficulté de Navigation = base + malus plat (Dérive −10, hors de contrôle −20, gouvernail −30)', () => {
    expect(navDifficultyWithPenalty(0)).toBe('intermediaire');
    expect(navDifficultyWithPenalty(-10)).toBe('complexe');
    expect(navDifficultyWithPenalty(-20)).toBe('difficile');
    expect(difficultyFromModifier(20)).toBe('accessible');
  });
});

describe('Chavirage & naufrage (note 4 l.40 ; l.101-103)', () => {
  it('redressement : réussite au 1ᵉʳ Round → redressé (Navigation Accessible +20)', () => {
    const r = resolveCapsizeRighting(200, 4, lo); // valeur haute + d100=1 → réussite immédiate
    expect(r.righted).toBe(true);
    expect(r.sank).toBe(false);
    expect(r.rounds).toHaveLength(1);
  });

  it('non redressé en BE Rounds → coule (échecs cumulés −5)', () => {
    const r = resolveCapsizeRighting(0, 4, hi); // d100=100 → échec ; 4 Rounds (BE) épuisés
    expect(r.sank).toBe(true);
    expect(r.righted).toBe(false);
    expect(r.rounds).toHaveLength(4);
  });

  it('temporisation du naufrage : chavirage = BE tours ; coque percée = E minutes (l.40 / l.103)', () => {
    expect(capsizeSinkTurns(45)).toBe(4); // Bonus d'Endurance de 45
    expect(holeSinkMinutes(45)).toBe(45); // « un nombre de minutes égal à son Endurance »
  });
});

describe('Critiques de bateau (l.72-94)', () => {
  it('effets des Critiques déclenchés par la navigation : gréement (Empêtré + dérive), coque (percée)', () => {
    expect(riverCritical('greement')).toMatchObject({ splinterDamage: 5, initiativeTest: true, conditionId: 'empetre', driftUntilRepair: true });
    expect(riverCritical('coque')).toMatchObject({ hole: true });
  });
});

describe('Dangers de rivière (l.119-166)', () => {
  it('les quatre périls du chapitre sont chargés (débris/barrage/rochers/eaux peu profondes)', () => {
    expect(RIVER_PERILS.map((p) => p.id).sort()).toEqual(['barrage', 'debris', 'eaux-peu-profondes', 'rochers']);
    expect(findRiverPeril('debris')?.onFail).toEqual({ hullHits: 2, damagePerHit: 10 }); // l.125
  });

  it('impact sur rochers (l.140) : +15 Dégâts, 50 % percée, 20 % échouage', () => {
    const onHit = findRiverPeril('rochers')!.onHit!;
    expect(resolveRiverImpact(onHit, lo)).toEqual({ hullDamage: 15, holed: true, echoue: true }); // d100=1 ≤ 50 et ≤ 20
    expect(resolveRiverImpact(onHit, hi)).toEqual({ hullDamage: 15, holed: false, echoue: false }); // d100=100
  });

  it('barrage : Endurance 1d10 × 10, 2d10 Blessures (l.128) ; échouage = 12 Dégâts (l.99)', () => {
    const obs = findRiverPeril('barrage')!.obstacle!;
    expect(rollBarrage(obs, lo)).toEqual({ endurance: 10, wounds: 2 });
    expect(rollBarrage(obs, hi)).toEqual({ endurance: 100, wounds: 20 });
    expect(echouageDamage()).toBe(12);
  });
});
