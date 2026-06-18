/**
 * Voyage par ÉTAPES — Compagnon T1 (EDOC), « CHAPITRE 5 : Voyager »
 * (`Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre Compagnon/08 - CHAPITRE 5 - Voyager.md`).
 *
 * Sous-système OPTIONNEL : « Tout comme le chapitre Entre deux aventures, tous ces outils sont
 * optionnels et voués à enrichir les règles présentées à la page 261 de WFJDR » (EDOC ch.5 l.29).
 * Il enrichit le déplacement de base du LdB SANS le remplacer — le défaut reste jour-par-jour.
 *
 * Ce module est PUR (RNG injecté, aucun accès store) : il calcule le nombre d'Étapes, tire la
 * Météo par Étape (table verbatim EDOC ch.5 l.44-51), donne la difficulté d'un Test d'Exposition
 * de fin d'Étape (« Attraper Froid », l.73) et le rendement de l'activité d'Approvisionnement
 * (« Trouver de la nourriture et des herbes », LDB 09 l.565-572). Les valeurs RAW sont citées en
 * commentaire ; rien n'est inventé.
 */
import type { RNG } from './dice';
import { d100 } from './dice';
import type { Difficulty } from './types';

/** Les quatre saisons du tableau de Météo (EDOC ch.5 l.44). */
export type Season = 'printemps' | 'ete' | 'automne' | 'hiver';

/** Saisons « froides » (rhume après Exposition, l.75 : « En hiver ou au printemps … contracte un rhume »). */
export const COLD_SEASONS: Season[] = ['printemps', 'hiver'];

/**
 * Saison dérivée de l'index de mois impérial (0 = Nachhexen … 11 = Vorhexen). Le calendrier impérial
 * suit les saisons terrestres. Découpage en 4 quarts de 3 mois (ancré sur l'année qui démarre à
 * Nachhexen) :
 *  printemps = Jahrdrung(1)/Pflugzeit(2)/Sigmarzeit(3) ; été = Sommerzeit(4)/Vorgeheim(5)/Nachgeheim(6) ;
 *  automne = Erntezeit(7)/Brauzeit(8)/Kaldezeit(9) ; hiver = Ulriczeit(10)/Vorhexen(11)/Nachhexen(0).
 *  Un jour intercalaire (month = null) prend le défaut printemps (la campagne EiS démarre fin Jahrdrung).
 */
export function seasonOfMonth(monthIndex: number | null): Season {
  if (monthIndex == null) return 'printemps';
  const m = ((monthIndex % 12) + 12) % 12;
  if (m >= 1 && m <= 3) return 'printemps'; // Jahrdrung, Pflugzeit, Sigmarzeit
  if (m >= 4 && m <= 6) return 'ete';       // Sommerzeit, Vorgeheim, Nachgeheim
  if (m >= 7 && m <= 9) return 'automne';   // Erntezeit, Brauzeit, Kaldezeit
  return 'hiver';                           // Ulriczeit(10), Vorhexen(11), Nachhexen(0)
}

/** Conditions météo (EDOC ch.5 l.44-51), de la plus clémente à la pire — l'ordre fixe le « degré
 *  de temps éloigné de Beau temps » de l'activité Plein Air (l.106). */
export type Weather = 'sec' | 'beau' | 'pluie' | 'pluie-diluvienne' | 'neige' | 'blizzard';

export const WEATHER_LABEL: Record<Weather, string> = {
  sec: 'Temps sec',
  beau: 'Beau temps',
  pluie: 'Pluie',
  'pluie-diluvienne': 'Pluie diluvienne',
  neige: 'Neige',
  blizzard: 'Blizzard',
};

/** Une plage d100 → météo. */
interface WeatherRange { max: number; weather: Weather; }

/**
 * TABLE DE MÉTÉO VERBATIM (EDOC ch.5 l.44-51 — « Le MJ doit effectuer un jet de Météo au début de
 * chaque étape »). Pour chaque saison, la liste ORDONNÉE des plages d100 (`max` = borne haute
 * incluse de la plage ; 00 → 100). Un tiret RAW (« - ») = plage absente cette saison.
 *
 *  | Météo            | Printemps | Été    | Automne | Hiver  |
 *  | Temps sec        | 01-10     | 01-40  | 01-30   | -      |
 *  | Beau temps       | 11-30     | 41-70  | 31-60   | 01-10  |
 *  | Pluie            | 31-90     | 71-95  | 61-90   | 11-60  |
 *  | Pluie diluvienne | 91-95     | 96-00  | 91-98   | 61-65  |
 *  | Neige            | 96-00     | -      | 99-00   | 66-90  |
 *  | Blizzard         | -         | -      | -       | 91-00  |
 */
export const WEATHER_TABLE: Record<Season, WeatherRange[]> = {
  printemps: [
    { max: 10, weather: 'sec' },
    { max: 30, weather: 'beau' },
    { max: 90, weather: 'pluie' },
    { max: 95, weather: 'pluie-diluvienne' },
    { max: 100, weather: 'neige' },
  ],
  ete: [
    { max: 40, weather: 'sec' },
    { max: 70, weather: 'beau' },
    { max: 95, weather: 'pluie' },
    { max: 100, weather: 'pluie-diluvienne' },
  ],
  automne: [
    { max: 30, weather: 'sec' },
    { max: 60, weather: 'beau' },
    { max: 90, weather: 'pluie' },
    { max: 98, weather: 'pluie-diluvienne' },
    { max: 100, weather: 'neige' },
  ],
  hiver: [
    { max: 10, weather: 'beau' },
    { max: 60, weather: 'pluie' },
    { max: 65, weather: 'pluie-diluvienne' },
    { max: 90, weather: 'neige' },
    { max: 100, weather: 'blizzard' },
  ],
};

/** Météo depuis un jet d100 explicite (1-100) et une saison — lecture pure de la table RAW. */
export function weatherFromRoll(roll: number, season: Season): Weather {
  const table = WEATHER_TABLE[season];
  for (const r of table) if (roll <= r.max) return r.weather;
  return table[table.length - 1].weather; // garde-fou : 100 retombe sur la dernière plage
}

/** Jet de Météo d'une Étape (EDOC ch.5 l.42) : d100 sur la table de la saison. */
export function rollStageWeather(rng: RNG, season: Season): { roll: number; weather: Weather } {
  const roll = d100(rng);
  return { roll, weather: weatherFromRoll(roll, season) };
}

/**
 * Nombre d'Étapes d'un trajet (EDOC ch.5 l.34) : « Un voyage entre deux villages proches comprend
 * généralement une seule étape. Les trajets plus longs entre des villes importantes peuvent
 * comprendre entre 2 et 4 étapes. Tout voyage plus long doit être divisé en plusieurs étapes. »
 * Le canon laisse le découpage « à la discrétion du MJ » (l.15) sans formule de distance ; on
 * dérive un nombre depuis la distance (paliers documentés, fidèles aux exemples : village proche =
 * 1, ville à ville = 2-4) PUIS on applique le « bonus d'Étapes » d'auteur (l.34 : « augmentez le
 * nombre d'Étapes de 2 ou plus », via la règle `travel-etapes-count-bonus`). Minimum 1 (l.19/22).
 */
export function stageCount(distanceKm: number, countBonus = 0): number {
  const km = Math.max(0, distanceKm);
  // Paliers : ≤ ~25 km (village proche) = 1 ; jusqu'à ~150 km (ville à ville) = 2-4 ; au-delà, +1
  // par tranche de 50 km. Choix documenté — le canon ne chiffre pas la distance (l.32 « les cartes
  // de l'Empire sont notoirement imprécises »).
  let base: number;
  if (km <= 25) base = 1;
  else if (km <= 150) base = Math.min(4, 2 + Math.floor((km - 25) / 50)); // 26-75=2, 76-125=3, 126-150=4
  else base = 4 + Math.ceil((km - 150) / 50);
  return Math.max(1, base + Math.max(0, Math.floor(countBonus)));
}

/**
 * Difficulté du Test d'Exposition de fin d'Étape — option « Attraper Froid » (EDOC ch.5 l.73) :
 * « tout Personnage exposé à la pluie ou à la neige sans un bon manteau et une tente … doit faire un
 * Test d'Exposition. Les Personnages exposés à une averse [pluie diluvienne] ou à un blizzard doivent
 * faire le Test même s'ils ont à la fois un manteau et une tente, mais l'absence de l'un ou l'autre
 * rend ce Test Complexe (-10), tandis que l'absence des deux le rend Difficile (-20). »
 *
 * Renvoie `null` si AUCUN Test n'est requis (beau temps / temps sec, ou pluie-neige normale avec
 * manteau + tente). Sinon la Difficulté du Test de Résistance.
 *  - météo modérée (pluie/neige) : Test seulement si manteau OU tente manquant ;
 *  - météo extrême (pluie diluvienne/blizzard) : Test TOUJOURS (l.73).
 *  - difficulté : les DEUX présents → Intermédiaire (+0) ; un seul manquant → Complexe (-10) ;
 *    les deux manquants → Difficile (-20).
 */
export function stageExposureDifficulty(weather: Weather, hasCloak: boolean, hasTent: boolean): Difficulty | null {
  const modere = weather === 'pluie' || weather === 'neige';
  const extreme = weather === 'pluie-diluvienne' || weather === 'blizzard';
  if (!modere && !extreme) return null; // sec / beau : pas d'intempéries (l.59)
  const missing = (hasCloak ? 0 : 1) + (hasTent ? 0 : 1);
  if (modere && missing === 0) return null; // pluie/neige normale, bien équipé → aucun Test (l.73)
  if (missing === 2) return 'difficile';    // -20 (absence des deux)
  if (missing === 1) return 'complexe';      // -10 (absence de l'un)
  return 'intermediaire';                    // +0 (extrême, manteau + tente)
}

/** Une saison froide expose-t-elle au rhume après Exposition (l.75) ? printemps/hiver uniquement. */
export function isColdSeason(season: Season): boolean {
  return COLD_SEASONS.includes(season);
}

/**
 * Malus de l'activité Plein Air (EDOC ch.5 l.106) : « Test de Survie en extérieur Intermédiaire (+0),
 * modifié de -10 par degré de temps éloigné de Beau temps ». Le « degré » se compte sur l'ordre de la
 * colonne météo (Beau = 0). Un Plein Air réussi DISPENSE le groupe du Test d'Exposition de l'Étape.
 */
const WEATHER_DEGREE: Record<Weather, number> = {
  beau: 0, sec: 1, pluie: 1, 'pluie-diluvienne': 2, neige: 2, blizzard: 3,
};
export function pleinAirModifier(weather: Weather): number {
  return -10 * WEATHER_DEGREE[weather] || 0; // `|| 0` normalise le -0 de JS (beau temps)
}

/** Malus de l'activité Approvisionnement par temps sec (l.56) : « -10, car il est plus difficile de
 *  trouver de l'eau ». Aucun autre temps n'est chiffré pour l'Approvisionnement. */
export function forageWeatherModifier(weather: Weather): number {
  return weather === 'sec' ? -10 : 0;
}

/** Méthode d'Approvisionnement (LDB 09 l.565-572, option « Trouver de la nourriture et des herbes »). */
export type ForageMethod = 'recherche' | 'chasse' | 'piegeage';

/**
 * Rendement de l'Approvisionnement (LDB 09 l.568-572) : nombre de personnes nourries depuis le DR
 * d'un Test de Survie en extérieur réussi, selon la méthode.
 *  - Recherche de nourriture (l.568) : « un succès procure suffisamment de nourriture pour un
 *    Personnage. Chaque DR procure assez de nourriture pour une personne de plus. » → 1 + DR.
 *  - Chasser et pêcher (l.570) : « un Test réussi permet de nourrir deux personnes, et deux personnes
 *    supplémentaires par DR. » → 2 + 2×DR (matériel requis — arc/lance/canne/filet).
 *  - Piégeage (l.572) : « Permet de nourrir le même nombre de personnes que Chasser et pêcher. »
 * `slTest` = DR du Test (négatif/0 si échec → 0 ration). Renvoie le nombre de rations-jour obtenues.
 */
export function forageYield(slTest: number, method: ForageMethod = 'recherche'): number {
  if (slTest < 0) return 0; // échec : aucune nourriture (le DR négatif ne nourrit personne)
  const dr = Math.max(0, slTest);
  if (method === 'chasse' || method === 'piegeage') return 2 + 2 * dr; // l.570/572
  return 1 + dr; // recherche (l.568)
}
