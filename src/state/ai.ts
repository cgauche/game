/**
 * IA d'ennemi — couche de DÉCISION pure et testable.
 *
 * `chooseEnemyAction` ne mute rien et ne tire aucun dé : elle choisit l'action
 * d'un ennemi à partir de l'état tactique (positions, Blessures, armes, sorts).
 * La RÉSOLUTION (jets, dégâts, animations, timers) reste dans le store.
 *
 * Aucune règle inventée : le déplacement réutilise le BFS de `path.ts`, l'ESPÉRANCE de dégâts
 * (`expectedDamage`) réutilise les fonctions du moteur (`attackModifiers`/`combineMods`/`woundsFromHit`/
 * `missileDamage`), le positionnement réutilise la géométrie (`isFlankOrRear`/`lineOfSightCover`). Les
 * HEURISTIQUES de CHOIX (menace, positionnement) ne sont pas des règles canon (latitude permise), mais
 * chaque chiffre dérive d'une fonction du moteur — pas de constante magique « pifométrique » — et toute
 * action jouée passe par la résolution RAW (LoS LDB 13 l.123, bandes de portée appliquées au jet).
 *
 * Lot 3 — l'IA vise par MENACE (`targetThreat`, plus le « PV le plus bas »), achève proprement
 * (`killSecure`), ne s'acharne pas (`overkillPenalty`), valorise les États infligés (`controlValue`,
 * data-driven), couvre les paquets en ZdE (`aoeCoverage`) et se POSITIONNE (flanc/dos, couvert, portée
 * préférée — `positionValue`).
 *
 * Lot 4 — CONTEXTE D'ESCOUADE (`squad` en entrée, OPTIONNEL : absent → comportement Lot 3 inchangé) :
 * FEU CONCENTRÉ via le surnombre RAW (`outnumberEnvMelee` réutilise `outnumberMod`/LDB 14 avec le MÊME
 * décompte que la résolution `combatFlow.ts:425` → l'IA converge sur une cible que ses alliés encadrent),
 * ÉVITEMENT du DANGER (`dangerAt` : danger-map des héros, l'ennemi fuit les cases exposées) et COHÉSION
 * légère (ne pas s'isoler de l'escouade). Aucun nouveau MODIFICATEUR de combat n'est inventé.
 */
import { Combatant, Weapon } from '../engine/types';
import { Scene } from './scene';
import { reachable, flyReachable, manhattan, chebyshev, Pt } from './path';
import { footprintChebyshev, footprintN, combatDistance } from './footprint';
import { losClear, tileSeenByFoe, lineOfSightCover } from './lineOfSight';
import { rangeBandModifier, attackModifiers, combineMods, woundsFromHit, combatValue, outnumberMod, type ModLine } from '../engine/combat';
import { effectiveWeaponDamage, effectiveWeaponRange } from '../engine/weaponDamage';
import { selectedAmmo } from '../engine/items';
import { missileDamage, type SpellLike } from '../engine/magic';
import { bonus, effectiveChar } from '../engine/characteristics';
import { hasCondition, canTakeAction } from '../engine/conditions';
import { effectiveMovement } from '../engine/encumbrance';
import { isEngaged, meleeReachTiles } from '../engine/engagement';
import { isFlankOrRear } from './combatGeometry';
import { facingToward } from '../gameIso/rig/facing';
import type { Dir8 } from './dir8';
import { groupMatch } from '../engine/groups';
import { isBestial, isTerritorial, isMindless, isStupid } from '../engine/traits/dispatch';
import { isFrenzied } from '../engine/psychology';

/** Catégorie d'un sort de soutien/utilitaire (miroir PUR de `SupportSpellCat` de combatFlow — ai.ts
 *  reste sans dépendance vers le store/les données ; la couche impure produit ces options). */
export type SupportSpellCat = 'heal' | 'buffSelf' | 'buffAlly' | 'debuff' | 'summon' | 'other';
/** Option de sort de soutien classée (depuis ses DONNÉES) — consommée par l'énumération pure. */
export interface SupportSpellOpt {
  id: string;
  cat: SupportSpellCat;
  cn: number;
  range: number | null;
  magnitude: number;
  summonCount?: number;
  /** Noms d'États infligés (catégorie `debuff`) — pour l'anti-spam (ne pas réappliquer un État déjà porté)
   *  et la valeur de contrôle. Vide pour les autres catégories. */
  condNames?: string[];
}

export type EnemyAction =
  | { kind: 'cast'; targetId: string; spell: string } // incantation offensive sur la cible
  | { kind: 'castArea'; spell: string; center: Pt } // sort de ZONE (ZdE) auto-posé sur un point couvrant ≥2 héros
  | { kind: 'focus'; spell: string } // Focalisation (LDB 46) d'un sort offensif infaisable en un seul jet
  | { kind: 'shoot'; targetId: string } // tir depuis la position courante (arme à distance)
  | { kind: 'reload' } // recharge une arme à Recharge déchargée (Test étendu de Projectiles, LDB 63 l.28-29)
  | { kind: 'melee'; targetId: string } // attaque de mêlée (cible adjacente)
  | { kind: 'move'; to: Pt; thenTargetId: string } // approche ; attaque après si adjacent
  | { kind: 'recover'; state: 'empetre' | 'en-flammes' } // se libérer / se rouler au sol (LDB 16 l.61/77)
  | { kind: 'end' }; // rien à faire, passe la main

export interface EnemyTurnInput {
  /** L'ennemi qui agit (doit avoir `pos`). */
  enemy: Combatant;
  /** Héros encore en action (vivants), tous avec `pos`. */
  heroes: Combatant[];
  scene: Scene;
  /** Cases occupées par d'autres combattants (l'ennemi lui-même exclu). */
  blocked: Set<string>;
  /** Mouvement effectif en cases (dérivé de l'Encombrement par l'appelant). */
  movement: number;
  /** Libellé d'un sort offensif prêt, déjà résolu par l'appelant (qui a les données). */
  offensiveSpell?: string;
  /** Portée du sort offensif en CASES (spellRangeTiles, résolue par l'appelant) ;
   *  null/absent = portée non chiffrable → pas de gate (comportement historique). */
  spellRange?: number | null;
  /** Données STRUCTURÉES du sort offensif (`SpellData`) — résolues par l'appelant (couche impure qui a les
   *  données). Servent à SCORER le sort (espérance via `missileDamage`, États via `op:'condition'`). Absent
   *  = scoring neutre du sort (parité historique : on garde son palier sans bonus de menace/contrôle). */
  offensiveSpellData?: SpellLike;
  /** Vol (LDB 85 p.343) : le déplacement ignore terrains/obstacles/personnages traversés. */
  flying?: boolean;
  /** Cases enfumées (Souffle (Fumée)) qui bloquent la Ligne de Vue. */
  smoke?: Pt[];
  /** Vision RÉCIPROQUE : cases (`"x,y,0"`) que CET ennemi perçoit réellement (Ligne de Vue + lumière,
   *  vision nocturne incluse) — calculé par l'appelant via le moteur de vision. L'ennemi ne cible/poursuit
   *  que les héros sur ces cases (furtivité). ABSENT = pas de gate (comportement historique / tests purs). */
  perceived?: Set<string>;
  /** Orientation MONDE (`Dir8`) des combattants, lue de `get().facing` par l'appelant (couche impure :
   *  `ai.ts` est pur, sans store). Sert au bonus de FLANC/DOS du positionnement (`isFlankOrRear`, LDB 14
   *  l.91). ABSENT = aucun bonus de flanc (graceful : tests purs / scène sans orientation). */
  facing?: Record<string, Dir8>;
  /** Focalisation (LDB 46) — résolu par l'appelant (couche impure, qui a les données de sort) :
   *  un sort offensif DÉJÀ focalisé et PRÊT (`caster.focus.dr >= cn`) → lançable à NI 0 ce tour. */
  readyFocusedSpell?: string;
  /** Meilleur sort offensif FOCALISABLE mais infaisable en un seul jet (`cn > maxSL`, isArcaneSpell,
   *  Compétence de Focalisation possédée) — résolu par l'appelant. L'IA y consacre son tour à FOCALISER
   *  (au lieu de rater un NI hors d'atteinte en boucle), sauf menacée au contact avec un repli. */
  focusableSpell?: string;
  /** Sort de ZONE de dégâts castable (id + géométrie résolue par l'appelant). L'IA le joue (auto-pose
   *  du centre) quand le centre couvre ≥2 héros. `range` null = portée non chiffrable → pas de gate. */
  areaSpell?: { spell: string; radius: number; range: number | null; cn: number };
  /** SORTS de SOUTIEN/UTILITAIRE classés par l'appelant (couche impure qui a les DONNÉES de sort) :
   *  chaque option = un sort NON-dégât (heal/buffSelf/buffAlly/debuff/summon/other) faisable d'un jet,
   *  avec sa catégorie/cn/portée/magnitude DÉDUITES de ses ops (cf. `aiSpellPlan` dans combatFlow). L'IA
   *  pure en dérive des candidats `cast` (sur un allié blessé, soi, un héros menaçant, ou une invocation),
   *  résolus par le MÊME `castSpell` (IA = héros). ABSENT = aucun candidat de soutien → comportement
   *  STRICTEMENT inchangé (golden et fixtures sans soutien restent identiques). */
  supportSpells?: SupportSpellOpt[];
  /** ESCOUADE (Lot 4) : les ALLIÉS de l'ennemi encore en action et posés (l'ennemi lui-même EXCLU),
   *  résolus par l'appelant (couche impure qui a le `battle`). Sert au FEU CONCENTRÉ (surnombre RAW en
   *  mêlée, LDB 14 — même `outnumberMod` et même décompte que la résolution, cf. combatFlow.ts:425) et
   *  à la COHÉSION légère (ne pas s'isoler / ne pas bloquer l'allié). ABSENT = comportement Lot 3 STRICTEMENT
   *  inchangé (le golden et les fixtures sans escouade restent identiques). */
  squad?: Combatant[];
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// POIDS DES HEURISTIQUES (Lot 3) — centralisés et commentés pour régler le RESSENTI sans toucher au
// code. Chaque poids module une grandeur dérivée du moteur (Blessures espérées, États, géométrie) ;
// l'utilité finale d'un candidat est une SOMME pondérée (`scoreCandidate`). Plus le score est HAUT,
// meilleur le candidat (argmax = max). Les grandeurs de base sont en « Blessures espérées » (l'unité
// commune : ce qu'on retire de PB) ; les bonus de position/contrôle sont calibrés sur cette échelle.
// ════════════════════════════════════════════════════════════════════════════════════════════════
const W = {
  /** Espérance de Blessures qu'on inflige À la cible ce tour (cœur offensif). Unité native → ×1. */
  damageDealt: 1,
  /** Menace de la cible (dégâts qu'ELLE peut nous infliger × atteignabilité × fragilité). On vise en
   *  priorité ce qui nous menace le plus tout en étant éliminable : pèse autant que nos propres dégâts. */
  threat: 1,
  /** Achever une cible (dégâts attendus ≥ PB restants) : prime forte — un mort ne riposte plus. */
  killSecure: 12,
  /** S'acharner sur une cible NEUTRALISÉE (à terre/inconsciente/0 PB) : malus FORT (anti-acharnement,
   *  Lot 1) — on ne la frappe qu'en dernier recours (aucune menace debout). */
  overkill: 100,
  /** Valeur d'un État infligé (contrôle), pondérée par sa dangerosité (cf. `CONDITION_THREAT`). */
  control: 1,
  /** Héros couvert par une ZdE (au-delà du 1ᵉʳ — un missile mono-cible touche déjà 1). */
  aoePerExtraHero: 6,
  /** Frapper au FLANC/DOS (hors champ de vision avant de la cible, LDB 14 l.91) : gratuit → bonus modéré. */
  flankRear: 4,
  /** Gain de COUVERT pour soi en se déplaçant (par cran de couvert gagné : imparfaite/moyenne/totale). */
  coverGain: 3,
  /** Respect de la portée PRÉFÉRÉE : un tireur/lanceur qui reste à distance de tir+LdV plutôt que d'entrer
   *  en mêlée ; un mêlée qui se met au contact. Bonus quand la case d'arrivée respecte la préférence. */
  preferredRange: 5,
  /** Pénalité de DISTANCE résiduelle à la cible après un `move` (par case) : à utilité égale, on choisit
   *  la case qui réduit le plus la distance (départage des approches, calibré faible). */
  approachDist: 0.2,
  // — Lot 4 (contexte d'escouade) ————————————————————————————————————————————————————————————————
  /** ÉVITEMENT du DANGER (danger-map) : pénalité par Blessure espérée que les héros nous infligeraient
   *  DEPUIS la case d'arrivée (Σ sur les héros, via `expectedDamage` réciproque). Calibré < 1 (l'unité
   *  est déjà en « Blessures espérées ») pour rester un DÉPARTAGE de cases d'approche, jamais un veto qui
   *  immobiliserait l'ennemi (l'utilité d'attaque, ×1..12, doit pouvoir l'emporter et faire avancer). */
  dangerAvoid: 0.5,
  /** COHÉSION : malus si la case d'arrivée ISOLE fortement l'ennemi de son escouade (aucun allié à
   *  portée de soutien). SOBRE et faible — un simple départage à utilité d'attaque égale, pour préférer
   *  rester en formation plutôt que de partir seul (n'inverse jamais un choix offensif/danger marqué). */
  cohesion: 1.5,
  // — SOUTIEN (grimoire de soutien : buff/soin/débuff/invocation) ————————————————————————————————————
  /** SOIN d'un allié : facteur appliqué aux PB réellement RÉCUPÉRABLES (min(soin, PB manquants)). À ~1, un
   *  soin de N PB pèse comme N Blessures infligées — on soigne quand ça « rend » autant qu'attaquer rapporte. */
  healValue: 1,
  /** BUFF (soi/allié) : facteur sur la magnitude du buff (≈ |charMod|/10 + 2/État…). Calibré modeste : un
   *  buff utile bat une attaque faible mais pas une bonne attaque/un achèvement (anti buff-spam). */
  buffValue: 1.5,
  /** DÉBUFF d'un ennemi : facteur sur la valeur de CONTRÔLE de l'État infligé (`controlValue`) × menace de
   *  la cible (on débuffe le héros le plus menaçant). Aligné sur l'échelle de `control` (États). */
  debuffValue: 1,
  /** INVOCATION : facteur sur la magnitude (≈ 2 × nb de créatures), MAJORÉ par l'infériorité numérique
   *  (× ratio héros/alliés). Sobre — l'IA renforce ses rangs quand elle est en sous-nombre, sans boucler. */
  summonValue: 1,
  // NB : le FEU CONCENTRÉ n'a PAS de poids ad hoc — il passe par le bonus de toucher `outnumberMod` (RAW,
  // LDB 14), injecté dans l'espérance de dégâts (mêlée). C'est un EFFET ÉMERGENT, pas une constante inventée.
} as const;

/** Jeu de poids EFFECTIF utilisé par le scoring. `W` (ci-dessus) est le DÉFAUT neutre ; une doctrine en
 *  est un override PARTIEL (cf. `DOCTRINES`). Toutes les clés sont muables ici (≠ `W` figé). */
type Weights = { -readonly [K in keyof typeof W]: number };

// ════════════════════════════════════════════════════════════════════════════════════════════════
// LOT 5 — DOCTRINES TACTIQUES data-driven. « Un loup ≠ une bande de brigands ≠ une compagnie d'élite ».
// Une DOCTRINE = (a) un OVERRIDE PARTIEL des poids `W` du cœur discrétionnaire + (b) 1-2 micro-réglages
// de macro-comportement (`macro`). Elle est SÉLECTIONNÉE par des signaux DATA (traits/Intelligence/groups/
// sorts — `pickDoctrine`), JAMAIS par un nom de créature en dur. CONTRAINTE RAW ABSOLUE : une doctrine ne
// module QUE les poids du scoring discrétionnaire — elle ne touche JAMAIS une garde forcée (fuite Bestial
// <50 %, Frénésie, Brisé, Territorial, En flammes/Empêtré, filtre Animosité/Haine), qui restent EN AMONT,
// inchangées. Le surnombre reste `outnumberMod` (aucun nouveau modificateur de combat). Les valeurs sont
// du RESSENTI (latitude IA permise), pas des règles canon.
// ════════════════════════════════════════════════════════════════════════════════════════════════
export type DoctrineId = 'standard' | 'meute' | 'racaille' | 'soldats' | 'tirailleurs' | 'artillerie' | 'horde' | 'embuscade';

/** Macro-réglages LÉGERS d'une doctrine (au-delà des poids), appliqués DANS le cœur discrétionnaire sans
 *  jamais contredire une garde RAW. */
interface DoctrineMacro {
  /** REPLI « doctrine » (LATITUDE, hors RAW) : un NON-Bestial très entamé (PB/PBmax < seuil) qui n'est PAS
   *  Engagé se replie comme un Bestial (réutilise `fleeMove`, aucun nouveau mécanisme). N'a d'effet QUE pour
   *  un combattant SANS garde de fuite RAW (un Bestial est déjà géré en amont, intouché). Absent ⇒ pas de repli. */
  retreatBelow?: number;
}

/** Une doctrine = override partiel des poids + macro optionnel. */
type Doctrine = Partial<Weights> & { macro?: DoctrineMacro };

/**
 * Les 7 doctrines (presets confirmés). Chaque entrée n'écrit QUE les poids qu'elle DÉVIE de `W` ; tout le
 * reste hérite du défaut neutre. `standard` est volontairement VIDE (= `W` à l'identique) → garantit que le
 * golden et les fixtures génériques (classées `standard`) gardent EXACTEMENT le comportement des Lots 1-4.
 */
const DOCTRINES: Record<DoctrineId, Doctrine> = {
  // DÉFAUT NEUTRE — aucun delta : les poids effectifs == `W`. Obligatoire pour la parité golden.
  standard: {},
  // MEUTE / prédateur (Bestial, Int basse, ni sorts ni tir) : se rue sur la proie ISOLÉE/blessée et la prend
  // à revers. ↑threat (la fragilité/atteignabilité dans `targetThreat` pèse plus → cible l'entamé) ; ↑flankRear
  // (encerclement). La FUITE <50 % PB est DÉJÀ la garde Bestial RAW (LDB 85) en amont — PAS réimplémentée ici.
  meute: { threat: 1.8, flankRear: 8 },
  // RACAILLE / opportuniste (humain, Int moyenne, aucun signal militaire) : tape le plus faible/sans défense
  // et se préserve. ↑threat (priorise la cible fragile/achevable, comme la meute mais sans le flanc de prédateur)
  // ↑killSecure (achève dès que possible) ↑dangerAvoid (esquive les cases dangereuses). MACRO : repli « doctrine »
  // léger sous 1/3 PB (LATITUDE — un non-Bestial n'a pas de fuite RAW, donc ce repli ne contredit aucune garde).
  racaille: { threat: 1.5, killSecure: 16, dangerAvoid: 0.9, macro: { retreatBelow: 1 / 3 } },
  // SOLDATS / tenir la ligne (groups militaire OU CC élevée, ni Bestial ni Stupide) : FEU CONCENTRÉ (le
  // surnombre `outnumberMod` est déjà dans l'espérance de dégâts en mêlée → on RENFORCE le poids de dégâts
  // pour que la cible encadrée par les alliés l'emporte plus nettement), tient le COUVERT (↑coverGain),
  // préfère le contact (↑preferredRange : tenir la ligne au corps-à-corps), cohésion plus marquée (formation).
  soldats: { damageDealt: 1.4, coverGain: 6, preferredRange: 8, cohesion: 3, healValue: 1.3, buffValue: 1.8 },
  // TIRAILLEURS / kiting (arme à distance + Agilité haute, pas de préférence mêlée) : garde la DISTANCE,
  // recule devant l'approche, vise les casters. ↑preferredRange (rester à portée de tir+LdV est très valorisé),
  // ↑dangerAvoid (kiting : fuir les cases au contact), ↑threat (un caster dangereux monte en menace → ciblé).
  tirailleurs: { preferredRange: 12, dangerAvoid: 1.2, threat: 1.6 },
  // ARTILLERIE / lanceurs (possède des sorts, Int/FM hautes) : reste LOIN, à couvert, et arrose les paquets.
  // ↑aoePerExtraHero (la ZdE sur un amas écrase nettement le missile mono-cible), ↑control (valorise les États),
  // ↑dangerAvoid + ↑preferredRange (se tient hors de portée), ↑coverGain (se planque).
  artillerie: { aoePerExtraHero: 14, control: 2, dangerAvoid: 1.2, preferredRange: 10, coverGain: 6,
    // Un lanceur valorise davantage son grimoire de soutien (débuff/buff/invocation) — il a le temps,
    // loin de la mêlée. Sobre : les candidats existent déjà par défaut, la doctrine ne fait qu'accentuer.
    debuffValue: 1.5, summonValue: 1.5, buffValue: 2 },
  // HORDE / Insensible-Stupide (mort-vivant Fabriqué, Stupide) : AVANCE DROIT, sans auto-préservation ni
  // cohésion (aucune pensée de groupe). dangerAvoid=0 et cohesion=0 → elle ne contourne pas le danger et ne
  // se soucie pas de rester groupée ; le surnombre brut reste émergent via `outnumberMod`. Pas de repli (un
  // Insensible/Sans Peur ne fuit pas — et n'étant pas Bestial, aucune garde de fuite ne s'applique).
  horde: { dangerAvoid: 0, cohesion: 0 },
  // EMBUSCADE : « attaque-surprise sur l'isolé, pas de repli ». AUCUN signal auto fiable (furtivité/flag de
  // scène / charge initiale d'embuscade) n'existe proprement → SÉLECTIONNABLE UNIQUEMENT par l'override
  // `aiDoctrine` (donnée). DISTINCTE de la meute (≠ identité nominale, cf. relecture L5) : l'embusqué a
  // l'INITIATIVE et frappe pour TUER la cible isolée d'entrée, prise à revers depuis sa cachette. ↑↑flankRear
  // (frappe de dos depuis l'embuscade, plus marqué que la meute) ; ↑↑killSecure (le coup d'ouverture cherche
  // l'élimination — pas un harcèlement de meute) ; ↑threat (priorise l'isolé fragile). Et SURTOUT : AUCUN
  // `macro.retreatBelow` (l'embusqué a choisi son moment, il ne recule pas — contraste avec la racaille).
  // DIFFÉRENCE MINIMALE DÉFENDABLE (faute d'un signal de charge initiale d'embuscade) — signalée au rapport.
  embuscade: { threat: 1.8, flankRear: 12, killSecure: 18 },
};

/**
 * Choisit la DOCTRINE d'un ennemi à partir de signaux ROBUSTES & data-driven (PURE, déterministe — aucun
 * dé, aucun store). Priorité : (1) OVERRIDE `enemy.aiDoctrine` (donnée Codex/éditeur) s'il est VALIDE →
 * renvoyé tel quel ; (2) sinon classification par traits/Intelligence/groups/équipement. DÉFAUT NEUTRE
 * `standard` dès qu'aucun signal n'est franc (garantit l'inchangé des tests/golden). AUCUN nom de créature/
 * carrière en dur : on lit des capacités (`isBestial`…), une Caractéristique (`Int`) et des `groups`.
 *
 * @param enemy l'ennemi qui agit (traits/characteristics/groups/spells/weapons).
 * @param squad ses alliés (réservé à de futurs signaux d'escouade — non requis par les règles actuelles).
 */
export function pickDoctrine(enemy: Combatant, _squad: Combatant[] = []): DoctrineId {
  // (1) OVERRIDE EN DONNÉE prioritaire : si l'auteur a figé une doctrine valide, on la respecte TELLE QUELLE.
  const forced = enemy.aiDoctrine;
  if (forced && forced in DOCTRINES) return forced as DoctrineId;

  const traits = enemy.traits;
  const bestial = isBestial(traits);
  const mindless = isMindless(traits);
  const stupid = isStupid(traits);
  // Intelligence effective (garde NaN : caractéristiques absentes sur un combattant de test → on traite
  // comme « non chiffrable », donc aucun signal Int — la classification tombe sur les autres signaux/standard).
  const int = finite(effectiveChar(enemy, 'Int'), NaN);
  const hasInt = Number.isFinite(int);
  const hasSpells = (enemy.spells?.length ?? 0) > 0;
  const hasRangedWeapon = enemy.weapons.some((w) => w.type === 'ranged');
  const ag = finite(effectiveChar(enemy, 'Ag'), NaN);
  // SIGNAL « groupe » data-driven (≠ folder.includes fragile, ≠ nom en dur) : on matche les `groups`
  // (auto-dérivés en donnée : racial, carrière, catégorie bestiaire) contre des CATÉGORIES, via `groupMatch`
  // (tolérant pluriel/sous-type). Un combattant martial appartient à un groupe militaire ; un humanoïde
  // « racaille » à un groupe racial/criminel. ABSENCE de groupe ⇒ pas de signal (fixtures génériques → standard).
  const groups = enemy.groups ?? [];
  const inGroup = (cats: string[]) => cats.some((cat) => groupMatch(cat, groups));
  // Signaux MILITAIRE et RACAILLE — UNIQUEMENT des jetons qui matchent VRAIMENT un Groupe émis par
  // `groupsFor` (`engine/groups.ts`), pour une classification HONNÊTE (relecture L6). Deux familles de
  // signaux réels :
  //  • Catégories de Groupe dérivées du folder bestiaire : `Cultiste`, `Peau-Verte`, `Skaven` (FOLDER_RULES).
  //  • Libellés de CARRIÈRE poussés tels quels par `groupsFor` (`career.label`) : `Soldat`, `Garde`,
  //    `Chevalier` sont de vraies carrières (`careers.json`). `Criminel` est auto-dérivé de la CLASSE
  //    `roublards` (Hors-la-loi, Voleur, Receleur, Pilleur de tombes…) → couvre toute la racaille criminelle.
  // RETIRÉ comme ENTRÉES MORTES (aucune dérivation correspondante, cf. relecture) : `Militaire` et
  // `Mercenaire` (pas de carrière/catégorie de ce nom) côté militaire ; `Bandit` côté racaille (« Bandit »
  // est un NIVEAU de la carrière Hors-la-loi, pas un libellé de carrière poussé en Groupe — déjà couvert
  // par `Criminel`). Le levier fin reste l'override `aiDoctrine` (et les `extras` manuels de l'éditeur).
  const MILITARY = ['Soldat', 'Garde', 'Chevalier'];
  const RABBLE = ['Criminel', 'Cultiste', 'Peau-Verte', 'Skaven'];
  const isMilitary = inGroup(MILITARY);
  const isRabble = inGroup(RABBLE);

  // (2) Classification par signaux, du plus DISCRIMINANT au plus général (ordre = priorité). Tous les
  // prédicats reposent sur des SIGNAUX FRANCS (trait/sort/Agilité/groupe) qu'une fixture GÉNÉRIQUE (sans
  // groups, sans trait spécial, Ag moyenne, sans sort) NE possède PAS → elle tombe en `standard` (parité).
  // HORDE : un esprit absent/Stupide (mort-vivant Fabriqué, créature Stupide) avance droit sans se préserver.
  if (mindless || stupid) return 'horde';
  // ARTILLERIE : un LANCEUR (possède des sorts) à l'esprit vif (Int haute) reste loin et arrose les paquets.
  if (hasSpells && hasInt && int >= 30) return 'artillerie';
  // MEUTE : prédateur Bestial à l'esprit animal (Int basse/non chiffrable), SANS sorts ni arme à distance.
  if (bestial && (!hasInt || int < 25) && !hasSpells && !hasRangedWeapon) return 'meute';
  // TIRAILLEURS : tireur AGILE (Ag franche) qui n'est pas un pur mêlée → kiting (garde la distance, vise les casters).
  if (hasRangedWeapon && Number.isFinite(ag) && ag >= 40) return 'tirailleurs';
  // SOLDATS : appartient à un groupe MILITAIRE (entraîné/organisé), ni Bestial ni Stupide → tient la ligne, feu concentré.
  if (isMilitary && !bestial) return 'soldats';
  // RACAILLE : humanoïde d'un groupe racaille/criminel (sans signal militaire/magique) → opportuniste, tape le faible.
  if (isRabble && !bestial) return 'racaille';
  // DÉFAUT NEUTRE : aucun signal franc (fixtures génériques, caractéristiques absentes…) → comportement Lots 1-4.
  return 'standard';
}

/** Poids EFFECTIFS d'une doctrine : `W` (défaut neutre) + override partiel. Le `macro` n'est PAS un poids
 *  (lu séparément). Une clé absente de l'override garde sa valeur `W`. PUR. */
function doctrineWeights(id: DoctrineId): Weights {
  const d = DOCTRINES[id];
  const w: Weights = { ...W };
  for (const k of Object.keys(W) as (keyof typeof W)[]) {
    const v = d[k];
    if (typeof v === 'number') w[k] = v;
  }
  return w;
}

/**
 * Dangerosité d'un ÉTAT infligé (LDB 16), en « Blessures espérées équivalentes » — pour `controlValue`.
 * LU EN DONNÉE par nom d'État (clé = `name` du `op:'condition'`), pas une liste de sorts : un nouvel État
 * se règle ici. Calibrage : un État qui SUPPRIME l'Action (Étourdi/Inconscient) ou tue à petit feu
 * (En flammes/Empoisonné/Hémorragie) vaut plus qu'un simple malus (Aveuglé/Assourdi/Ensanglanté). Les
 * valeurs sont des poids de RESSENTI (latitude IA), pas des règles. États inconnus → 1 (contrôle mineur).
 */
const CONDITION_THREAT: Record<string, number> = {
  inconscient: 8, // hors de combat
  'a-terre': 3, // vulnérable + perd son prochain mouvement
  etourdi: 6, // ne peut pas agir (LDB 16 l.123)
  'en-flammes': 5, // 1d10/Round, force le « se rouler »
  empoisonne: 4, // dégâts récurrents
  hemorragie: 4, // dégâts récurrents
  empetre: 5, // Mouvement nul + Action perdue à se libérer
  aveugle: 4, // −10 et ne peut viser
  assourdi: 2,
  ensanglante: 2,
  surpris: 4, // pas de réaction (LDB 16 l.132)
};

/**
 * Une cible est NEUTRALISÉE (au sol/inconsciente/0 PB encore là) : on n'a aucun intérêt tactique à
 * s'acharner dessus tant qu'une menace DEBOUT existe. Lue en DONNÉE (États + Blessures), sans nom en
 * dur — un combattant À Terre/Inconscient ou à ≤0 PB (encore dans le vivier) est « par terre ».
 */
function isNeutralized(h: Combatant): boolean {
  // `conditions` peut manquer sur un combattant de test minimal → garde (hasCondition lève sinon).
  const cond = h.conditions ?? [];
  return cond.some((c) => c.name === 'a-terre' || c.name === 'inconscient') || h.wounds.current <= 0;
}

/** Garde NaN : une grandeur dérivée du moteur peut être NaN si les Caractéristiques d'un combattant de
 *  test sont absentes (`{} as never`). On retombe alors sur `fallback` (neutre) → scoring déterministe :
 *  les heuristiques fines s'effacent et le palier d'action + les tie-breaks (cf. plus bas) décident. */
const finite = (n: number, fallback = 0): number => (Number.isFinite(n) ? n : fallback);

/**
 * Probabilité de TOUCHER (0..1) d'une attaque, dérivée de la valeur cible RAW (base + modificateurs
 * plafonnés par `combineMods`, comme la résolution) : `P = clamp(target, 5, 95) / 100` (un d100 réussit
 * si ≤ cible ; bornes 5/95 ≈ l'auto-échec/réussite usuel). PUR, sans dé. Les modificateurs de PORTÉE/
 * Taille/État/Avantage sont ceux du moteur → l'espérance reflète la vraie difficulté du jet.
 */
function hitProbability(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number, env?: ModLine[]): number {
  const val = combatValue(attacker, kind, weapon);
  // `env` (Lot 4) : modificateurs de scène/contexte (ex. Surnombre RAW en mêlée) injectés EXACTEMENT comme
  // la résolution (`attackModifiers({ env })`) → l'espérance reflète le vrai bonus de toucher, sans dérive.
  const mods = combineMods(attackModifiers(attacker, target, weapon, { kind, distanceTiles, env }));
  const targetVal = finite(val + mods, NaN);
  if (!Number.isFinite(targetVal)) return NaN;
  return Math.max(5, Math.min(95, targetVal)) / 100;
}

/**
 * Espérance de Blessures d'une attaque d'arme `attacker → target` (PUR, sans dé) : probabilité de
 * toucher × Blessures d'un coup MOYEN. Les Dégâts d'un coup = Dégâts d'arme (`flat` + BF si `plusBF`) +
 * un DR moyen modeste (1) ; les Blessures réelles passent par `woundsFromHit` (BE + PA à la localisation
 * « corps », qualités d'arme) — MÊME résolveur que le combat. `min 1` (Robuste) inclus par `woundsFromHit`.
 */
function expectedDamage(attacker: Combatant, target: Combatant, weapon: Weapon, kind: 'melee' | 'ranged', distanceTiles?: number, env?: ModLine[]): number {
  const p = hitProbability(attacker, target, weapon, kind, distanceTiles, env);
  if (!Number.isFinite(p)) return NaN;
  const bf = bonus(effectiveChar(attacker, 'F'));
  const avgDR = 1; // DR moyen prudent (l'espérance d'un DR ≥ 0 sur une réussite) — calibrage IA, pas une règle
  // Dégâts d'arme (Dégâts d'arme + BF si `plusBF`) résolus par le moteur (gère « Spécial »/literal → 0).
  const totalDamage = finite(effectiveWeaponDamage(weapon, Number.isFinite(bf) ? bf : 0) + avgDR, NaN);
  if (!Number.isFinite(totalDamage)) return NaN;
  return p * safeWounds(weapon, target, totalDamage);
}

/** `woundsFromHit` défensif : un combattant de test minimal peut ne pas porter `armour` (le résolveur
 *  lirait `c.armour[loc]` sur `undefined`). On lui prête une armure NULLE (objet vide) le cas échéant —
 *  l'espérance reste prudente (sous-estime légèrement la mitigation). Renvoie 0 si NaN. */
function safeWounds(weapon: Weapon, target: Combatant, totalDamage: number): number {
  const safe = target.armour ? target : ({ ...target, armour: {} as Combatant['armour'] });
  return finite(woundsFromHit(weapon, safe, 'corps', totalDamage), 0);
}

/** Espérance de Blessures d'un Projectile magique `caster → target` (PUR) : probabilité (≈ tir, via la
 *  CT/valeur du sort approximée par la meilleure arme à distance OU une difficulté neutre) × Dégâts du
 *  missile (`missileDamage` : Dégâts + DR moyen, − BE/PA sauf ignorePA/ignoreBE). Sans données de sort →
 *  NaN (scoring neutre). Approximation assumée : la vraie valeur d'incantation (Langue (Magick)) n'est pas
 *  dans `ai.ts` ; on prend une probabilité de référence (0,6) modulée par l'Avantage de l'attaquant. */
function expectedSpellDamage(caster: Combatant, target: Combatant, spell: SpellLike | undefined): number {
  if (!spell) return NaN;
  const md = missileDamage(spell);
  if (!md) return 0; // sort non-missile (débuff/contrôle) : 0 dégât direct (sa valeur passe par controlValue)
  const bfm = bonus(effectiveChar(caster, 'FM'));
  const avgDR = 1;
  const raw = finite(md.damage + (Number.isFinite(bfm) ? bfm : 0) + avgDR, md.damage + avgDR);
  const tb = bonus(effectiveChar(target, 'E'));
  const ap = 0; // PA non connus finement ici ; l'espérance reste prudente (sous-estime légèrement)
  const mitig = (md.ignoreBE ? 0 : finite(tb, 0)) + (md.ignorePA ? 0 : ap);
  const wounds = Math.max(0, raw - mitig);
  // Probabilité de référence (lanceur) ajustée par l'Avantage (×10 → /100 comme un mod de toucher).
  const p = Math.max(0.1, Math.min(0.95, 0.6 + (caster.advantage ?? 0) * 0.1));
  return p * wounds;
}

/**
 * MENACE d'un héros pour l'ennemi (Lot 3 — REMPLACE le « PV le plus bas » comme critère de cible) :
 *  menace = (dégâts qu'il peut nous infliger) × ATTEIGNABILITÉ (proche = menace immédiate) × FRAGILITÉ
 *  (PB bas = plus facile à éliminer, donc cible prioritaire pour neutraliser sa menace).
 * - dégâts du héros : espérance de son MEILLEUR coup contre l'ennemi (mêlée ou tir) — réutilise
 *   `expectedDamage` (symétrie attaquant/défenseur). Plancher 1 (tout adversaire armé reste une menace).
 * - atteignabilité : décroît avec la distance (1 au contact → ~0,3 au loin) — un archer lointain menace
 *   moins qu'un bretteur au contact.
 * - fragilité : (1 + (PBmax − PBcourant)/PBmax) → un héros entamé est ~2× plus « intéressant » (on
 *   sécurise l'élimination, LDB tactique). PUR. NaN-garde sur les dégâts (Caractéristiques absentes).
 */
function targetThreat(enemy: Combatant, hero: Combatant): number {
  const dist = chebyshev(enemy.pos!, hero.pos!);
  const reachability = 1 / (1 + 0.15 * dist); // 1 au contact, décroissance douce
  const maxW = Math.max(1, hero.wounds.max);
  const fragility = 1 + Math.max(0, maxW - hero.wounds.current) / maxW; // 1 (intact) → 2 (presque mort)
  // Danger brut du héros = meilleure espérance de SON coup contre l'ennemi (réciprocité).
  const meleeW = hero.weapons?.find((w) => w.type === 'melee');
  const rangedW = hero.weapons?.find((w) => w.type === 'ranged');
  const dmgMelee = meleeW ? finite(expectedDamage(hero, enemy, meleeW, 'melee'), NaN) : NaN;
  const dmgRanged = rangedW ? finite(expectedDamage(hero, enemy, rangedW, 'ranged', dist), NaN) : NaN;
  const cand = [dmgMelee, dmgRanged].filter((d) => Number.isFinite(d)) as number[];
  const danger = cand.length ? Math.max(...cand) : 1; // pas de Caractéristiques chiffrables → danger neutre (1)
  return Math.max(1, danger) * reachability * fragility;
}

/** Valeur de CONTRÔLE d'un sort (États qu'il inflige, LUS dans ses `op:'condition'` — data-driven, pas
 *  une liste de noms) : Σ dangerosité (`CONDITION_THREAT`) des États posés. Un sort sans `op:'condition'`
 *  → 0 (pas de contrôle). PUR. La structure d'effets (`Flow`) est lue en profondeur (ops imbriqués). */
function controlValue(spell: SpellLike | undefined): number {
  if (!spell) return 0;
  let total = 0;
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n); return; }
    const o = node as Record<string, unknown>;
    if (o.op === 'condition' && typeof o.name === 'string') total += CONDITION_THREAT[o.name] ?? 1;
    for (const v of Object.values(o)) walk(v);
  };
  walk((spell as { effects?: unknown }).effects);
  return total;
}

/** Valeur de CONTRÔLE d'une liste d'États nommés (mêmes poids `CONDITION_THREAT` que `controlValue`) —
 *  pour scorer un débuff classé en DONNÉE (les noms d'États viennent du classifieur, pas d'un nom de sort). */
function controlValueOf(condNames: string[] | undefined): number {
  return (condNames ?? []).reduce((s, n) => s + (CONDITION_THREAT[n] ?? 1), 0);
}

/**
 * Meilleur CENTRE d'un sort de ZONE (ZdE, LDB 47 l.44) couvrant le plus de héros : on essaie chaque
 * case occupée par un héros comme centre candidat (déterministe, suffisant pour « un paquet ») et on
 * compte les héros dans le rayon (Chebyshev, comme `castCommitZone`). Un centre VALIDE doit respecter
 * la portée du sort (Chebyshev depuis le lanceur) et la Ligne de Vue (LDB 46 l.170). Renvoie le centre
 * couvrant le plus de héros (≥2) ou null. Tie-break déterministe : couverture ↓, puis coordonnées ↑.
 */
function bestAreaCenter(
  enemyPos: Pt,
  heroes: Combatant[],
  radius: number,
  range: number | null,
  losAt: (pt: Pt) => boolean,
): { center: Pt; covered: number } | null {
  let best: { center: Pt; covered: number } | null = null;
  for (const h of heroes) {
    const center = h.pos!;
    if (range != null && chebyshev(enemyPos, center) > range) continue;
    if (!losAt(center)) continue;
    const covered = heroes.filter((o) => chebyshev(center, o.pos!) <= radius).length;
    if (
      !best || covered > best.covered ||
      (covered === best.covered && (center.x < best.center.x || (center.x === best.center.x && center.y < best.center.y)))
    ) {
      best = { center, covered };
    }
  }
  return best && best.covered >= 2 ? best : null;
}

/** ANTI-SPAM des BUFFS : la cible porte-t-elle DÉJÀ un effet actif issu de CE sort ? On lit l'IDENTITÉ du
 *  sort source sur l'effet actif — `sourceSpellId` (posé pour TOUT lancement, **Prières COMPRISES**) ET
 *  `spell.spellId` (Sorts dissipables). C'est ce qui empêche un prêtre de RE-LANCER en boucle une bénédiction
 *  durable (charMod CC+10 sur 6 Rounds) sur le même allié. PUR, data-driven (par id de sort, jamais par nom). */
function hasActiveSpell(target: Combatant, spellId: string): boolean {
  return (target.activeEffects ?? []).some((e) => e.sourceSpellId === spellId || e.spell?.spellId === spellId);
}

/** ANTI-SPAM des DÉBUFFS : la cible porte-t-elle DÉJÀ un État infligé par ce sort ? On lit les `condition`
 *  du sort (data-driven) et on vérifie si la cible porte chacun. Si TOUS les États du sort sont déjà
 *  présents → inutile de le relancer. (Source unique `controlConditionNames` ci-dessous.) */
function alreadyDebuffed(target: Combatant, condNames: string[]): boolean {
  if (!condNames.length) return false;
  const cond = target.conditions ?? [];
  return condNames.every((n) => cond.some((c) => c.name === n));
}

/** Frénésie (LDB 21 l.34) : le frénétique vise IMPÉRATIVEMENT l'ennemi le plus PROCHE de sa Ligne de
 *  Vue (pas le plus faible) ; à distance égale, le plus blessé (tri stable, déterministe). */
function nearest(enemyPos: Pt, heroes: Combatant[]): Combatant {
  return [...heroes].sort((a, b) => {
    const da = manhattan(enemyPos, a.pos!), db = manhattan(enemyPos, b.pos!);
    if (da !== db) return da - db;
    return a.wounds.current - b.wounds.current;
  })[0];
}

/**
 * Un CANDIDAT d'action discrétionnaire (Lot 3 — moteur Utility à score pondéré).
 * `kind` = type d'action (sert au BIAIS de palier dans le départage : à utilité égale, on garde l'ordre
 * castArea < focus < cast < reload < shoot < melee < move — la cascade historique comme tie-break stable,
 * PAS comme priorité absolue : une utilité supérieure renverse désormais le palier). `utility` = somme
 * pondérée des heuristiques (plus HAUT = mieux). `targetId`/`coord` = départage déterministe final.
 */
interface Candidate {
  action: EnemyAction;
  kind: keyof typeof TIER;
  /** Utilité pondérée (Lot 3) — somme des heuristiques. Plus HAUT = meilleur. */
  utility: number;
  /** id de la cible visée (départage, stable) — vide si l'action n'en a pas. */
  targetId: string;
  /** coordonnées de destination/centre (départage) — null si l'action n'en a pas. */
  coord: Pt | null;
}

// Paliers d'action (cascade historique, du plus prioritaire au moins). Au Lot 3 ils ne servent plus de
// PRIORITÉ absolue (l'utilité prime) mais de BIAIS de départage stable à utilité égale (parité golden).
const TIER = {
  castArea: 0, // ZdE couvrant ≥2 héros (LDB 47 l.44)
  focus: 1, // Focalisation d'un sort infaisable d'un jet (LDB 46)
  cast: 2, // sort offensif mono-cible
  reload: 3, // recharge d'une arme à Recharge
  shoot: 4, // tir à distance
  melee: 5, // attaque de mêlée
  move: 6, // approche / repositionnement
} as const;

/**
 * argmax déterministe (Lot 3) : meilleur candidat par UTILITÉ décroissante. Tie-break STABLE à utilité
 * égale (départage lexicographique) : palier d'action (cascade historique) ↑, puis id de cible ↑, puis
 * coordonnées (x,y) ↑, puis index d'énumération (ultime garde-fou). Les égalités d'utilité sont gérées
 * proprement par cette chaîne — déterministe, sans dé.
 */
function argmax(cands: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  let bi = -1;
  for (let i = 0; i < cands.length; i++) {
    const c = cands[i];
    if (best == null) { best = c; bi = i; continue; }
    // Comparaison : utilité DÉCROISSANTE d'abord ; à égalité (à epsilon près), tie-break lexicographique.
    const du = c.utility - best.utility;
    let better: boolean;
    if (Math.abs(du) > 1e-9) better = du > 0;
    else if (TIER[c.kind] !== TIER[best.kind]) better = TIER[c.kind] < TIER[best.kind];
    else if (c.targetId !== best.targetId) better = c.targetId < best.targetId;
    else if ((c.coord?.x ?? 0) !== (best.coord?.x ?? 0)) better = (c.coord?.x ?? 0) < (best.coord?.x ?? 0);
    else if ((c.coord?.y ?? 0) !== (best.coord?.y ?? 0)) better = (c.coord?.y ?? 0) < (best.coord?.y ?? 0);
    else better = i < bi; // parfaitement égaux → ordre d'énumération (ne survient pas en pratique)
    if (better) { best = c; bi = i; }
  }
  return best;
}

/** Choisit l'action d'un ennemi pour son tour. Pure et déterministe. */
export function chooseEnemyAction(input: EnemyTurnInput): EnemyAction {
  const { enemy, scene, blocked, movement, offensiveSpell, spellRange, smoke, flying } = input;
  const { readyFocusedSpell, focusableSpell, areaSpell, offensiveSpellData, facing } = input;
  // Escouade (Lot 4) : alliés posés encore en action (l'ennemi exclu par l'appelant). Absent → [] →
  // surnombre/cohésion/danger-map neutres = comportement Lot 3 strictement inchangé.
  const squad = input.squad ?? [];
  // Vision réciproque : l'ennemi ne cible/poursuit que les héros qu'il PERÇOIT (LoS + lumière, comme le
  // groupe). `perceived` absent = aucun gate (comportement historique / tests purs).
  const heroes = input.perceived
    ? input.heroes.filter((h) => h.pos && input.perceived!.has(`${h.pos.x},${h.pos.y},0`))
    : input.heroes;
  if (input.heroes.length === 0) return { kind: 'end' }; // plus AUCUN adversaire (combat fini) → passe la main
  if (!canTakeAction(enemy) && effectiveMovement(enemy) === 0) return { kind: 'end' }; // ni Action ni Mouvement (Surpris LDB 16 l.132…) → passe la main (gating data-driven, plus de nom en dur)
  // En flammes (LDB 16 l.77) : un ennemi NON frénétique se roule au sol pour éteindre le feu (1d10/Round
  // est mortel). Un frénétique ignore le danger et continue d'attaquer (Frénésie, LDB 21 l.34).
  if (hasCondition(enemy, 'en-flammes') && !isFrenzied(enemy)) return { kind: 'recover', state: 'en-flammes' };
  const pos = enemy.pos!;
  // Portée de mêlée = Allonge de l'arme (RAW-3, LDB 62 l.211/213) ; 1 case par défaut. Diagonale incluse
  // (Chebyshev). Source unique partagée avec le héros et la résolution → symétrie héros/ennemi.
  const mr = meleeReachTiles(enemy.weapons);
  const withinMelee = (a: Pt, b: Pt) => chebyshev(a, b) <= mr;
  // Au CONTACT par empreinte (LDB 15 l.55) : un grand ennemi touche depuis n'importe quelle de ses tuiles.
  const inMelee = (h: Combatant) => footprintChebyshev(pos, footprintN(enemy), h.pos!, footprintN(h)) <= mr;

  const hasRanged = offensiveSpell == null && enemy.weapons.some((w) => w.type === 'ranged');
  const hasMeleeWeapon = enemy.weapons.some((w) => w.type === 'melee');
  // Rechargement (LDB 63 l.28-29) : une arme à Recharge DÉCHARGÉE ne peut pas tirer → il faut recharger
  // d'abord. `loaded` n'est suivi que pour les acteurs concernés (héros ayant tiré) ; un ennemi reste
  // chargé (le décompte de Recharge lui est épargné), donc `!enemy.loaded` ne déclenche que pour qui doit.
  const rangedW = enemy.weapons.find((w) => w.type === 'ranged');
  const reloadNeeded = hasRanged && !!rangedW && (rangedW.reload ?? 0) > 0 && !enemy.loaded;

  // Un ennemi sans AUCUN moyen d'agir (sort offensif/focalisé/focalisable/ZdE/SOUTIEN NI sort, ni arme)
  // ne peut rien faire d'utile → il passe la main (les sorts comptent comme une capacité d'action, soutien
  // inclus : un lanceur de pur soutien — soin/buff/débuff/invocation — DOIT pouvoir agir, pas passer son tour).
  const hasAnyMagic = offensiveSpell != null || readyFocusedSpell != null || focusableSpell != null || areaSpell != null
    || (input.supportSpells?.length ?? 0) > 0;
  if (!hasAnyMagic && enemy.weapons.length === 0) return { kind: 'end' };

  // Adversaires au Combat rapproché (au contact). Avec une arme de mêlée, on les frappe plutôt que
  // de tirer : une arme à distance sans Atout Pistolet ne tire pas en mêlée (LDB Armes l.297-298).
  const adjacentFoes = heroes.filter(inMelee);
  // Ligne de Vue (LDB 13 l.123) : on ne vise au tir/sort qu'une cible visible. Occupants ignorés
  // ici (une créature ne BLOQUE pas la vue — elle ne donne qu'un couvert imparfait, géré au jet).
  const visible = (h: Combatant): boolean => losClear(scene, pos, h.pos!, smoke ?? []);
  const shootableHeroes = heroes.filter(visible);
  // PORTÉE (parité avec le gate pré-clic du héros) : un tireur ne vise pas au-delà de la bande
  // Extrême (Portée ×3 — rangeBandModifier null), un lanceur pas au-delà de la portée du sort.
  // Sans portée chiffrée (arme sans `range`, sort spécial) : pas de gate (stubs/exotiques).
  const fpDist = (h: Combatant) => footprintChebyshev(pos, footprintN(enemy), h.pos!, footprintN(h));
  const ebf = () => bonus(effectiveChar(enemy, 'F')); // BF du tireur → résout les Portées de jet `{bf}` (paresseux : ignoré pour une portée fixe)
  const maxWeaponRange = enemy.weapons.reduce((m, w) => { const r = w.type === 'ranged' ? effectiveWeaponRange(w, selectedAmmo(enemy, w)?.ammoRangeMod, ebf) : null; return r != null ? Math.max(m, r) : m; }, 0);
  const shootPool = maxWeaponRange > 0 ? shootableHeroes.filter((h) => rangeBandModifier(fpDist(h), maxWeaponRange) != null) : shootableHeroes;
  const castPool = spellRange != null ? shootableHeroes.filter((h) => fpDist(h) <= spellRange) : shootableHeroes;
  // Frénésie (LDB 21 l.34) : la seule Action est un Test de Capacité de Combat / Athlétisme — ni tir ni sort.
  const frenzied = isFrenzied(enemy);
  // Sort offensif à lancer ce tour : un sort DÉJÀ focalisé et prêt (lançable à NI 0) prime sur le
  // meilleur missile faisable en un jet (l'appelant a résolu `spellRange` pour CE sort).
  const castSpellId = readyFocusedSpell ?? offensiveSpell;
  const canShoot = !frenzied && hasRanged && !reloadNeeded && !(adjacentFoes.length > 0 && hasMeleeWeapon) && shootPool.length > 0;
  const canCast = !frenzied && castSpellId != null && castPool.length > 0;

  // Cases atteignables ce tour (inclut la case de départ à distance 0). Vol (LDB 85 p.343) :
  // ligne directe, seules les cases d'atterrissage doivent être praticables et libres.
  const reach = (flying ? flyReachable : reachable)(scene, pos, movement, blocked, footprintN(enemy));

  // ANTI-IMMOBILISME (combat ENGAGÉ, fidélité LDB 13 l.123) : si la perception ne montre AUCUNE cible
  // (lumière/Ligne de Vue) mais que des adversaires EXISTENT, l'ennemi avance d'un cran vers le plus
  // proche NON perçu — il ne tire/lance PAS dessus (pas de vue), il se RAPPROCHE seulement (mouvement
  // seul), au lieu de passer son tour planté. Pur : aucune cible non perçue n'est jamais visée.
  if (heroes.length === 0) {
    const closest = [...input.heroes].filter((h) => h.pos).sort((a, b) => manhattan(pos, a.pos!) - manhattan(pos, b.pos!))[0];
    if (!closest) return { kind: 'end' };
    let to: Pt | null = null;
    let bestD: number | null = null;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue;
      const d = manhattan({ x, y }, closest.pos!);
      if (bestD == null || d < bestD) { bestD = d; to = { x, y }; }
    }
    return to ? { kind: 'move', to, thenTargetId: closest.id } : { kind: 'end' };
  }

  // Fuite (Brisé / Bestial blessé). `preferHidden` (Brisé, LDB 16 l.55 « hors de vue de l'ennemi ») :
  // gagner une CACHETTE (case hors de vue de tout héros) prime sur la distance ; sinon, la plus éloignée.
  const fleeMove = (preferHidden = false): EnemyAction => {
    const tiles = [...reach.keys()].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y } as Pt; });
    const distOf = (t: Pt) => Math.min(...heroes.map((h) => chebyshev(t, h.pos!)));
    const hidden = preferHidden ? tiles.filter((t) => !tileSeenByFoe(scene, heroes, t, smoke ?? [])) : [];
    let best = pos;
    let bestDist = distOf(pos);
    // Actuellement à découvert mais une cachette est atteignable → toute cachette vaut mieux que rester vu.
    if (hidden.length && tileSeenByFoe(scene, heroes, pos, smoke ?? [])) { best = hidden[0]; bestDist = -1; }
    for (const t of (hidden.length ? hidden : tiles)) {
      const d = distOf(t);
      if (d > bestDist) { bestDist = d; best = t; }
    }
    return best.x === pos.x && best.y === pos.y ? { kind: 'end' } : { kind: 'move', to: best, thenTargetId: heroes[0].id };
  };
  // Brisé (LDB 16 l.55) : un ennemi Brisé NON Engagé fuit — il gagne la case atteignable la PLUS
  // éloignée des héros et ne peut pas attaquer. (Engagé : il reste — l'IA ne se désengage pas, simplif. assumée.)
  if (hasCondition(enemy, 'brise') && !isEngaged(enemy)) return fleeMove(true); // Brisé : fuir hors de vue (cachette prioritaire)
  // Bestial (LDB 85 p.338) : « Si elle perd plus de la moitié de ses Blessures, elle tente de fuir »
  // — sauf Territorial (combat jusqu'à la mort) ou acculée/Engagée (elle reste — Frénésie gérée par
  // le drapeau frenzied de l'appelant).
  if (isBestial(enemy.traits) && !isTerritorial(enemy.traits) && !isFrenzied(enemy)
      && enemy.wounds.current < enemy.wounds.max / 2 && !isEngaged(enemy)) return fleeMove();

  // === DOCTRINE TACTIQUE (Lot 5) ===========================================================
  // La doctrine (déduite des signaux DATA ou forcée par `enemy.aiDoctrine`) module les POIDS du cœur
  // discrétionnaire ci-dessous (`Weff` = `W` + override partiel). Elle est choisie APRÈS toutes les gardes
  // forcées (fin de combat, En flammes, Brisé, Bestial, anti-immobilisme) — qu'elle ne touche JAMAIS — et
  // AVANT le scoring. Un éventuel REPLI « doctrine » (`macro.retreatBelow`, latitude hors RAW) ne s'applique
  // qu'à un combattant SANS garde de fuite RAW (Bestial déjà géré en amont) et non Engagé.
  const doctrine = pickDoctrine(enemy, squad);
  const Weff = doctrineWeights(doctrine);
  const macro = DOCTRINES[doctrine].macro;
  // GARDE Empêtré (LDB 16 l.61/85) : un Empêtré a un Mouvement NUL → `fleeMove` ne trouverait aucune
  // case d'évasion et renverrait `end` (tour gâché). On NE déclenche donc PAS le repli « doctrine » pour
  // un Empêtré : le cœur discrétionnaire ne produira aucun candidat (Mouvement 0) et le fallback final
  // l'enverra sur `recover empetre` (se libérer) — le bon comportement, plutôt que passer son tour.
  if (macro?.retreatBelow != null && !isBestial(enemy.traits) && !isFrenzied(enemy) && !isEngaged(enemy)
      && !hasCondition(enemy, 'empetre')
      && enemy.wounds.current < enemy.wounds.max * macro.retreatBelow) {
    return fleeMove();
  }

  // Un héros est « frappable ce tour » en mêlée s'il est déjà adjacent OU si une
  // case atteignable lui est adjacente.
  const meleeReachableNow = (h: Combatant): boolean => {
    if (withinMelee(pos, h.pos!)) return true;
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (withinMelee({ x, y }, h.pos!)) return true;
    }
    return false;
  };

  // === CŒUR DISCRÉTIONNAIRE — moteur Utility (Lot 3 : score pondéré) =======================
  // Tout ce qui précède (gardes RAW/psychologie : fin de combat, En flammes, Brisé, Bestial, fuite,
  // anti-immobilisme…) reste FORCÉ et n'entre PAS dans le scoring. Ici on ÉNUMÈRE PLUSIEURS candidats
  // par type (un par cible atteignable, plusieurs cases d'approche), on les SCORE par UTILITÉ pondérée
  // (menace, dégâts attendus, killSecure/overkill, contrôle, couverture, positionnement) et on prend
  // l'argmax. Aucune règle inventée : gardes de validité (portée, LdV, canCast/canShoot/inMelee, ZdE,
  // focalisable) IDENTIQUES ; chaque heuristique dérive d'une fonction du moteur.

  // Animosité/Haine ACTIVE (LDB 21 l.22/41) : filtre de VIVIER appliqué AVANT le choix de cible — on
  // s'en prend en priorité au groupe haï présent dans le vivier considéré (sinon vivier brut).
  const hatedCibles = (enemy.psychState ?? [])
    .filter((p) => (p.type === 'animosite' || p.type === 'haine') && p.active && p.cible)
    .map((p) => p.cible!);
  const hatedOf = (pool: Combatant[]) =>
    hatedCibles.length ? pool.filter((h) => hatedCibles.some((cb) => groupMatch(cb, h.groups ?? []))) : [];
  /** Restreint un vivier au groupe haï s'il y en a un présent, sinon le vivier brut. */
  const restrict = (pool: Combatant[]): Combatant[] => { const hp = hatedOf(pool); return hp.length ? hp : pool; };
  /** En Frénésie, la cible est IMPÉRATIVEMENT le plus proche en LdV (LDB 21 l.34) — on contraint le vivier
   *  d'énumération à ce seul héros (le scoring ne peut donc choisir personne d'autre). */
  const frenzyPick = (): Combatant | null => {
    if (!frenzied) return null;
    const visibleFoes = shootableHeroes.length ? shootableHeroes : heroes;
    return visibleFoes.length ? nearest(pos, visibleFoes) : null;
  };

  // --- HEURISTIQUES de SCORE (Lot 3 + escouade Lot 4) -----------------------
  /** FEU CONCENTRÉ via SURNOMBRE (RAW, LDB 14) — MÊME `outnumberMod` et MÊME décompte que la résolution
   *  (`src/state/combatFlow.ts:425`) : N = (alliés de l'escouade à `combatDistance ≤ 1` de la cible) + 1
   *  (l'attaquant lui-même, qui SERA au contact en frappant). Renvoie le `ModLine` du bonus de toucher
   *  (+20 à 2c1, +40 à 3+c1) sous forme d'`env` injecté DANS `expectedDamage` (mêlée UNIQUEMENT — le
   *  surnombre RAW est mêlée-only, cf. combatFlow:425 qui ne sert que `attackEnv` de mêlée). Aucun
   *  modificateur inventé : on réutilise la fonction du moteur. Squad vide → null (pas d'env). */
  const outnumberEnvMelee = (target: Combatant): ModLine[] | undefined => {
    if (squad.length === 0) return undefined;
    const adj = squad.filter((c) => c.pos && combatDistance(c, target) <= 1).length;
    const onm = outnumberMod(adj + 1); // +1 = l'attaquant courant (parité exacte avec combatFlow:425)
    return onm ? [onm] : undefined;
  };

  /** Utilité d'une ATTAQUE (mêlée/tir/sort) sur `target` : dégâts qu'on inflige + menace de la cible
   *  + killSecure − overkill + contrôle. `dmgKind`/`weapon`/`spell` sélectionnent le calcul de dégâts.
   *  En MÊLÉE, le bonus de toucher de SURNOMBRE (feu concentré, Lot 4) est injecté dans l'espérance. */
  const attackUtility = (
    target: Combatant,
    src: { kind: 'melee'; weapon: Weapon } | { kind: 'ranged'; weapon: Weapon; dist: number } | { kind: 'spell'; spell?: SpellLike },
  ): number => {
    const dmg = src.kind === 'spell'
      ? finite(expectedSpellDamage(enemy, target, src.spell), 0)
      : src.kind === 'ranged'
        ? finite(expectedDamage(enemy, target, src.weapon, 'ranged', src.dist), 0)
        : finite(expectedDamage(enemy, target, src.weapon, 'melee', undefined, outnumberEnvMelee(target)), 0);
    const threat = finite(targetThreat(enemy, target), 0);
    const control = src.kind === 'spell' ? controlValue(src.spell) : 0;
    const securesKill = dmg >= target.wounds.current && target.wounds.current > 0 ? Weff.killSecure : 0;
    const overkill = isNeutralized(target) ? Weff.overkill : 0;
    return Weff.damageDealt * dmg + Weff.threat * threat + Weff.control * control + securesKill - overkill;
  };

  /** DANGER-MAP (Lot 4) : Blessures que les HÉROS nous infligeraient si l'on se tenait sur `to` — Σ sur
   *  les héros de l'espérance de LEUR meilleur coup (mêlée/tir) contre l'ennemi POSÉ sur `to` (réutilise
   *  `expectedDamage`, réciprocité, PUR). Un ennemi évite donc les cases exposées (et, blessé, d'autant
   *  plus, puisque la pénalité s'ajoute à un score offensif moindre). Coût borné aux cases candidates ;
   *  les armes des héros sont mémoïsées hors boucle. Squad/heroes vides → 0 (neutre). */
  const heroThreatWeapons = heroes.map((h) => ({
    h, melee: h.weapons?.find((w) => w.type === 'melee'), ranged: h.weapons?.find((w) => w.type === 'ranged'),
  }));
  const dangerAt = (to: Pt): number => {
    const here = { ...enemy, pos: to } as Combatant;
    let total = 0;
    for (const { h, melee, ranged } of heroThreatWeapons) {
      if (!h.pos) continue;
      const dist = chebyshev(to, h.pos);
      const dm = melee ? finite(expectedDamage(h, here, melee, 'melee'), 0) : 0;
      const dr = ranged ? finite(expectedDamage(h, here, ranged, 'ranged', dist), 0) : 0;
      total += Math.max(dm, dr); // le héros joue SON meilleur coup contre nous depuis cette case
    }
    return total;
  };

  /** Bonus de POSITIONNEMENT d'une case d'arrivée `to` pour attaquer `target` (Lot 3) : flanc/dos +
   *  gain de couvert pour soi + respect de la portée préférée (tireur/lanceur reste à distance+LdV ;
   *  mêlée au contact). Lot 4 : − danger-map (cases exposées) + cohésion (ne pas s'isoler de l'escouade). PUR. */
  const isShooterOrCaster = (canCast || canShoot) || (offensiveSpell != null) || (hasRanged && !hasMeleeWeapon);
  const positionValue = (to: Pt, target: Combatant): number => {
    let v = 0;
    // Flanc/dos (LDB 14 l.91) : frapper hors du champ de vision avant de la cible (gratuit). Nécessite
    // l'orientation de la cible (lue de `facing`) ; absente → 0 (graceful).
    const tFacing = facing?.[target.id];
    if (tFacing) {
      const dirToAttacker = facingToward(target.pos!, to);
      if (isFlankOrRear(tFacing, dirToAttacker)) v += Weff.flankRear;
    }
    // Gain de couvert POUR SOI face à la menace la plus proche : un couvert imparfait/moyen/total à
    // l'arrivée réduit les tirs adverses (lineOfSightCover, direction héros→case). Cran gagné vs case actuelle.
    const coverRank = (from: Pt): number => {
      let worst = 0;
      for (const h of heroes) {
        const c = lineOfSightCover(scene, h.pos!, from, [], smoke ?? []);
        const rank = c.cover === 'totale' ? 3 : c.cover === 'moyenne' ? 2 : c.cover === 'imparfaite' ? 1 : 0;
        if (rank > worst) worst = rank;
      }
      return worst;
    };
    const coverDelta = coverRank(to) - coverRank(pos);
    if (coverDelta > 0) v += Weff.coverGain * coverDelta;
    // Portée préférée : un tireur/lanceur valorise une case d'où il TIRE (cible visible + à portée) sans
    // être au contact ; un combattant de mêlée valorise le contact. Réutilise les gates de portée/LdV.
    const d = chebyshev(to, target.pos!);
    const seesFrom = losClear(scene, to, target.pos!, smoke ?? []);
    if (isShooterOrCaster) {
      const inShootRange = canCast
        ? (spellRange == null || d <= spellRange)
        : (maxWeaponRange === 0 || rangeBandModifier(d, maxWeaponRange) != null);
      if (d > mr && seesFrom && inShootRange) v += Weff.preferredRange; // garde la distance ET la ligne de tir
    } else if (withinMelee(to, target.pos!)) {
      v += Weff.preferredRange; // mêlée : au contact
    }
    // ÉVITEMENT du DANGER (Lot 4) : pénalise une case exposée à la menace des héros (danger-map). Calibré
    // < 1 → départage de cases, jamais un veto (l'utilité d'attaque, ×1..12, peut l'emporter et faire avancer).
    if (squad.length || heroes.length) v -= Weff.dangerAvoid * dangerAt(to);
    // COHÉSION légère (Lot 4, SOBRE) : malus si la case isole l'ennemi de TOUTE son escouade (aucun allié
    // à portée de soutien ≤ 3 cases) — préfère rester en formation, à utilité d'attaque égale. Si l'escouade
    // est vide, pas de cohésion (un solitaire ne « s'isole » de personne).
    if (squad.length && !squad.some((c) => c.pos && chebyshev(to, c.pos) <= 3)) v -= Weff.cohesion;
    return v;
  };

  // Meilleure case d'APPROCHE vers une cible — énumère PLUSIEURS cases pertinentes (adjacentes à la
  // cible, et la case qui réduit le plus la distance) plutôt qu'une seule (Lot 3 : laisse le scoring
  // arbitrer position vs distance). Renvoie une liste de candidats `(to, utilité de position)`.
  const approachCandidates = (target: Combatant): { to: Pt; posV: number }[] => {
    const out: { to: Pt; posV: number }[] = [];
    for (const k of reach.keys()) {
      const [x, y] = k.split(',').map(Number);
      if (x === pos.x && y === pos.y) continue; // ne pas « bouger » sur place
      const to = { x, y };
      out.push({ to, posV: positionValue(to, target) });
    }
    return out;
  };

  // --- ÉNUMÉRATION des candidats JOUABLES (Lot 3 : multi-cibles, multi-cases) ----------------
  const candidates: Candidate[] = [];
  const fpick = frenzyPick();

  // ZdE (LDB 47 l.44) : un sort de ZONE castable dont le centre auto-posé couvre ≥2 héros (portée + LdV).
  // Scoré par COUVERTURE (héros touchés) — `aoeCoverage` : bonus par héros au-delà du 1ᵉʳ + contrôle.
  if (!frenzied && areaSpell) {
    const ac = bestAreaCenter(pos, shootableHeroes, areaSpell.radius, areaSpell.range, (pt) => losClear(scene, pos, pt, smoke ?? []));
    if (ac) {
      const aoe = Weff.aoePerExtraHero * (ac.covered - 1); // « − alliés touchés » : pas d'alliés en entrée (Lot 4)
      candidates.push({ action: { kind: 'castArea', spell: areaSpell.spell, center: ac.center }, kind: 'castArea', utility: aoe, targetId: '', coord: ac.center });
    }
  }
  // Focalisation (LDB 46) : sort focalisable + AUCUN sort faisable d'un jet (`!canCast`), sauf menacé au
  // contact avec un repli (arme de mêlée ou tir) — risque d'interruption (l.193). Utilité neutre (0) :
  // c'est un investissement de tour sans dégât immédiat — il ne « gagne » que faute de mieux.
  // `committingPrep` : une action de PRÉPARATION (Focalisation/Recharge) est CHOISIE → on ne lui oppose
  // pas une approche de mêlée (le lanceur/tireur reste en place, comme la cascade historique reload/focus
  // < move). Sans elle, l'approche `move` (utilité de menace > 0) écraserait la prep neutre (régression).
  let committingPrep = false;
  if (!frenzied && focusableSpell && !canCast) {
    const contactFallback = adjacentFoes.length > 0 && (hasMeleeWeapon || canShoot);
    if (!contactFallback) { candidates.push({ action: { kind: 'focus', spell: focusableSpell }, kind: 'focus', utility: 0, targetId: '', coord: null }); committingPrep = true; }
  }
  // Sort offensif mono-cible : UN candidat PAR cible visible/à portée (Lot 3 — multi-cibles), scoré par
  // menace/dégâts/contrôle. Frénésie → seul `fpick`.
  if (canCast) {
    const pool = restrict(fpick ? [fpick].filter((h) => castPool.includes(h)) : castPool);
    for (const t of pool) {
      candidates.push({ action: { kind: 'cast', targetId: t.id, spell: castSpellId! }, kind: 'cast', utility: attackUtility(t, { kind: 'spell', spell: offensiveSpellData }), targetId: t.id, coord: t.pos ?? null });
    }
  }
  // SORTS de SOUTIEN / UTILITAIRE (grimoire NON-dégât : heal/buff/débuff/invocation) — énumérés EN PLUS
  // des candidats offensifs ; le scoring arbitre (un buff redondant/inutile PERD face à une bonne attaque →
  // anti buff-spam + repli attaque). Tout passe par un candidat `cast` résolu par le MÊME `castSpell` (IA =
  // héros). Un FRÉNÉTIQUE ne lance AUCUN sort (Frénésie LDB 21 l.34) → on saute tout le bloc. Le SELF (soi)
  // ne demande pas de portée ; un allié/ennemi est gaté par la portée du sort (cases) et la Ligne de Vue.
  // Aucun nom de sort en dur : la catégorie/cible vient des DONNÉES classées (`supportSpells`).
  const support = input.supportSpells ?? [];
  if (!frenzied && support.length) {
    // Distance de l'ennemi à une cible (empreintes), pour les gates de portée — symétrie avec castPool.
    const inSpellRange = (sp: SupportSpellOpt, t: Combatant): boolean =>
      sp.range == null || fpDist(t) <= sp.range;
    const sees = (t: Combatant): boolean => losClear(scene, pos, t.pos!, smoke ?? []);
    // Alliés vivants posés (escouade) + soi : le vivier de cibles AMIES (soin/buff/invocation s'ancrent ici).
    const selfC = enemy; // soi (auto-buff / invocation centrée sur soi)
    for (const sp of support) {
      if (sp.cat === 'heal') {
        // SOIN : un allié (ou soi) BLESSÉ, à portée + LdV, dont les PB MANQUANTS justifient le soin. Utilité ∝
        // PB réellement récupérables (min(soin, manquants)) → on ne soigne PAS un allié quasi plein (anti-spam
        // naturel : manquants ≈ 0 → utilité ≈ 0, battue par n'importe quelle attaque utile).
        const friends = [selfC, ...squad];
        for (const f of friends) {
          if (!f.pos) continue;
          const missing = Math.max(0, f.wounds.max - f.wounds.current);
          if (missing <= 0) continue; // allié plein → jamais de soin (repli attaque)
          if (f.id !== selfC.id && (!inSpellRange(sp, f) || !sees(f))) continue;
          const recoverable = Math.min(sp.magnitude, missing);
          const u = Weff.healValue * recoverable;
          candidates.push({ action: { kind: 'cast', targetId: f.id, spell: sp.id }, kind: 'cast', utility: u, targetId: f.id, coord: f.pos });
        }
      } else if (sp.cat === 'buffSelf') {
        // BUFF sur SOI : pas si déjà actif (anti-spam via activeEffects). Utilité = magnitude du buff.
        if (!hasActiveSpell(selfC, sp.id)) {
          candidates.push({ action: { kind: 'cast', targetId: selfC.id, spell: sp.id }, kind: 'cast', utility: Weff.buffValue * sp.magnitude, targetId: selfC.id, coord: pos });
        }
      } else if (sp.cat === 'buffAlly') {
        // BUFF sur un ALLIÉ pertinent (à portée + LdV, n'a PAS déjà le buff). On privilégie un allié qui peut
        // AGIR/attaque (a une arme) — proxy simple : tout allié vivant. À soi en repli si aucun allié éligible.
        const friends = [...squad, selfC];
        for (const f of friends) {
          if (!f.pos || hasActiveSpell(f, sp.id)) continue; // déjà buffé → on ne réapplique pas
          if (f.id !== selfC.id && (!inSpellRange(sp, f) || !sees(f))) continue;
          candidates.push({ action: { kind: 'cast', targetId: f.id, spell: sp.id }, kind: 'cast', utility: Weff.buffValue * sp.magnitude, targetId: f.id, coord: f.pos });
        }
      } else if (sp.cat === 'debuff') {
        // DÉBUFF d'un héros : le plus MENAÇANT à portée + LdV qui ne porte PAS déjà tous les États du sort
        // (anti-spam). Utilité = valeur de contrôle de l'État × menace de la cible (priorise le dangereux).
        // VIVIER = héros VISIBLES filtrés par la portée PROPRE du sort de débuff (`inSpellRange(sp,…)`) — PAS
        // `castPool` (filtré par la portée du missile offensif, qui clipperait un débuff de plus longue portée).
        const ctrl = controlValueOf(sp.condNames) || sp.magnitude;
        const pool = restrict(fpick ? [fpick] : shootableHeroes).filter((h) => inSpellRange(sp, h) && sees(h) && !alreadyDebuffed(h, sp.condNames ?? []));
        for (const h of pool) {
          const u = Weff.debuffValue * ctrl * (1 + 0.1 * finite(targetThreat(enemy, h), 0));
          candidates.push({ action: { kind: 'cast', targetId: h.id, spell: sp.id }, kind: 'cast', utility: u, targetId: h.id, coord: h.pos ?? null });
        }
      } else if (sp.cat === 'summon') {
        // INVOCATION (sur soi/zone — résolue par castSpell self) : SOBRE et anti-boucle. Utilité ∝ nb de
        // créatures, MAJORÉE par l'INFÉRIORITÉ numérique (ratio héros/alliés) — on renforce ses rangs quand
        // on est en sous-nombre. PLAFOND anti-spam : si l'IA a DÉJÀ nettement plus d'alliés que de héros
        // (escouade+soi ≥ 1,5× héros), l'invocation ne vaut rien (on n'empile pas une armée).
        const allies = squad.length + 1; // + soi
        const foes = Math.max(1, heroes.length);
        // INFÉRIORITÉ STRICTE seulement (foes > allies) : à parité/supériorité, invoquer ne vaut rien (on
        // ne renforce pas une armée déjà suffisante — anti-boucle d'invocation). Le facteur = l'AMPLEUR du
        // sous-nombre (foes/allies − 1), borné, → plus on est débordé, plus l'invocation pèse.
        const outnumberedFactor = Math.max(0, foes / allies - 1);
        const u = Weff.summonValue * sp.magnitude * outnumberedFactor;
        if (u > 0) {
          candidates.push({ action: { kind: 'cast', targetId: selfC.id, spell: sp.id }, kind: 'cast', utility: u, targetId: selfC.id, coord: pos });
        }
      }
      // `other` (utilitaire non décisif) : pas de candidat dédié — repli attaque (jamais de boucle de sort
      // inutile). Le sort reste « visible » via le plan, mais l'IA ne le joue pas faute de gain mesurable.
    }
  }

  // Recharger (LDB 63 l.28-29) : arme à Recharge déchargée + cible en vue/portée, sauf attaque de mêlée
  // justifiée. Utilité neutre (préparation) — préféré seulement faute de tir/mêlée meilleurs. Un
  // frénétique NE recharge PAS (Frénésie LDB 21 l.34 : seule Action = Test de CC/Athlétisme → mêlée).
  if (!frenzied && reloadNeeded && shootPool.length > 0 && !(adjacentFoes.length > 0 && hasMeleeWeapon)) {
    candidates.push({ action: { kind: 'reload' }, kind: 'reload', utility: 0, targetId: '', coord: null });
    committingPrep = true; // un tireur recharge sur place plutôt que de foncer en mêlée
  }
  // Tir (hors Combat rapproché, cible visible) : UN candidat PAR cible tirable (Lot 3 — multi-cibles).
  if (canShoot && rangedW) {
    const pool = restrict(fpick ? [fpick].filter((h) => shootPool.includes(h)) : shootPool);
    for (const t of pool) {
      candidates.push({ action: { kind: 'shoot', targetId: t.id }, kind: 'shoot', utility: attackUtility(t, { kind: 'ranged', weapon: rangedW, dist: fpDist(t) }), targetId: t.id, coord: t.pos ?? null });
    }
  }
  // Mêlée / approche : énumère un candidat de MÊLÉE par cible déjà au contact ET un candidat d'APPROCHE
  // (move) par cible atteignable ce tour (Lot 3). La cible suit le vivier (tireur retenu au contact frappe
  // l'adversaire à son contact ; sinon vivier complet). Un sort/tir jouable PRIME (parité historique : la
  // cascade ne propose alors jamais de mêlée/move) — on ne produit ces candidats que si `!canCast && !canShoot`.
  const meleeWeapon = enemy.weapons.find((w) => w.type === 'melee') ?? enemy.weapons[0];
  if (!canCast && !canShoot && !committingPrep) {
    const heldInMelee = hasRanged && adjacentFoes.length > 0;
    const here = heldInMelee ? adjacentFoes : heroes.filter(meleeReachableNow);
    const baseVivier = here.length ? here : heroes;
    const vivier = restrict(fpick ? [fpick] : baseVivier);
    // Estimation d'attaque pour scorer une cible (utilité d'arme de mêlée si on en a une, sinon menace
    // seule — un caster hors de portée qui s'approche n'a pas de dégât d'arme mais score la menace/fragilité).
    const targetUtility = (t: Combatant): number =>
      meleeWeapon ? attackUtility(t, { kind: 'melee', weapon: meleeWeapon }) : (Weff.threat * finite(targetThreat(enemy, t), 0) - (isNeutralized(t) ? Weff.overkill : 0));
    for (const t of vivier) {
      if (hasMeleeWeapon && meleeWeapon && inMelee(t)) {
        // Cible déjà au contact → frappe (position déjà acquise, pas de bonus de déplacement).
        candidates.push({ action: { kind: 'melee', targetId: t.id }, kind: 'melee', utility: attackUtility(t, { kind: 'melee', weapon: meleeWeapon }), targetId: t.id, coord: t.pos ?? null });
      } else {
        // Cible non au contact (ou sans arme de mêlée — caster qui doit se rapprocher) → candidats
        // d'APPROCHE : utilité = utilité d'attaque de la cible + positionnement de la case − distance résiduelle.
        const atk = targetUtility(t);
        for (const { to, posV } of approachCandidates(t)) {
          const u = atk + posV - Weff.approachDist * manhattan(to, t.pos!);
          candidates.push({ action: { kind: 'move', to, thenTargetId: t.id }, kind: 'move', utility: u, targetId: t.id, coord: to });
        }
      }
    }
  }

  // --- ARGMAX : meilleur candidat (utilité pondérée + tie-break déterministe) ----------------
  const chosen = argmax(candidates);
  if (chosen) return chosen.action;

  // Aucun candidat jouable : un Empêtré (Mouvement nul, LDB 16 l.85) se libère plutôt que perdre son
  // tour (Test opposé de Force contre la source, l.61). Sinon, passe la main.
  if (hasCondition(enemy, 'empetre')) return { kind: 'recover', state: 'empetre' };
  return { kind: 'end' };
}
