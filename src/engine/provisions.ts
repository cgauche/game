/**
 * Provisions & Faim — Livre de base, « Faim et Soif » (18-Traumatisme l.417-422).
 *
 * RAW modélisé (rien d'inventé) :
 *  - « Les Tests de Résistance pour supporter la faim … sont de plus en plus difficiles
 *    (-10 % de plus pour chaque Test) » (l.418) → modificateur −10 × (Tests déjà tentés).
 *  - « Les Personnages qui n'ont ni nourriture ni boisson ne peuvent pas récupérer de Points
 *    de Blessure ou se débarrasser de l'État Exténué de manière naturelle » (l.418) → `isStarving`
 *    est lu par `rest.ts` (lève la dette documentée là-bas).
 *  - Nourriture (l.422) : « lorsque vous n'avez plus de nourriture, vous devez effectuer un Test
 *    de Résistance tous les deux jours. Sur un premier échec, vous subissez une pénalité de –10 en
 *    Force et Endurance. À partir du deuxième échec, toutes les autres Caractéristiques sont
 *    réduites de -10 et vous subissez 1d10 Dégâts, qui ignore les PA, avec un minimum de 1
 *    Blessure. » Lecture : les Dégâts ignorent les PA mais restent réduits par le Bonus
 *    d'Endurance (le « minimum de 1 » serait sinon sans objet — même formulation que l'Exposition).
 *  - Talent « Brouet » (10-Talents l.108-113) : « subsister avec la moitié de la nourriture
 *    nécessaire » (1 ration / 2 jours) et « Test concernant la faim tous les 3 jours et pas 2 ».
 *  - L'EAU est réputée disponible (Reikland : rivières, puits, auberges — décision de périmètre) ;
 *    le volet Soif (l.420) n'est pas suivi.
 *
 * La nourriture = objets « Ration (1 jour) » (trappings LDB p.302) dans l'inventaire du héros.
 * CHOIX documenté (canon muet sur la résorption) : manger à nouveau remet les compteurs ET les
 * malus de faim à zéro.
 *
 * Cycle d'import évité comme `disease.ts`/`trauma.ts` : `characteristics.ts` importe
 * `hungerCharPenalties` d'ici → ce module n'importe NI characteristics NI conditions ; la valeur
 * de Résistance (`resVal`) et le Bonus d'Endurance (`be`) sont passés par l'appelant, qui applique
 * lui-même les dégâts (via `loseWounds`).
 */
import { Combatant, CharKey, ItemInstance, UpkeepDeferTest } from './types';
import { RNG, defaultRNG, d10 } from './dice';
import { rollTest } from './tests';
import { hasActiveFlag } from './activeFlags';

/** État de faim d'un personnage (absent = nourri normalement). */
export interface HungerState {
  /** Jours consécutifs sans manger. */
  days: number;
  /** Tests de faim déjà tentés (le suivant est à −10 × tests, l.418). */
  tests: number;
  /** Échecs cumulés : 1ᵉʳ → −10 F/E ; 2ᵉ et suivants → −10 autres caracs + 1d10 dégâts (l.422). */
  failures: number;
  /** Journée DÉJÀ couverte : demi-ration de Brouet (l.113) ou repas pris (effet `mealParty`). */
  coveredDay?: boolean;
}

/** Talent Brouet (LDB 10 l.108-113) — lu sur la donnée, sans import. */
export function hasBrouet(c: Combatant): boolean {
  return (c.talents ?? []).some((t) => t.talentId === 'brouet' && (t.times ?? 1) >= 1);
}

/** L'objet est-il une ration de voyage (« Ration (1 jour) », LDB p.302) ? Détecté par le marqueur
 *  STABLE `isRations` du trapping (≠ nom — multilangue-safe). */
export function isRation(it: Pick<ItemInstance, 'isRations'>): boolean {
  return !!it.isRations;
}

/** Nombre de rations portées par un héros. */
export function rationCount(c: Combatant): number {
  return (c.items ?? []).filter(isRation).length;
}

/** Sans provisions depuis ≥ 1 jour → pas de récupération naturelle (PB/Exténué), l.418. */
export function isStarving(c: Combatant): boolean {
  return (c.hunger?.days ?? 0) >= 1;
}

/** Repas pris (auberge, hôte — effet `mealParty`) : nourri pour la journée SANS ration, et les
 *  compteurs/malus de faim se dissipent (choix documenté : manger efface la faim). Mute `c`. */
export function feedFromMeal(c: Combatant): void {
  c.hunger = { days: 0, tests: 0, failures: 0, coveredDay: true };
}

/** Pénalités de Caractéristique dues à la faim (l.422), injectées dans le pool non-cumul
 *  d'`effectiveChar` : 1ᵉʳ échec → −10 Force et Endurance ; dès le 2ᵉ → −10 toutes les autres. */
export function hungerCharPenalties(c: Combatant, key: CharKey): number[] {
  const f = c.hunger?.failures ?? 0;
  if (f >= 1 && (key === 'F' || key === 'E')) return [-10];
  if (f >= 2 && key !== 'F' && key !== 'E') return [-10];
  return [];
}

export interface FoodUpkeepResult {
  /** A mangé aujourd'hui (ration consommée, ou jour « gratuit » de Brouet). */
  ate: boolean;
  /** Une ration a été retirée de l'inventaire. */
  rationConsumed: boolean;
  /** Dégâts NETS à appliquer par l'appelant (ignorant les PA — via `loseWounds`). */
  damage: number;
  /** Journal (Tests de faim, malus — la consommation silencieuse est agrégée par l'appelant). */
  log: string[];
}

/**
 * Entretien quotidien de nourriture d'UN personnage (une journée écoulée). Mute `c` (rations,
 * compteur de faim). `resVal` = valeur du Test de Résistance ; `be` = Bonus d'Endurance — passés
 * par l'appelant (cycle d'import, cf. en-tête). L'appelant applique `damage` via `loseWounds`.
 */
/**
 * Applique le RÉSULTAT d'un Test de Faim DIFFÉRÉ (différé/influençable en cascade de nuit) : compte
 * le Test (l.418), et sur un échec applique les pénalités (l.422 : 1ᵉʳ → −10 F/E ; 2ᵉ+ → −10 autres
 * + 1d10 Dégâts réduits du BE, min 1). Mute `c.hunger` ; renvoie le journal + les Dégâts à appliquer
 * (via `loseWounds` par l'appelant). Partagé avec `dailyFoodUpkeep` (roll eager) — zéro duplication.
 */
export function applyFaimTest(c: Combatant, success: boolean, be: number, rng: RNG = defaultRNG): { log: string[]; damage: number } {
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };
  h.tests += 1;
  const log: string[] = [];
  let damage = 0;
  if (!success) {
    h.failures += 1;
    if (h.failures === 1) log.push(`${c.name} est affamé : −10 en Force et en Endurance.`);
    else {
      damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (l.422)
      log.push(`${c.name} dépérit : −10 à toutes les autres Caractéristiques, ${damage} Blessure(s) (la faim ignore l'armure).`);
    }
  } // réussite : aucune conséquence (le jet a déjà été montré dans l'étape — pas de bruit de journal)
  c.hunger = h;
  return { log, damage };
}

/**
 * `dailyFoodUpkeep` : mange une ration (ou couvre la journée), sinon installe la faim. `deferTest`
 * (cascade de nuit) : si un Test de Faim TOMBE ce jour, on NE le roule PAS — on appelle `deferTest`
 * avec la pénalité cumulative (−10 × Tests déjà tentés, l.418) pour qu'il devienne une ÉTAPE
 * influençable (résolue par `applyFaimTest`). Sans `deferTest` (contextes eager), le jet est roulé ici.
 */
export function dailyFoodUpkeep(c: Combatant, resVal: number, be: number, rng: RNG = defaultRNG, deferTest?: UpkeepDeferTest): FoodUpkeepResult {
  const res: FoodUpkeepResult = { ate: false, rationConsumed: false, damage: 0, log: [] };
  if (c.dead) return res;
  // Sustentation magique (Graisse de la terre, LDB 48 : « n'a pas besoin de manger ou de boire ») :
  // la Faim est suspendue — pas de ration consommée, compteurs purgés, tant que l'effet dure.
  if (hasActiveFlag(c, 'noHunger')) {
    res.ate = true;
    c.hunger = undefined;
    return res;
  }
  const brouet = hasBrouet(c);
  const h: HungerState = c.hunger ?? { days: 0, tests: 0, failures: 0 };

  // 1. Manger : journée déjà couverte (demi-ration de Brouet, repas d'auberge), sinon une ration.
  if (h.coveredDay) {
    res.ate = true;
  } else {
    const idx = (c.items ?? []).findIndex(isRation);
    if (idx >= 0) {
      c.items!.splice(idx, 1);
      res.ate = true;
      res.rationConsumed = true;
    }
  }

  if (res.ate) {
    if (h.days > 0 || h.failures > 0) res.log.push(`${c.name} mange enfin à sa faim — les effets de la faim se dissipent.`);
    // Brouet : demi-ration → le jour suivant est couvert (l.113). Sinon, plus d'état de faim.
    c.hunger = brouet && res.rationConsumed ? { days: 0, tests: 0, failures: 0, coveredDay: true } : undefined;
    return res;
  }

  // 2. Pas de nourriture : la faim s'installe (l.422 — Test tous les 2 jours ; Brouet : 3).
  h.coveredDay = undefined;
  h.days += 1;
  const interval = brouet ? 3 : 2;
  if (h.days % interval === 0) {
    const penalty = -10 * h.tests || 0; // l.418 : chaque Test est plus dur (cumulatif ; évite −0)
    if (deferTest) {
      // Cascade de nuit : le Test devient une ÉTAPE influençable (résolue par `applyFaimTest`).
      c.hunger = h; // days++ enregistré ; tests/échecs appliqués à la validation de l'étape
      deferTest({ kind: 'faim', label: 'Faim', base: resVal, difficulty: 'intermediaire', penalty });
      return res;
    }
    const t = rollTest(resVal, 'intermediaire', rng, penalty);
    h.tests += 1;
    res.log.push(
      `${c.name} — Faim : Test de Résistance${h.tests > 1 ? ` (−${(h.tests - 1) * 10})` : ''} : 🎲 ${t.roll}/${t.target} → ${t.success ? 'il tient bon' : 'ÉCHEC'}.`,
    );
    if (!t.success) {
      h.failures += 1;
      if (h.failures === 1) {
        res.log.push(`${c.name} est affamé : −10 en Force et en Endurance.`);
      } else {
        res.damage = Math.max(1, d10(rng) - be); // 1d10 Dégâts, ignore les PA, min 1 (l.422)
        res.log.push(`${c.name} dépérit : −10 à toutes les autres Caractéristiques, ${res.damage} Blessure(s) (la faim ignore l'armure).`);
      }
    }
  }
  c.hunger = h;
  return res;
}
