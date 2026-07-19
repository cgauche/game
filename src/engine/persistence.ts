/**
 * Persistance des conséquences de combat — ce qui suit le héros d'un combat au suivant.
 * Les États persistants sont sourcés du Livre de base (16-États.md) : ils exigent repos,
 * Compétence Guérison, Sort/Prière ou Tests hors combat — par opposition aux états de combat
 * transitoires (Surpris/À Terre/Sonné/Aveuglé/Assourdi/Empêtré), retirés en/par le combat.
 * La récupération elle-même (temps, repos, Guérison, Chirurgie) reste hors périmètre (Jalon 5).
 */
import { Combatant, ConditionInstance, Trauma, ItemInstance } from './types';
import type { Disease } from './disease';

/** États qui persistent après le combat (LDB 16-États : Brisé l.57, Empoisonné l.70,
 *  En flammes l.77, Exténué l.91, Hémorragique l.107, Inconscient l.116 ; munition-logee, LDB 62
 *  l.250 : « Les flèches et les carreaux nécessitent un Test de Guérison Intermédiaire pour être
 *  retirés » — sans ce Test, elle ne disparaît pas au teardown de combat, #473). */
export const PERSISTENT_CONDITIONS: ReadonlySet<string> = new Set([
  'brise', 'empoisonne', 'en-flammes', 'extenue', 'hemorragique', 'inconscient', 'munition-logee',
]);

/** État persistant d'un combattant à reporter vers le groupe (fin de combat) ou à ré-importer
 *  (combat suivant). N'inclut QUE ce qui survit hors combat ; le transitoire est omis. Copie défensive. */
export function carryOverState(c: Combatant): {
  wounds: { current: number; max: number };
  conditions: ConditionInstance[];
  criticalWounds: number;
  dead: boolean;
  outOfRencontre: boolean;
  soinRencontreUtilise: boolean;
  traumas: Trauma[];
  diseases?: Disease[];
  diseaseImmunities?: string[];
  items?: ItemInstance[];
  sinPoints?: number;
  castPenalties?: import('./types').CastPenalty[];
  corruption?: number;
  mutations?: import('./corruption').Mutation[];
  damned?: boolean;
  traits?: import('./statEntry').TraitList;
  psychTraits?: import('./psychology').PsychTrait[];
  briseFromTerreur?: number;
  resistanceUsed?: string[];
} {
  return {
    wounds: { current: c.wounds.current, max: c.wounds.max },
    conditions: c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.id)).map((x) => ({ ...x })),
    criticalWounds: c.criticalWounds ?? 0,
    dead: c.dead === true,
    outOfRencontre: c.outOfRencontre === true,
    // Limite « 1 soin de Blessures par patient et par rencontre » (LDB 09 l.260) : le soin
    // reçu en combat bloque un re-soin juste après ; remis à zéro au prochain startCombat.
    soinRencontreUtilise: c.soinRencontreUtilise === true,
    traumas: (c.traumas ?? []).map((t) => ({ ...t })),
    // Maladies (LDB 20) : persistent hors combat — incubation/durée décomptées au repos.
    ...(c.diseases ? { diseases: c.diseases.map((d) => ({ ...d })) } : {}),
    ...(c.diseaseImmunities ? { diseaseImmunities: [...c.diseaseImmunities] } : {}),
    // Inventaire à stats : persiste l'usure d'arme (damageTaken/destroyed) et la munition consommée
    // (qty) entre combats (LDB 62 l.177-180). roundsAtZero N'est PAS persisté : l'horloge de mort
    // lente repart à neuf au combat suivant (cohérent avec startCombat).
    ...(c.items ? { items: c.items.map((i) => ({ ...i })) } : {}),
    // Points de Péché (LDB 40) : la Colère des dieux en expie 1 par jet — le solde suit le héros.
    ...(c.sinPoints != null ? { sinPoints: c.sinPoints } : {}),
    // Contrecoups d'incantation (LDB 46/40) : les durées d'horloge (jours/minutes) et les blocages
    // de Prière survivent au combat ; les durées en Rounds restantes continuent de ticker hors combat.
    ...(c.castPenalties?.length ? { castPenalties: c.castPenalties.map((p) => ({ ...p })) } : {}),
    // Corruption & mutations (LDB 19) : la DONNÉE persiste (les effets — caracs permanentes,
    // Mouvement, PA naturels, Traits — sont relus à la volée). `damned` = hors-jeu définitif.
    ...(c.corruption != null ? { corruption: c.corruption } : {}),
    ...(c.mutations ? { mutations: c.mutations.map((m) => ({ ...m })) } : {}),
    ...(c.damned ? { damned: true } : {}),
    // Traits gagnés par mutation (Tentacules, Frénésie…) : un héros n'en change pas autrement.
    ...(c.mutations?.length && c.traits ? { traits: [...c.traits] } : {}),
    // Traits psychologiques : mutation-conférés OU ACQUIS en jeu (Phobie/Animosité/Haine/Trauma, ADE II
    // Annexe I) — persistent dès qu'il en existe, plus seulement si une mutation est présente.
    ...(c.psychTraits?.length ? { psychTraits: c.psychTraits.map((t) => ({ ...t })) } : {}),
    // Phobie du noir (ADE II) : le compteur d'États Brisé issus de la Terreur suit le héros entre combats.
    ...(c.briseFromTerreur ? { briseFromTerreur: c.briseFromTerreur } : {}),
    // Résistance (Menace), LDB 10 : le compteur « 1 par séance » consommé EN combat suit le héros.
    ...(c.resistanceUsed?.length ? { resistanceUsed: [...c.resistanceUsed] } : {}),
  };
}

/** États persistants seuls (pour le carry-in au spawn d'un combat). Copie défensive. */
export function persistentConditions(c: Combatant): ConditionInstance[] {
  return c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.id)).map((x) => ({ ...x }));
}
