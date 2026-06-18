/**
 * Voyage par Étapes (EDOC ch.5) — fonctions PURES.
 * Vérifie : nombre d'Étapes (l.34) ± bonus, table de Météo VERBATIM seedée (l.44-51), difficulté
 * d'Exposition selon l'équipement (l.73), rendement d'Approvisionnement (LDB 09 l.568-572), saisons.
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import {
  seasonOfMonth, isColdSeason,
  weatherFromRoll, rollStageWeather, WEATHER_TABLE,
  stageCount, stageExposureDifficulty,
  pleinAirModifier, forageWeatherModifier, forageYield,
  type Season,
} from './travelStages';

describe('seasonOfMonth (calendrier impérial → table de Météo)', () => {
  it('Jahrdrung/Pflugzeit/Sigmarzeit = printemps ; Sommerzeit = été ; Erntezeit = automne ; Vorhexen/Nachhexen = hiver', () => {
    expect(seasonOfMonth(1)).toBe('printemps'); // Jahrdrung (départ EiS)
    expect(seasonOfMonth(2)).toBe('printemps'); // Pflugzeit
    expect(seasonOfMonth(3)).toBe('printemps'); // Sigmarzeit
    expect(seasonOfMonth(4)).toBe('ete'); // Sommerzeit
    expect(seasonOfMonth(7)).toBe('automne'); // Erntezeit
    expect(seasonOfMonth(10)).toBe('hiver'); // Ulriczeit
    expect(seasonOfMonth(11)).toBe('hiver'); // Vorhexen
    expect(seasonOfMonth(0)).toBe('hiver'); // Nachhexen
  });
  it('jour intercalaire (month null) → printemps par défaut', () => {
    expect(seasonOfMonth(null)).toBe('printemps');
  });
  it('saisons froides (rhume, l.75) = printemps + hiver', () => {
    expect(isColdSeason('printemps')).toBe(true);
    expect(isColdSeason('hiver')).toBe(true);
    expect(isColdSeason('ete')).toBe(false);
    expect(isColdSeason('automne')).toBe(false);
  });
});

describe('table de Météo VERBATIM (EDOC ch.5 l.44-51)', () => {
  // Plages bornes (max inclus) — lit la table telle que transcrite.
  it('printemps : 01-10 sec, 11-30 beau, 31-90 pluie, 91-95 diluvienne, 96-00 neige', () => {
    expect(weatherFromRoll(1, 'printemps')).toBe('sec');
    expect(weatherFromRoll(10, 'printemps')).toBe('sec');
    expect(weatherFromRoll(11, 'printemps')).toBe('beau');
    expect(weatherFromRoll(30, 'printemps')).toBe('beau');
    expect(weatherFromRoll(31, 'printemps')).toBe('pluie');
    expect(weatherFromRoll(90, 'printemps')).toBe('pluie');
    expect(weatherFromRoll(91, 'printemps')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(95, 'printemps')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(96, 'printemps')).toBe('neige');
    expect(weatherFromRoll(100, 'printemps')).toBe('neige');
  });
  it('été : pas de neige ni blizzard (01-40 sec, 41-70 beau, 71-95 pluie, 96-00 diluvienne)', () => {
    expect(weatherFromRoll(40, 'ete')).toBe('sec');
    expect(weatherFromRoll(70, 'ete')).toBe('beau');
    expect(weatherFromRoll(95, 'ete')).toBe('pluie');
    expect(weatherFromRoll(96, 'ete')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(100, 'ete')).toBe('pluie-diluvienne');
    const weathers = WEATHER_TABLE.ete.map((r) => r.weather);
    expect(weathers).not.toContain('neige');
    expect(weathers).not.toContain('blizzard');
  });
  it('automne : 01-30 sec, 31-60 beau, 61-90 pluie, 91-98 diluvienne, 99-00 neige', () => {
    expect(weatherFromRoll(30, 'automne')).toBe('sec');
    expect(weatherFromRoll(60, 'automne')).toBe('beau');
    expect(weatherFromRoll(90, 'automne')).toBe('pluie');
    expect(weatherFromRoll(98, 'automne')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(99, 'automne')).toBe('neige');
    expect(weatherFromRoll(100, 'automne')).toBe('neige');
  });
  it('hiver : pas de temps sec (01-10 beau, 11-60 pluie, 61-65 diluvienne, 66-90 neige, 91-00 blizzard)', () => {
    expect(weatherFromRoll(10, 'hiver')).toBe('beau');
    expect(weatherFromRoll(60, 'hiver')).toBe('pluie');
    expect(weatherFromRoll(65, 'hiver')).toBe('pluie-diluvienne');
    expect(weatherFromRoll(90, 'hiver')).toBe('neige');
    expect(weatherFromRoll(91, 'hiver')).toBe('blizzard');
    expect(weatherFromRoll(100, 'hiver')).toBe('blizzard');
    expect(WEATHER_TABLE.hiver.map((r) => r.weather)).not.toContain('sec');
  });
  it('chaque saison couvre 100 (toute valeur d100 retombe sur une plage)', () => {
    const seasons: Season[] = ['printemps', 'ete', 'automne', 'hiver'];
    for (const s of seasons) {
      for (let r = 1; r <= 100; r++) expect(weatherFromRoll(r, s)).toBeTruthy();
      expect(WEATHER_TABLE[s][WEATHER_TABLE[s].length - 1].max).toBe(100);
    }
  });
  it('rollStageWeather : déterministe sous une graine, et cohérent avec weatherFromRoll', () => {
    const rng = makeRNG(42);
    const a = rollStageWeather(rng, 'hiver');
    expect(a.roll).toBeGreaterThanOrEqual(1);
    expect(a.roll).toBeLessThanOrEqual(100);
    expect(a.weather).toBe(weatherFromRoll(a.roll, 'hiver'));
    // Même graine → même tirage (reproductible pour la coop/les tests).
    expect(rollStageWeather(makeRNG(42), 'hiver')).toEqual(rollStageWeather(makeRNG(42), 'hiver'));
  });
});

describe('stageCount (EDOC ch.5 l.34) — distance → Étapes ± bonus', () => {
  it('village proche (≤ 25 km) = 1 Étape', () => {
    expect(stageCount(10)).toBe(1);
    expect(stageCount(25)).toBe(1);
    expect(stageCount(0)).toBe(1); // minimum 1 (l.19/22)
  });
  it('ville à ville (26-150 km) = 2 à 4 Étapes', () => {
    expect(stageCount(26)).toBe(2);
    expect(stageCount(74)).toBe(2);
    expect(stageCount(75)).toBe(3);
    expect(stageCount(125)).toBe(4);
    expect(stageCount(150)).toBe(4); // plafonné à 4 (l.34 « entre 2 et 4 étapes »)
  });
  it('au-delà : +1 Étape par tranche de 50 km', () => {
    expect(stageCount(200)).toBe(5);
    expect(stageCount(250)).toBe(6);
  });
  it('bonus d’Étapes (règle travel-etapes-count-bonus) : +N additif', () => {
    expect(stageCount(10, 2)).toBe(3); // 1 + 2
    expect(stageCount(75, 3)).toBe(6); // 3 + 3
    expect(stageCount(10, 0)).toBe(1); // bonus 0 = inerte
  });
  it('bonus négatif ignoré (jamais < base)', () => {
    expect(stageCount(75, -3)).toBe(3);
  });
});

describe('stageExposureDifficulty (EDOC ch.5 l.73) — difficulté du Test selon équipement', () => {
  it('beau temps / sec : aucun Test', () => {
    expect(stageExposureDifficulty('beau', false, false)).toBeNull();
    expect(stageExposureDifficulty('sec', false, false)).toBeNull();
  });
  it('pluie/neige bien équipé (manteau + tente) : aucun Test', () => {
    expect(stageExposureDifficulty('pluie', true, true)).toBeNull();
    expect(stageExposureDifficulty('neige', true, true)).toBeNull();
  });
  it('pluie/neige, un seul manquant → Complexe (-10) ; les deux → Difficile (-20)', () => {
    expect(stageExposureDifficulty('pluie', true, false)).toBe('complexe');
    expect(stageExposureDifficulty('pluie', false, true)).toBe('complexe');
    expect(stageExposureDifficulty('neige', false, false)).toBe('difficile');
  });
  it('averse (pluie diluvienne) / blizzard : Test TOUJOURS, même manteau + tente (l.73)', () => {
    expect(stageExposureDifficulty('pluie-diluvienne', true, true)).toBe('intermediaire');
    expect(stageExposureDifficulty('blizzard', true, true)).toBe('intermediaire');
    expect(stageExposureDifficulty('blizzard', true, false)).toBe('complexe');
    expect(stageExposureDifficulty('blizzard', false, false)).toBe('difficile');
  });
});

describe('modificateurs météo (Plein Air l.106 / Approvisionnement l.56)', () => {
  it('Plein Air : -10 par degré de temps éloigné de Beau temps', () => {
    expect(pleinAirModifier('beau')).toBe(0);
    expect(pleinAirModifier('pluie')).toBe(-10);
    expect(pleinAirModifier('neige')).toBe(-20);
    expect(pleinAirModifier('blizzard')).toBe(-30);
  });
  it('Approvisionnement : -10 par temps sec (eau plus rare), 0 sinon', () => {
    expect(forageWeatherModifier('sec')).toBe(-10);
    expect(forageWeatherModifier('beau')).toBe(0);
    expect(forageWeatherModifier('pluie')).toBe(0);
  });
});

describe('forageYield (LDB 09 l.568-572)', () => {
  it('Recherche de nourriture : 1 + DR personnes nourries', () => {
    expect(forageYield(0, 'recherche')).toBe(1);
    expect(forageYield(2, 'recherche')).toBe(3);
  });
  it('Chasse / pêche : 2 + 2×DR', () => {
    expect(forageYield(0, 'chasse')).toBe(2);
    expect(forageYield(2, 'chasse')).toBe(6);
  });
  it('Piégeage : même rendement que la chasse', () => {
    expect(forageYield(3, 'piegeage')).toBe(forageYield(3, 'chasse'));
  });
  it('échec (DR < 0) : 0 ration', () => {
    expect(forageYield(-1, 'recherche')).toBe(0);
    expect(forageYield(-2, 'chasse')).toBe(0);
  });
  it('défaut = recherche', () => {
    expect(forageYield(1)).toBe(forageYield(1, 'recherche'));
  });
});
