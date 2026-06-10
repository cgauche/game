/**
 * Types des jets/flux DIFFÉRÉS du store (« un jet = une modale ») + récompenses de victoire et
 * monnaie — types PURS, sans logique, extraits de store.ts pour le garder navigable.
 * Le store les ré-exporte (les imports existants `from './store'` restent valides).
 */
import type { Difficulty, HitLocation, Weapon } from '../engine/types';
import type { Effect } from './scene';
import type { TestResult, OpposedResult } from '../engine/tests';
import type { AttackResult } from '../engine/combat';
import type { CriticalResolved } from '../engine/critical';
import type { OupsResolved } from '../engine/oups';
import type { CastResult, MissileResult, FocusResult } from '../engine/magic';
import type { HealMode } from '../engine/healing';
import type { PsychType } from '../engine/psychology';

export interface Money {
  gold: number;
  silver: number;
  brass: number;
}
/** Récompenses capturées à la victoire (pour l'écran de fin de combat) : XP de groupe gagnée, or récupéré,
 *  butin (noms d'objets, dans l'inventaire de groupe, assignables à un héros), ennemis vaincus (groupés). */
export interface PendingVictory {
  xp: number;
  gold: Money;
  loot: string[];
  defeated: { name: string; count: number }[];
  /** Messages de journal de la victoire (Effets `journal` de onVictory) — affichés DANS l'écran (#9). */
  messages?: string[];
  /** Effets DIFFÉRÉS au clic « Continuer » (téléport/dialogue/combat) — sinon ils masquent l'écran (#9). */
  onContinue?: Effect[];
}
/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorId: string;
  actorName: string;
  label: string;
  skillValue: number;
  difficulty: Difficulty;
  requireSL: number;
  target: number;
  /** Malus psy de Sociabilité de l'acteur (Animosité −20 / Préjugé −10 envers l'interlocuteur, LDB 21) —
   *  déjà intégré à `skillValue`/`target` ; conservé pour l'affichage en modale. */
  psychMod?: number;
  /** Libellé lisible du malus psy social (« Animosité −20 envers Elfe ») pour la modale de Test. */
  psychDetail?: string;
  /** Outil utilisé (uid résolu sur l'acteur) : sa qualité d'artisanat module l'issue / casse l'objet (Phase C2a). */
  itemUid?: string;
  /** Jet double (Maladresse si en plus c'est un échec) — pour casser un outil Bâclé hors combat. */
  isDouble?: boolean;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Réussite forcée par Résilience AVANT le jet (LDB 17 l.73) : affichage « garanti », sans dé. */
  forced?: boolean;
  /** Relance par Chance déjà effectuée (LDB ch.12 l.56 : 1 relance max par Test). */
  rerolled?: boolean;
  onSuccess?: Effect[];
  onFailure?: Effect[];
}
/** Rechargement en attente (LDB 63-Armures l.28-29 : Test étendu de Projectiles, Indice DR).
 *  La modale affiche « Lancer », le DR, puis Chance avant d'acquitter (cumul vers `reload`). */
export interface PendingReload {
  actorId: string;
  actorName: string;
  weaponName: string;
  reload: number; // Indice DR cible
  progressBefore: number; // DR déjà cumulés (Test étendu)
  skillValue: number; // combatValue(active, 'ranged')
  difficulty: Difficulty; // 'intermediaire' (le canon ne spécifie pas → défaut)
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  target: number; // cible effective après difficulté
  sl: number; // DR du jet
  success: boolean;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}
/** « Se libérer » / « se rouler au sol » en attente (LDB 16 l.61 Empêtré / l.77 En flammes) :
 *  une Action pour retirer l'État via un Test ; succès ⇒ 1 + DR pions retirés. Empêtré = Test OPPOSÉ
 *  de Force contre la source ; En flammes = Test d'Athlétisme simple. Modale Lancer → DR → Chance. */
export interface PendingStateRecovery {
  actorId: string;
  actorName: string;
  state: 'Empêtré' | 'En flammes';
  skillLabel: string; // 'Force' | 'Athlétisme'
  skillValue: number;
  difficulty: Difficulty;
  /** Empêtré avec une source vivante → Test opposé ; sinon Test simple. */
  opposed: boolean;
  opponentValue?: number; // Force de la source (Empêtré opposé)
  opponentName?: string;
  stacks: number; // pions présents (max retirables)
  /** Jet de l'acteur ; null tant que pas lancé (Chance possible ensuite). */
  roll: TestResult | null;
  /** Jet de la source, figé au 1ᵉʳ lancer (les relances Chance ne re-roulent que l'acteur). */
  opponentRoll: TestResult | null;
  netSL: number; // DR net (après opposition le cas échéant)
  success: boolean;
  rerolled?: boolean;
}
/** Marchandage en attente (LDB 60 l.12) : Test OPPOSÉ Marchandage (joueur) vs Marchandage (marchand).
 *  La modale affiche « Lancer » (2 jets), puis le verdict + Chance ; gagner réduit le prix de 10 %
 *  (20 % avec Succès Stupéfiant DR≥6 ou le talent Négociateur). 1 jet verrouillé par visite. */
export interface PendingBargain {
  playerId: string;
  playerName: string;
  merchantName: string;
  merchantValue: number; // valeur Marchandage du marchand (opposant)
  playerSkill: number; // valeur Marchandage du meilleur négociateur du groupe
  mode: 'buy' | 'sell';
  /** Le négociateur possède-t-il le talent Négociateur (−20 % même sans Succès Stupéfiant) ? */
  negotiator: boolean;
  /** Jet du joueur ; null tant que pas lancé (Chance possible ensuite). */
  roll: TestResult | null;
  /** Jet du marchand, figé au 1ᵉʳ lancer (les relances Chance ne re-roulent que le joueur). */
  merchantRoll: TestResult | null;
  /** Résultat opposé (joueur = attaquant). */
  result: OpposedResult | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}
/** Évaluation en attente (LDB 60 l.10 : « estimer les prix … à ±10 % »). Test d'Évaluation (Int) ;
 *  un succès RÉVÈLE l'objet (`identified = true`, ses qualités cachées deviennent visibles) et donne
 *  une fourchette de prix. La modale affiche « Lancer », le résultat puis Chance avant d'acquitter. */
export interface PendingAppraise {
  actorId: string;
  actorName: string;
  itemUid: string;
  itemName: string;
  truePriceBrass: number; // valeur réelle de base (catalogue) en sous de cuivre
  availability: string | null; // Disponibilité (Rare/Exotique → estimation ±10 %)
  skillValue: number;
  difficulty: Difficulty;
  target: number;
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}
/** Attaque en attente : la modale affiche « Lancer », puis le résultat + Chance. */
export interface PendingAttack {
  attackerId: string;
  targetId: string;
  location: HitLocation | null;
  /** Arme choisie pour cette attaque (uid d'ItemInstance du loadout actif) ; absent = auto-choix. */
  weaponUid?: string;
  result: AttackResult | null; // null = pas encore lancé
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  fromCharge?: boolean; // issue d'une Charge → l'attaque est OBLIGATOIRE (LDB 15-Dépl l.75), Annuler interdit
  /** Victime réelle si le tir a dévié dans la mêlée vers un allié (LDB 14 l.136) — sinon = targetId. */
  victimId?: string;
  /** Attaque d'enchaînement d'un balayage (Frappe Mortelle) : son acquittement fait avancer le `pendingCleave`. */
  cleave?: boolean;
  /** « Tirer dans le tas » (LDB 14 l.136/146) : option de tir — bonus selon la taille du groupe, mais
   *  un combattant au contact de la cible (les DEUX camps, tir fratricide possible) est touché au hasard ;
   *  0 DR si le succès est dû au seul bonus. */
  intoCrowd?: boolean;
  /** Tir IMMOBILE (option de tir) : le héros décide de ne pas bouger ce Tour → annule la pénalité −10 « Tir
   *  en bougeant » (LDB 14 l.101) MAIS consomme son Mouvement (cf. attackConfirm). Proposé seulement s'il
   *  n'a pas déjà bougé. */
  heldGround?: boolean;
  /** Réussite FORCÉE via « Je ne faillirai pas ! » (Résilience, LDB 17 l.73) : débloque, sur un Coup
   *  Critique, le choix de la Localisation (cf. `critLocation` du résultat). */
  forced?: boolean;
  /** Attaque-Action en mode « des deux armes » (main directrice) : chaîne une 2ᵉ frappe si elle touche (LDB 10 l.638). */
  dualMode?: boolean;
  /** Cette attaque EST la 2ᵉ frappe (off-hand) d'un Maniement de deux armes : jet imposé, pas de relance. */
  dualSecond?: boolean;
}
/** Balayage en attente (Frappe Mortelle d'un HÉROS plus grand, LDB 14 l.12 / 85 l.299) : après une
 *  touche de mêlée, le joueur enchaîne sur d'autres adversaires adjacents (jusqu'à BCC), via le flux
 *  `pendingAttack` standard. `count` = enchaînements déjà résolus ; `hitIds` = cibles déjà frappées ce balayage. */
export interface PendingCleave {
  attackerId: string;
  hitIds: string[];
  count: number;
}
/** Sélection de la 2ᵉ cible du Maniement de deux armes (LDB 10 l.638), après une 1ʳᵉ frappe RÉUSSIE.
 *  Calqué sur PendingCleave : le joueur clique une cible (ou renonce via `dualStrikeSkip`). `mainRoll` = jet
 *  conservé de la 1ʳᵉ frappe ; `critValue` = valeur du tableau des Critiques si la 1ʳᵉ était un Critique.
 *  Avantage : +1 UNIQUE accordé si les DEUX frappes touchent (l.638) — son existence prouve que la 1ʳᵉ a touché. */
export interface PendingDualStrike {
  attackerId: string;
  offWeaponUid: string;
  mainRoll: number;
  critValue?: number;
}
/** Piétinement en attente (LDB 85 l.320-321) : modale interactive — Lancer (resolveTrample) →
 *  Chance → Appliquer (dépense 1 Avantage, action gratuite). */
export interface PendingTrample {
  attackerId: string;
  targetId: string;
  result: AttackResult | null; // null = pas encore lancé
  rerolled?: boolean;
}
/** Course en attente (LDB 15-Déplacement l.79-82) : Test d'Athlétisme (+20) ; succès → déplacement
 *  étendu (Marche + Course + DR). Lancer → Chance/Résilience → Appliquer (ouvre le déplacement étendu). */
export interface PendingRun {
  combatantId: string;
  /** `target` absent sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; dr: number; bonusCases: number } | null;
  rerolled?: boolean;
}
/** Focalisation en attente (LDB — Test étendu) : Lancer (resolveFocus) → Chance → Appliquer (cumule le DR). */
export interface PendingFocus {
  casterId: string;
  spellLabel: string;
  result: FocusResult | null;
  rerolled?: boolean;
}
/** Test de Psychologie (Calme) en attente d'un HÉROS (LDB 21) : Peur (Test étendu) ou Terreur (1ʳᵉ
 *  rencontre). Lancer → Chance → Appliquer. */
export interface PendingPsych {
  combatantId: string;
  kind: PsychType;
  sourceId: string;
  indice: number;
  prevDR: number;
  /** Trait CIBLÉ : groupe-Cible visé (Animosité (Elfes)…). Absent pour Peur/Terreur. */
  cible?: string;
  result: { roll: number; target?: number; sl?: number; dr?: number; calmeDR?: number; vaincue?: boolean; success?: boolean; brise?: number; devientPeur?: number } | null;
  rerolled?: boolean;
}
/** Entrée en Frénésie en attente (LDB 21 l.32) : Test de FM. Lancer → Chance → Appliquer (entre si succès). */
export interface PendingFrenzy {
  combatantId: string;
  /** `target`/`sl` absents sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; sl?: number } | null;
  rerolled?: boolean;
}
/** Entrée de la file de RÉVÉLATION témoin : un jet SUBI / sur table / d'entretien dont le résultat
 *  (graine fixe) est montré au joueur après coup — il MONTRE le dé puis acquitte (pas de Chance). */
export interface RevealEntry {
  kind: 'miscast' | 'critical' | 'assommante' | 'backstab' | 'calme' | 'round';
  title: string;
  dice?: number; // d100/d10 à afficher (le jet), si pertinent
  lines: string[]; // détail (résultat, effets)
  /** Combattant CONCERNÉ par la révélation (victime du critique, lanceur de la Colère…) → portrait
   *  + nom dans la modale (« on sait toujours à qui ça s'applique »). Absent pour les entretiens de Round. */
  subjectId?: string;
  /** Auteur du coup (Coup Critique « infligé PAR ») → portrait + nom dans la modale (qui → arme → cible). */
  actorId?: string;
  /** Arme employée (Coup Critique). */
  weapon?: string;
  /** Effets détaillés (table des Critiques) AVEC leur explication RAW — pour qu'on sache « à quoi ça
   *  correspond » (plus de simple texte gris). */
  details?: { text: string; note?: string }[];
  /** Données du Coup Critique pour une modale COMPLÈTE : localisation (FR), Blessures infligées (ignore
   *  Endurance + Armure), États appliqués. */
  crit?: { location: string; woundsLost: number; conditions?: { name: string; value: number }[] };
}
/** Maladresse d'un HÉROS (LDB 14 — Tableau des Oups !) : son Test de combat a échoué sur un double.
 *  Flux modale : Lancer (rollOups → result) → Appliquer (applyOups). Pas de Chance (elle agit AVANT). */
export interface PendingFumble {
  combatantId: string;
  weapon: Weapon; // arme utilisée (pour Dégâts d'arme / Incident de Tir)
  result: OupsResolved | null; // null = pas encore lancé sur le Tableau des Oups !
  /** Vrai si la Maladresse survient pendant une défense réactive : reprendre le tour de l'IA après Appliquer. */
  resumeAfter?: boolean;
}
/** Déviation Critique en attente (LDB 63 l.63-66) : un HÉROS a subi un Coup Critique à une
 *  localisation où il porte de la PA ; il choisit Dévier (sacrifie 1 PA, ignore le Critique mais
 *  subit les Blessures recalculées PA−1) ou Subir (prend le Critique). `res`/`weapon` sont figés
 *  pour rejouer `applyAttackResult` avec la décision (une seule application, cf. combatFlow). */
export interface PendingDeviation {
  attackerId: string;
  targetId: string; // héros qui subit le Critique (= la cible réelle, victime d'un tir dévié comprise)
  weapon: Weapon;
  res: AttackResult;
  /** Coup Critique PRÉ-TIRÉ (graine figée) : affiché sur la modale ET appliqué tel quel sur « Subir »
   *  (pas de re-tirage → ce qu'on montre = ce qu'on subit). La déviation survit même à un Critique létal. */
  crit: CriticalResolved;
  /** Révélation du Critique (riche : qui → arme → victime, dé, localisation, Blessures, États, effets)
   *  rendue DANS la modale de déviation — plus de modale de Critique séparée. */
  reveal: RevealEntry;
  /** Reprendre le tour de l'IA après application (toujours vrai ici : la déviation survient pendant le tour ennemi). */
  resumeAfter: boolean;
}
/** Défense réactive : un ennemi (IA) a figé son jet d'attaque (`atk`) contre un héros ;
 *  le joueur choisit le mode, lance SA défense (`def`), peut la relancer (Chance = défense
 *  uniquement), puis applique. `atk` est figé et n'est JAMAIS relancé. Le tour de l'IA est
 *  suspendu tant que `pendingDefense` est non-null. */
export interface PendingDefense {
  attackerId: string; // ennemi
  defenderId: string; // héros
  weapon: Weapon; // arme active de l'attaquant, figée
  location: HitLocation | null; // visée par l'IA (aucune pour l'instant → null)
  atk: TestResult; // jet d'attaque figé (rollMeleeAttacker)
  mode: 'parade' | 'esquive'; // réaction choisie (défaut = bestDefenseMode)
  /** Arme de parade choisie (uid d'ItemInstance) ; absent = main principale (weapons[0]). */
  parryWeaponUid?: string;
  def: TestResult | null; // null = pas encore défendu ; écrasé par Chance
  result: AttackResult | null; // calculé par finishMelee après « Défendre »
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  /** Attaque GRATUITE de créature (Morsure/Caudale/Piétinement) : ne consomme pas l'Action, applique
   *  ses effets RAW et enchaîne la file au resolve (cf. aiCreatureFreeAttacks). */
  free?: boolean;
  freeKind?: string;
  prevActed?: boolean;
}
/** Désengagement en attente (LDB 15-Dépl l.84-109) : un MENU de choix (phase 'choice') —
 *  Sacrifier l'Avantage / Esquiver / Fuir / Renoncer — puis le Test d'Esquive (phase 'esquive'). */
export interface PendingDisengage {
  moverId: string; // héros qui se désengage (actif)
  foeId: string; // adversaire de référence (meilleure CC) pour l'Esquive et la Fuite
  canSacrifice: boolean; // Avantage > tous les foes Engagés → option « Sacrifier l'Avantage » dispo
  /** Esquive/Fuite disponibles ? Faux si l'Action est déjà dépensée (elles la coûtent) → seule
   *  l'option A « Sacrifier l'Avantage » reste, ce qui évite la boucle infinie d'Esquive. */
  canEsquive?: boolean;
  phase: 'choice' | 'esquive'; // 'choice' = menu d'options ; 'esquive' = Test d'Esquive en cours
  atk: TestResult | null; // Esquive : jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // Esquive : jet d'Esquive du mover
  result: 'success' | 'failure' | 'tie' | null; // 'tie' = égalité parfaite du Test opposé → statu quo
  /** Relance par Chance de l'Esquive déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Incantation en attente : flux par modale (sélection → « Lancer » jet figé → Chance → appliquer),
 *  comme l'attaque. Tous les jets méritent leur modale. */
export interface PendingCast {
  casterId: string;
  targetId: string;
  spellLabel: string;
  /** Projectile magique (résolution façon attaque) vs autre sort / prière. */
  missile: boolean;
  /** Sort focalisé à NI 0 (consommé à l'application). */
  focused: boolean;
  /** Résultat figé du jet d'incantation (null = pas encore lancé). */
  result: (CastResult & Partial<MissileResult>) | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Soin de Guérison en attente (LDB 09-Compétences) : flux modale — « Lancer » (healRoll) → Chance
 *  (relance / +1 DR) → Résilience → « Appliquer » (healConfirm). Soigneur/cible résolus par `actorIn`
 *  (combat ⇄ groupe, cf. combatOrParty). `intBonus` figé à l'ouverture. */
export interface PendingHeal {
  healerId: string;
  healerName: string;
  targetId: string;
  targetName: string;
  mode: HealMode; // 'wounds' | 'bleed'
  intBonus: number; // Bonus d'Intelligence du soigneur
  skillValue: number; // testValue(soigneur, 'Guérison')
  difficulty: Difficulty; // 'intermediaire' (+0, LDB 09 l.243)
  target: number; // cible effective (affichage)
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR
  rerolled?: boolean;
  /** Soin par un PNJ (médecin payant) : héros éligibles parmi lesquels le JOUEUR choisit la cible
   *  (>1 → sélecteur dans la modale). Absent = cible déjà fixée (auto-soin du groupe via la fiche). */
  candidateIds?: string[];
  /** CHIRURGIE = Test ÉTENDU de Guérison (LDB 10 l.154 / 12 l.200) : on cumule le DR de passe en passe
   *  jusqu'à `surgeryTargetDR` (cible 5-10, MJ) ; `surgeryCumDR` = total courant (repart à 0 s'il passe
   *  sous 0, LDB 12 l.200). CHAQUE passe inflige 1d10 PB + 1 Hémorragie. `surgeryTraumaIdx` = quelle
   *  Blessure Critique opérer (choix du joueur). Présents seulement en mode 'surgery'. */
  surgeryTargetDR?: number;
  surgeryCumDR?: number;
  surgeryTraumaIdx?: number;
}
