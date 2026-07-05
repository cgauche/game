/**
 * Types des jets/flux DIFFÉRÉS du store + récompenses de victoire et
 * monnaie — types PURS, sans logique, extraits de store.ts pour le garder navigable.
 * Le store les ré-exporte (les imports existants `from './store'` restent valides).
 */
import type { CharKey, Difficulty, HitLocation, Weapon, FireArc, Combatant } from '../engine/types';
import type { ConjureForm } from '../engine/conjuredWeapons';
import type { Pt } from './path';
import type { Dir8 } from './dir8';
import type { Effect } from './scene';
import type { Flow } from './flow';
import type { GameOp } from '../engine/ops';
import type { TestResult, OpposedResult } from '../engine/tests';
import type { AttackResult, DefenseMode, RollBreakdown } from '../engine/combat';
import type { AttackKind } from '../engine/creatureAttacks';
import type { CriticalResolved } from '../engine/critical';
import type { OupsResolved } from '../engine/oups';
import type { CastResult, MissileResult, FocusResult, CounterspellOutcome } from '../engine/magic';
import type { HealMode } from '../engine/healing';
import type { PsychType } from '../engine/psychology';
import type { RollParticipant, MultiPending, PendingBase } from './rollFlowFactory';
import type { Money } from '../engine/money';
import type { CrewRoleRoll } from './shipManeuver';

export type { Money };
/** Une ligne de butin d'équipement (giveTrapping) ATTRIBUABLE par portrait — partagée entre
 *  l'écran de victoire et la fenêtre de loot (fouille/Test/dialogue). `magic` = qualités cachées
 *  ou ajoutées (✨, révélables par Évaluation). L'Effet d'origine est conservé tel quel. */
export interface LootGear {
  label: string;
  magic: boolean;
  effect: Extract<Effect, { type: 'giveTrapping' }>;
}
/** Butin HORS victoire (fouille d'un décor, branche de Test, dialogue…) : fenêtre d'attribution
 *  « qui l'emporte ? » — même brique que l'écran de victoire. `gold` est DÉJÀ crédité à la bourse
 *  (affichage), `messages` = textes d'ambiance (Effets `journal` du même lot). */
export interface PendingLoot {
  title: string;
  messages?: string[];
  gold?: Money;
  gear: LootGear[];
}
/** Reconstitution DIFFÉRÉE programmée à la mort (Gardien éternel) : à l'échéance d'un `ScheduledEffect`,
 *  ré-invoque la créature `summon.ref` près de `caster.pos`, dans le camp de `caster.kind`
 *  (cf. `summonFlow.applySummon`). `caster` est un INSTANTANÉ minimal du défunt — les seuls champs lus
 *  par `applySummon` (id/name/kind/pos). */
export interface ScheduledRespawn {
  caster: { id: string; name: string; kind: Combatant['kind']; pos: Pt };
  summon: { ref: string; count: number; allyOfCaster?: boolean };
}
/** Entrée de la file d'effets PROGRAMMÉS (runtime, Lot 0), déclenchée quand l'horloge atteint `executeAt`
 *  (minute absolue `gameTime`), sauf si `cancelFlag` a été posé entre-temps. Deux charges possibles : un
 *  `flow` (minuterie `delayedEffect` : exécuté via runFlow → branches/Test possibles) OU un `respawn`
 *  (reconstitution d'une créature à la mort — résolu par `applySummon`). */
export interface ScheduledEffect {
  executeAt: number;
  flow?: Flow;
  cancelFlag?: string;
  respawn?: ScheduledRespawn;
}
/** Récompenses capturées à la victoire (pour l'écran de fin de combat) : XP de groupe gagnée, or récupéré,
 *  butin (noms d'objets, dans l'inventaire de groupe, assignables à un héros), ennemis vaincus (groupés). */
export interface PendingVictory {
  xp: number;
  gold: Money;
  /** Équipement (giveTrapping) du butin — ATTRIBUABLE par portrait sur l'écran (qualités/skin
   *  conservés), au lieu d'aller d'office au 1er héros. Non attribué → 1er héros à la fermeture. */
  gear?: LootGear[];
  defeated: { name: string; count: number; creatureId?: string }[];
  /** Créatures déjà récoltées (« Précieuses Entrailles », ZI) sur cet écran — grise le bouton (par id). */
  harvested?: string[];
  /** Messages de journal de la victoire (Effets `journal` de onVictory) — affichés DANS l'écran (#9). */
  messages?: string[];
  /** Effets DIFFÉRÉS au clic « Continuer » (téléport/dialogue/combat) — sinon ils masquent l'écran (#9). */
  onContinue?: Effect[];
  /** COOP (spec §4bis) : ✓ de chaque siège — l'écran est synchronisé, l'hôte ferme à l'unanimité. */
  readyBySeat?: Record<number, boolean>;
}
/** Test de compétence interactif en attente d'acquittement par le joueur. */
export interface PendingTest {
  actorId: string;
  actorName: string;
  /** Intitulé de la SITUATION (« Esquiver les piques de la dalle ») → titre de la modale. */
  label: string;
  /** Compétence/Caractéristique RÉELLE testée (« Athlétisme », « Dextérité ») → libellé du cadre de
   *  jet (RollLine), comme « Calme » pour la Psychologie. À défaut, on retombe sur `label`. */
  skill?: string;
  /** Réf STRUCTURÉE du Test (≠ `skill` libellé d'affichage) : id de Compétence + spec, ou Caractéristique —
   *  lue par `talentTestSLBonus` (LDB 10 : +DR de Talent par id, plus de match par libellé). Threadée du
   *  `FlowTest` (skill/spec/characteristic) au build du pending. */
  skillId?: string;
  spec?: string;
  char?: CharKey;
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
  /** Membres du GROUPE pouvant tenter ce Test (le défaut `actorId` = le meilleur) — le joueur CHOISIT
   *  qui lance via `testSetActor` (au lieu d'une désignation automatique). Chaque entrée porte sa
   *  valeur/cible/malus, pour re-cibler le Test sans recalcul. Absent/≤1 → pas de choix. */
  candidates?: { id: string; name: string; value: number; target: number; psychMod?: number; psychDetail?: string; itemUid?: string }[];
  /** Rempli après « Lancer » ; null tant que le jet n'a pas eu lieu (Chance possible ensuite). */
  roll: number | null;
  success: boolean;
  sl: number;
  /** Réussite forcée par Résilience AVANT le jet (LDB 17 l.73) : affichage « garanti », sans dé. */
  forced?: boolean;
  /** Relance par Chance déjà effectuée (LDB ch.12 l.56 : 1 relance max par Test). */
  rerolled?: boolean;
  /** Branches du Test : des FLOWS (le nœud `test` du Flow ; `Effect.test` y est normalisé). */
  onSuccess?: Flow;
  onFailure?: Flow;
  /** Continuation : le Flow à reprendre APRÈS la branche (suite du `seq` parent d'un nœud `test`). */
  after?: Flow;
  /** Action de COMBAT « cumuler l'Avantage » (LDB 09 l.305-308 : Intuition/Savoir/Survie/Prière) : sur
   *  RÉUSSITE, octroie +1 Avantage au combattant `combatantId`, plafonné à `cap` (= Bonus de la
   *  Caractéristique — Int pour Intuition/Savoir/Survie, Soc pour Prière). Appliqué par `resolveTest`
   *  (via `gainAdvantage`, qui respecte AUSSI le plafond général d'Avantage). Consomme l'Action, réussi
   *  ou non (« Chaque Round que vous passez à… »). Absent = Test ordinaire. */
  combatAdvantage?: { combatantId: string; cap: number };
  /** Test initié en COMBAT (Cumuler l'Avantage…) : annulable pré-jet (« Annuler » referme la cascade ;
   *  l'Action n'est pas encore dépensée, rien à rembourser). Absent = test de dialogue/scène → NON
   *  annulable (la branche onSuccess/onFailure doit se résoudre). */
  cancellable?: boolean;
}
/** Rechargement en attente (LDB 63-Armures l.28-29 : Test étendu de Projectiles, Indice DR).
 *  La modale affiche « Lancer », le DR, puis Chance avant d'acquitter (cumul vers `reload`). */
export interface PendingReload {
  actorId: string;
  actorName: string;
  weaponUid: string; // arme de rechargement (loadout) — résolue en NOM à l'affichage
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
  /** Recharge d'un POSTE de navire (MDG ch.12) : la pièce visée (`ShipPoste.item.uid`) + sa coque (`shipId`).
   *  Présents → l'application écrit le DR cumulé sur le POSTE (pas le champ `loaded` du marin) et occupe son équipage. */
  posteUid?: string;
  shipId?: string;
  /** Soutien générique (LDB 12) déjà FONDU dans `skillValue` : nb de servants assistants + bonus total (affichage). */
  soutien?: { count: number; bonus: number };
}
/** « Se libérer » / « se rouler au sol » en attente (LDB 16 l.61 Empêtré / l.77 En flammes) :
 *  une Action pour retirer l'État via un Test ; succès ⇒ 1 + DR pions retirés. Empêtré = Test OPPOSÉ
 *  de Force contre la source ; En flammes = Test d'Athlétisme simple. Modale Lancer → DR → Chance. */
export interface PendingStateRecovery {
  actorId: string;
  actorName: string;
  state: 'empetre' | 'en-flammes';
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
/** Évaluation en attente (LDB 60 l.10 : « estimer les prix … à ±10 % ») — Test d'Évaluation (Int) ;
 *  un succès RÉVÈLE l'objet (`identified = true`, ses qualités cachées deviennent visibles) et donne
 *  une fourchette de prix. OU Détection d'artefact (`mode:'detect'`, LDB 10 l.310-312) — Test
 *  d'Intuition au toucher : succès = l'objet est senti MAGIQUE, chaque DR apprend une règle (qualité) ;
 *  une seule tentative par artefact. Même modale (« Lancer », résultat, Chance, acquittement). */
export interface PendingAppraise {
  actorId: string;
  actorName: string;
  /** Objet d'un héros (uid d'inventaire)… */
  itemUid?: string;
  /** …ou ligne de butin ENCORE en fenêtre (loot/victoire) — révélation AVANT attribution. */
  gear?: { scope: 'loot' | 'victory'; index: number };
  itemName: string;
  /** 'evaluate' (défaut) = Évaluation marchande ; 'detect' = Détection d'artefact (Intuition). */
  mode?: 'evaluate' | 'detect';
  /** Libellé de la compétence affiché en modale (« Évaluation » / « Intuition »). */
  skillLabel?: string;
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
  fromCharge?: boolean; // issue d'une Charge → l'attaque est engagée dès le 1ᵉʳ jet (LDB 15-Dépl l.75)
  /** Undo PRÉ-JET d'une Charge (jeu vidéo : annuler un misclic comme on annule un déplacement/une attaque) :
   *  état d'AVANT la charge pour restaurer positions/orientation/Mouvement/Avantage/chargedThisTurn si on
   *  Annule AVANT tout jet (`result === null`). Une fois le dé lancé, la charge est engagée (RAW). Capturé à
   *  la déclaration de charge (targetingModes), rejoué par `attackCancel`. */
  chargeUndo?: { pos: Record<string, Pt>; facing: Record<string, Dir8>; movedPreAction: boolean; movementUsed: number; advGained: number; gainedAdvBefore: boolean; chargedBefore: boolean };
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
  /** « Retenir ses coups » (Aux Armes l.2503-2505) : déclaré AVANT le jet — maîtriser sans tuer. En
   *  MÊLÉE seulement, jamais avec une arme *En flammes*. Le moteur (`applyHit`) ignore le drapeau hors
   *  mêlée ; il retire Empaleuse/Percutante/Perforante + l'Atout Taille et supprime le Critique sauf mise à 0. */
  withhold?: boolean;
  /** « Empoignade » (LDB 14 l.159) : déclarée AVANT le lancer pour toucher — sur une touche, « au lieu
   *  d'infliger des Dégâts », pose l'Empoignade (les deux) + l'État *Empêtré* (cible), sans Dégâts. MAINS
   *  NUES seulement (cf. `applyAttackResult(..., grapple)`). */
  grapple?: boolean;
  /** Attaque-Action en mode « des deux armes » (main directrice) : chaîne une 2ᵉ frappe si elle touche (LDB 10 l.638). */
  dualMode?: boolean;
  /** Cette attaque EST la 2ᵉ frappe (off-hand) d'un Maniement de deux armes : jet imposé, pas de relance. */
  dualSecond?: boolean;
  /** Attaque GRATUITE de MANŒUVRE de mêlée (Morsure/Attaque caudale/Tentacules — trait de créature
   *  qu'un héros active : mutation/polymorphie) : ne consomme pas l'Action ; effets onHit propres à la
   *  manœuvre appliqués à la confirmation (cf. attackConfirm). `tentacules` = limiteur 1/tour (mutation). */
  freeKind?: AttackKind;
  /** PILONNAGE INDIRECT (« viser une case », AA p.122-123) : POINT D'IMPACT choisi au sol. Présent → la
   *  touche DÉTONE sur cette case (Explosion/Tir de zone uniforme sur le rayon, RAW LDB p.298), AUCUNE touche
   *  directe « primaire » ni Critique par victime ; `targetId` n'est que la cible-REPÈRE de la bande de
   *  portée/du DR (l'ennemi le plus proche de l'impact). Absent → tir direct (STRICTEMENT inchangé). */
  center?: Pt;
  /** Marqueur de pilonnage indirect (cf. `center`) — `attackConfirm` résout l'aire au lieu d'une touche directe. */
  siege?: boolean;
}
/** Pilonnage INDIRECT EN COURS (« viser une case », AA p.122-123) : une pièce indirecte SERVIE attend le
 *  POINT D'IMPACT au sol — placeur de zone PARTAGÉ (`placingZoneOf` source 'siege', même gabarit que les
 *  sorts de zone). Le clic-case → `siegeAimCommit` ouvre la modale de tir (`pendingAttack` siège). */
export interface PendingSiegeAim {
  gunnerId: string;
  /** uid de l'arme de la pièce servie (canon ÉPINGLÉ) — re-dérivée par `firedWeapon` à la résolution. */
  weaponUid: string;
  /** Rayon de l'aire (Explosion/Tir de zone) en CASES — gabarit du placeur (`blastRadiusTiles`). */
  radius: number;
  /** Portée chiffrée (cases) du placeur depuis le servant — `null` = pas de cap dur (la bande de portée du
   *  Test de tir gère l'éloignement) ; seule la Ligne de Vue au point est requise (`placedZoneValidAt`). */
  rangeTiles: number | null;
}
/** Balayage en attente (Frappe Mortelle d'un HÉROS plus grand, LDB 14 l.12 / 85 l.299) : après une
 *  touche de mêlée, le joueur enchaîne sur d'autres adversaires adjacents (jusqu'à BCC), via le flux
 *  `pendingAttack` standard. `count` = enchaînements déjà résolus ; `hitIds` = cibles déjà frappées ce balayage. */
export interface PendingCleave {
  attackerId: string;
  hitIds: string[];
  count: number;
  /** Mode Frappe Mortelle (option, hors Taille) : la poursuite EXIGE de tuer chaque cible (LDB 14
   *  l.9). Absent/false = balayage de Taille (enchaîne sur une simple touche, LDB 85 l.299). */
  fm?: boolean;
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
  /** Réussite forcée par Résilience (LDB 17 l.73) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
}
/** Battement en attente (LDB 10 l.103 / AA l.4361) : Action, Test de Corps à corps NON opposé.
 *  Modale MONO calquée sur `PendingTrample` — Lancer (jet de CC figé) → Chance/Pacte/Résilience →
 *  Appliquer (`resolveBattement` retire de l'Avantage adverse). Consomme l'Action. */
export interface PendingBattement {
  attackerId: string;
  foeId: string;
  result: TestResult | null; // jet de Corps à corps de l'attaquant ; null = pas encore lancé
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.73) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
}
/** Distraire en attente (LDB 10 l.364 / AA l.4395) : Mouvement, Test OPPOSÉ Athlétisme (mover) vs
 *  Calme (foe). Modale OPPOSÉE calquée sur `PendingDisengage`/`PendingAuContact` : le jet de Calme du
 *  foe (`defRoll`) est FIGÉ à l'ouverture ; seul le jet d'Athlétisme du mover (`atk`) se (re)joue.
 *  Sur victoire, `resolveDistraire` pose `distractedRounds`. Consomme le MOUVEMENT (pas l'Action). */
export interface PendingDistraire {
  moverId: string; // héros qui distrait (actif)
  foeId: string; // adversaire distrait
  atk: TestResult | null; // jet d'Athlétisme du mover (mover = « attaquant » du Test opposé) — null = pas lancé
  defRoll: TestResult; // jet de Calme du foe, figé à l'ouverture (jamais relancé)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = le mover l'emporte ; 'tie' = statu quo
  /** Relance par Chance de l'Athlétisme déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.73) → l'emporte simplement (issue binaire). */
  forced?: boolean;
}
/** Manœuvre de créature en attente (Souffle/Vomi/Langue/Regard/Étreinte — LDB 85) qu'un héros active.
 *  La modale n'influence QUE le jet de l'attaquant (`result` : son TestResult CC/CT figé) ; l'apply
 *  (`applyMan<X>`) roule les défenseurs et résout l'opposition dans le feed. `avantageSpent` = Avantage
 *  dépensé (Regard variable : choisi 1..advantage → +N DR). Hurlement n'ouvre PAS de pending (pas de
 *  jet d'attaquant). */
export interface PendingManeuver {
  attackerId: string;
  kind: AttackKind;
  /** Cible DÉSIGNÉE au clic (victime pour Langue/Regard/Étreinte ; point d'impact de la zone pour
   *  Souffle/Vomi — LDB 85 « choisit une cible visible »). Absent côté IA (cible auto la plus proche). */
  targetId?: string;
  /** Avantage dépensé (coût RAW ; Regard : choisi par le joueur, +1 DR/Av — LDB 85 l.238). */
  avantageSpent: number;
  result: TestResult | null; // null = pas encore lancé
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.73). */
  forced?: boolean;
}
/** Course en attente (LDB 15-Déplacement l.79-82) : Test d'Athlétisme (+20) ; succès → déplacement
 *  étendu (Marche + Course + DR). Lancer → Chance/Résilience → Appliquer (ouvre le déplacement étendu). */
export interface PendingRun {
  combatantId: string;
  /** Destination demandée (clic dans la zone de Course) : à l'application, on avance le long du chemin
   *  jusqu'au dernier point que le budget du jet (Marche + Course + DR) permet. */
  dest?: Pt;
  /** `target` absent sur un résultat synthétique (Résilience pré-jet) — la RollLine retombe sur la base. */
  result: { success: boolean; roll: number; target?: number; dr: number; bonusCases: number } | null;
  rerolled?: boolean;
}
/** Un contributeur au Test d'équipage de MANŒUVRE (MDG ch.14) : un marin à un rôle, son jet propre. PJ →
 *  interactif (Chance/Résilience sur SON jet) ; marin PNJ → témoin (`interactive:false`, auto-roulé à l'ouverture). */
export interface ShipManeuverParticipant extends RollParticipant {
  /** Rôle tenu (crew-roles.json) — sa meilleure compétence décide la valeur du jet. */
  roleId: string;
  /** Rôle ESSENTIEL du Test (son DR compte double, MDG ch.14 l.19). */
  essential: boolean;
  /** Marin déjà engagé dans un AUTRE Test d'équipage ce Round → cumul à +2 crans de Difficulté (Manque de bras, l.53). */
  cumul?: boolean;
  result: CrewRoleRoll | null;
}
/** Contributeur ARTILLEUR d'un Tir de batterie (MDG ch.14) — MÊME forme qu'un rôle de manœuvre (un rôle,
 *  son DR) : alias du contributeur de Test d'équipage (une seule structure pour les 3 flux jumeaux). */
export type ShipBatteryParticipant = ShipManeuverParticipant;
/** TIR DE BATTERIE en Test d'équipage (MDG ch.14 l.128) : les Artilleurs lancent, DR sommés (essentiel ×2) + Moral →
 *  un **DR PARTAGÉ** qui remplace le jet de touche de chaque pièce du bord `side` qui porte sur `targetId`. */
export interface PendingShipBattery extends MultiPending<ShipBatteryParticipant> {
  shipId: string;
  targetId: string;
  /** Bord qui porte (dérivé de la cible via `targetArc`) — détermine les pièces qui tirent. */
  side: FireArc;
  essentialRoleId?: string;
  moraleScore: number;
  /** Manque de bras global (MDG ch.14 l.55) : −2 DR/tranche de 10 % manquant + plafond Succès Minime. */
  undercrew?: { dr: number; capSuccesMinime: boolean };
  /** Sabotage (MDG ch.14 l.45-47) : −1..−5 DR plats au total du Test d'équipage (`shipSaboteurDR`). */
  extraDR?: number;
}
/** Manœuvre navale en TEST D'ÉQUIPAGE (MDG ch.13-14) : chaque rôle tenu lance son Test, les DR sont sommés (rôle
 *  essentiel ×2) + la bande de Moral ; le total tient lieu de DR de Navigation. La direction (`turnSteps`, choisie
 *  au pré-jet OptionChooser) s'applique à la confirmation (`shipManeuverConfirm`). */
export interface PendingShipManeuver extends MultiPending<ShipManeuverParticipant> {
  shipId: string;
  /** Virage choisi : >0 tribord, <0 bâbord, 0 tout droit (crans d'octant — ±1 = 45°, ±2 = 90°). */
  turnSteps: number;
  /** id du rôle essentiel (DR ×2) — lu du type de Test 'manoeuvre'. */
  essentialRoleId?: string;
  /** Moral du navire → bande ±DR au total (MDG ch.14). */
  moraleScore: number;
  /** Manque de bras global (MDG ch.14 l.55) : −2 DR/tranche de 10 % manquant + plafond Succès Minime. */
  undercrew?: { dr: number; capSuccesMinime: boolean };
  /** Sabotage (MDG ch.14 l.45-47) : −1..−5 DR plats au total du Test d'équipage (`shipSaboteurDR`). */
  extraDR?: number;
}
/** TEST D'ÉQUIPAGE GÉNÉRIQUE en combat (MDG ch.14, « Types de Test d'équipage ») — 3ᵉ jumeau de la
 *  manœuvre/bordée : chaque rôle tenu lance SON Test (multi-jets), DR sommés (essentiel ×2) + Moral +
 *  Manque de bras + sabotage. L'ISSUE dépend du type (`crewTestConfirm`) : **Rude épreuve** (l.106-114)
 *  → un total NÉGATIF réduit le Moral d'autant (l.110), PERSISTÉ sur `CampaignVessel.morale`. Les types
 *  de NAVIGATION/VOYAGE (Progression, Poursuite, Perception, Orientation…) réutiliseront CE pending (7b). */
export interface PendingCrewTest extends MultiPending<ShipManeuverParticipant> {
  shipId: string;
  /** Type de Test d'équipage (`crew-test-types.json`) — décide des rôles, du rôle essentiel et de l'issue. */
  testTypeId: string;
  essentialRoleId?: string;
  moraleScore: number;
  undercrew?: { dr: number; capSuccesMinime: boolean };
  extraDR?: number;
  /** Test d'équipage de VOYAGE maritime (7b — hors combat) : `kind` = l'issue à résoudre
   *  (`seaVoyageFlow.resolveVoyageCrewTest`), `shipName` = affichage (la coque vit dans
   *  `travelPlan.vehicle`, pas dans une bataille). Absent = Test de COMBAT (chemin historique). */
  voyage?: { kind: string; shipName: string };
}
/** CHANSON DE MARIN en attente (Talent, MDG 09 l.32-40) : le chanteur choisit sa chanson CONNUE (pré-jet,
 *  OptionChooser — specs du Talent) puis lance son Test de **Divertissement (Chant)** ; sur un succès,
 *  l'effet (`crewOps`/`captainOps` de `sea-shanties.json`) est posé sur TOUT l'équipage pour
 *  « trois minutes plus un nombre de minutes égal au DR » (l.38). Une chanson par QUART (l.40). */
export interface PendingShanty {
  shipId: string;
  singerId: string;
  /** Chanson choisie (id `sea-shanties.json`) — null tant que le chanteur n'a pas choisi (pré-jet). */
  shantyId: string | null;
  result: { roll: number; target: number; success: boolean; sl: number } | null;
  rerolled?: boolean;
  forced?: boolean;
}
/** Approche d'une source de PEUR (LDB 21 l.29 : « incapable de vous rapprocher … à moins de réussir un
 *  Test de Calme Intermédiaire (+0) ») : le clic d'approche est DIFFÉRÉ derrière ce Test sec. Succès →
 *  l'intention est relancée (approches libres ce Tour) ; échec → aucune approche ce Tour (battle.fearGate). */
export interface PendingApproach {
  combatantId: string;
  /** Source de Peur la plus proche dont le déplacement RAPPROCHE. */
  sourceId: string;
  /** Intention différée, relancée après un succès. */
  intent: { kind: 'tile'; pt: Pt } | { kind: 'entity'; id: string };
  result: { success: boolean; roll: number; target?: number; sl: number } | null;
  rerolled?: boolean;
}
/** Bénédiction de Protection (LDB 41 l.105 : « Les ennemis doivent effectuer un Test de Force Mentale
 *  Accessible (+20) pour attaquer votre cible […]. Sur un échec, ils doivent choisir une cible ou une
 *  Action différente. ») : la DÉCLARATION d'attaque d'un héros sur une cible bénie est DIFFÉRÉE derrière
 *  ce Test de FM. Succès → l'attaque est relancée (`battleClickEntity(targetId, {confirm, wardCleared})`) ;
 *  échec → l'attaque n'a pas lieu (rien n'est consommé). Modelé sur `PendingApproach` (gate pré-attaque). */
export interface PendingWard {
  attackerId: string;
  /** Cible bénie (porte le drapeau `attackWardFM`). */
  targetId: string;
  result: { success: boolean; roll: number; target?: number; sl: number } | null;
  rerolled?: boolean;
}
/** Focalisation en attente (LDB — Test étendu) : Lancer (resolveFocus) → Chance → Appliquer (cumule le DR). */
export interface PendingFocus {
  casterId: string;
  spellId: string;
  result: FocusResult | null;
  rerolled?: boolean;
}
/** Dissipation permanente en attente (LDB 46 l.204-207 : Test étendu de Langue (Magick) → NI). Un Round =
 *  un jet (Lancer → Chance → Appliquer) ; le DR cumule sur `caster.dispel` jusqu'au NI. Le Soutien « même
 *  Domaine » (l.207) est déjà fondu dans `value`. Calque `PendingFocus`. */
export interface PendingDispel {
  casterId: string;
  /** Sort DURABLE visé (id + son lanceur), pour retirer ses effets à la réussite (`dissipateSpell`). */
  spellId: string;
  spellCasterId: string;
  label: string;
  ni: number; // NI du sort = DR cumulé cible
  value: number; // valeur de Langue (Magick) du lanceur, Soutien « même Domaine » inclus
  support?: { count: number; bonus: number }; // détail du Soutien (affichage)
  result: { roll: number; target: number; sl: number; success: boolean } | null;
  rerolled?: boolean;
}
// Psychologie de COMBAT (Peur/Terreur/Traits ciblés, LDB 21) : CASCADE de Round — étapes
//  `kind:'combatPsych'` (cf. CascadeStep.combatPsych) ; Traits/Terreur au DÉBUT de Round, Peur
//  (Test étendu) à la FIN.
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
  kind: 'miscast' | 'critical' | 'assommante' | 'backstab' | 'calme' | 'round' | 'mutation' | 'effet' | 'sceneEntry';
  title: string;
  dice?: number; // d100/d10 à afficher (le jet), si pertinent
  lines: string[]; // détail (résultat, effets)
  /** Gravité pour l'AUTO-FERMETURE (arbitrage 2026-06-11) : 'minor' = informative courte (3-4 s
   *  — entretien, interruptions…), 'grave' = critique/mutation sur un héros (9 s AVEC barre de
   *  temps visible). Un clic ferme toujours avant. Absent = pas d'auto-fermeture. */
  severity?: 'minor' | 'grave';
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
/** Exposition à une Influence corruptrice (LDB 19 l.23-75) : Test de Résistance (Influence
 *  physique) ou de Calme (spirituelle), Intermédiaire (+0) ; Points de Corruption selon le
 *  niveau et le DR (mineure 0/1 · modérée 0/1/2 · majeure 0/1/2/3). Lancer → Chance
 *  (+1 DR utile : les seuils de DR réduisent le gain) → Appliquer (gainCorruption). */
export interface PendingCorruption {
  heroId: string;
  /** 'exposition' (défaut — LDB 19 l.23-75 : Test pour ne pas GAGNER de Points) ou
   *  'seuil' (l.80 : Test de Résistance au franchissement — échec → « Je te renie ! »/mutation). */
  kind?: 'exposition' | 'seuil';
  /** Niveau d'exposition — EXPOSITION seulement (absent au seuil). */
  level?: import('../engine/corruption').ExposureLevel;
  skill: 'resistance' | 'calme'; // skillId stable (libellé dérivé par refLabel à l'affichage)
  /** Compétence déterminée en amont (source ou seuil) → pas de choix joueur. Absent/false = nature
   *  indéterminée (LDB 19 l.26) → la modale propose Résistance/Calme (cf. `corruptionSetSkill`). */
  skillLocked?: boolean;
  /** Alignement de la SOURCE (Puissance du Chaos) posé par l'éditeur de niveau → table EDOC à tirer
   *  si une mutation survient (sinon la règle globale décide). Voyage exposition → seuil → mutation. */
  align?: import('../engine/corruption').ChaosAlign;
  roll?: number;
  target?: number;
  sl?: number;
  success?: boolean;
  rerolled?: boolean;
  /** Menace du talent « Résistance (Menace) » (LDB 10) couverte par CE Test : 'Corruption' (exposition,
   *  l.23-75 — résister au GAIN de Points) ou 'Mutation' (seuil, l.80 — l'échec fait MUTER). Posé à
   *  l'ouverture ; offre l'auto-succès via `corruptionResist`. */
  menace?: string;
}
/** Contexte d'un Critique (qui l'inflige + l'arme/sort en libellé) — modale enrichie + B. de Sauvagerie.
 *  Forme identique au `ctx` d'`applyCriticalToTarget` : source UNIQUE du type. */
export interface DeviationCtx {
  attackerId?: string;
  attackerKind?: Combatant['kind'];
  weapon?: string;
  critTwice?: boolean;
}

/** Déviation Critique en attente (LDB 63 l.30) : une victime a subi une Blessure Critique — Coup
 *  Critique sur double OU dépassement — à une localisation où elle porte de la PA ; elle choisit
 *  Dévier (sacrifie 1 PA, ignore le Critique, subit les Blessures recalculées PA−1) ou Subir.
 *  Union discriminée par `mode` :
 *  - `melee` : `res`/`weapon` figés → le résolveur REJOUE `applyAttackResult` avec la décision (son
 *    « tail » décision-indépendant — riposte/triggers/ammo… — tourne ainsi une seule fois).
 *  - `self` : auto-contenu (opposé/tir/magie n'ont pas de tail) → le résolveur applique directement
 *    déflexion vs Critique pré-tiré, sans rejouer aucune attaque.
 *  Le Critique PRÉ-TIRÉ (`crit`, graine figée) est affiché sur la modale ET appliqué tel quel sur Subir. */
export type PendingDeviation =
  | {
      mode: 'melee';
      attackerId: string;
      targetId: string; // victime du Critique (cible réelle, y compris un tir dévié)
      weapon: Weapon;
      res: AttackResult;
      crit: CriticalResolved;
      reveal: RevealEntry;
      resumeAfter: boolean;
    }
  | {
      mode: 'self';
      attackerId: string;
      targetId: string;
      location: HitLocation; // loc du Critique : re-tirée pour un double, loc de touche pour un dépassement
      crit: CriticalResolved;
      isCoupCritique: boolean; // double (true) vs dépassement (false) → applique le bon Critique au Subir
      overkill: number; // dépassement (−20 à la table si > BE, LDB 18 l.30)
      deflectExtraWounds: number; // Blessures ajoutées au Dévier (recalcul PA−1 ; 0 pour un critique « sec »)
      woundsBefore: number; // PB avant CE coup → restauration Destin correcte au Subir
      reveal: RevealEntry;
      resumeAfter: boolean;
      ctx: DeviationCtx;
    };
/** « Je te renie ! » (LDB 17 l.71) : le héros a échoué au Test de Résistance du seuil de Corruption —
 *  il choisit entre SUBIR la mutation et la REFUSER (1 Point de Résilience ; il ne perd alors aucun
 *  Point de Corruption). */
export interface PendingRenounce {
  heroId: string;
  /** Jet du Test de Résistance raté (affichage). */
  testRoll: number;
  testTarget: number;
  /** Alignement de la source (cf. PendingCorruption.align) — table EDOC si la mutation est subie. */
  align?: import('../engine/corruption').ChaosAlign;
}
/** Piège-lame (LDB 62 l.292-294) : le HÉROS défenseur a obtenu un Critique en parant avec une arme
 *  Piège-lame face à une arme à lame — il choisit entre le Coup Critique normal (LDB 14 l.7) et
 *  PIÉGER la lame (Test opposé de Force + DR de la défense ; victoire → désarme, Stupéfiant → brise
 *  sauf Incassable, échec → l'adversaire se libère). */
export interface PendingBladeTrap {
  defenderId: string; // le héros piégeur
  attackerId: string; // l'adversaire dont la lame est visée
  weapon: Weapon; // la lame de l'attaquant
  parryWeaponUid: string; // l'arme Piège-lame du défenseur — résolue en NOM à l'affichage
  /** DR du Test de Corps à corps (défense) — ajouté au Test opposé de Force (l.293). */
  defSL: number;
  /** d100 du jet de défense critique (localisation du Coup Critique si refusé). */
  roll: number;
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
  mode: DefenseMode; // réaction choisie (défaut = bestDefenseMode) ; 'social' = substitution sociale (mêlée)
  /** Arme de parade choisie (uid d'ItemInstance) ; absent = main principale (weapons[0]). */
  parryWeaponUid?: string;
  /** Substitution sociale (`mode:'social'`, LDB 09 l.207/287) : id de la Compétence substituée à Corps
   *  à corps (Intimidation/Dressage), figé au choix de l'option. Sa valeur de Test est re-dérivée à
   *  l'affichage/résolution (`skillBaseValue`) — le gate `fear` n'est vérifié qu'à l'OFFRE de l'option. */
  substituteSkillId?: string;
  /** TIR défendu (RAW LDB 14 l.62/70, 62 l.307) : modes de réaction AUTORISÉS — limite le segmented
   *  control de la modale (ex. Esquive seule à Bout Portant, Parade seule avec bouclier Protectrice 2+).
   *  Absent = mêlée (Parade/Esquive libres). `distanceTiles` sert au breakdown Projectiles (finishRanged). */
  modes?: ('parade' | 'esquive')[];
  distanceTiles?: number;
  def: TestResult | null; // null = pas encore défendu ; écrasé par Chance
  result: AttackResult | null; // calculé par finishMelee après « Défendre »
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  /** Défense forcée par Résilience (LDB 17 l.73) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
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
  phase: 'choice' | 'esquive' | 'fuir'; // 'choice' = menu ; 'esquive' = Test d'Esquive ; 'fuir' = coup dans le dos SUBI + Test de Calme influençable
  atk: TestResult | null; // Esquive : jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // Esquive : jet d'Esquive du mover
  result: 'success' | 'failure' | 'tie' | null; // 'tie' = égalité parfaite du Test opposé → statu quo
  /** « Fuir » (l.98-109) : coup dans le dos SUBI (montré INLINE). Sur un coup qui touche, le Test de
   *  Calme du fuyard (`calme`) est un jet INFLUENÇABLE (flux `flee`, calqué sur `approach`) résolu DANS
   *  la modale ; le Brisé et la libération/Course sont DIFFÉRÉS au confirm (`fleeConfirm`). `calme: null`
   *  = pas (encore) de Test (coup manqué → fuite déjà complétée ; ou en attente du « Lancer »). `detail`
   *  = breakdown COMPLET du coup dans le dos (`AttackResult.attackerDetail`) → rangée témoin `RollRow`
   *  (portrait + cible/dé/DR), homogène à l'Esquive (fini la ligne compacte `TableRollLine`). */
  fuir?: { attackerRoll: number; hit: boolean; woundsLost: number; detail?: RollBreakdown; calme: { success: boolean; roll: number; target?: number; sl: number } | null };
  /** Relance par Chance de l'Esquive déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** « Au Contact » en attente (LDB 62 l.176, Option « Longueur d'arme », règle `combat-weapon-reach`) :
 *  Test opposé de Corps à corps `mover` vs `foe` pour entrer dans la longueur d'arme. Le VAINQUEUR
 *  choisit « combat normal » (retire l'état au contact) ou « au contact » (le pose). Calque
 *  `PendingDisengage` : le jet du foe (`atk`) est figé, seul le jet du mover (`def`, Corps à corps)
 *  se (re)joue. `phase 'roll'` = Test opposé influençable ; `phase 'choice'` = le vainqueur HÉROS
 *  tranche (un foe IA tranche par heuristique, sans phase de choix montrée). */
export interface PendingAuContact {
  moverId: string; // héros initiateur (actif)
  foeId: string; // adversaire ciblé (Engagé en mêlée)
  phase: 'roll' | 'choice';
  atk: TestResult | null; // jet de Corps à corps du foe, figé (jamais relancé)
  def: TestResult | null; // jet de Corps à corps du mover (influençable)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = le mover (héros) l'emporte ; 'tie' = statu quo
  /** Relance par Chance du jet du mover déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Action d'Empoignade en attente (LDB 14 l.161) : Test opposé de FORCE `actor` vs `foe` pour son
 *  Action, OU « Briser » (gratuit) si Avantage supérieur. Calque `PendingAuContact` : le jet de Force du
 *  foe (`atk`) est figé, seul le jet de l'acteur (`def`) se (re)joue. `phase 'roll'` = Test opposé
 *  influençable (+ bouton « Briser » si `canBreak`) ; `phase 'options'` = le vainqueur choisit Dégâts /
 *  Empêtrer l'adversaire / Se libérer (LDB 14 l.161). */
export interface PendingGrapple {
  actorId: string; // celui qui agit (Empoigné, à son tour)
  foeId: string; // l'autre Empoigné
  phase: 'roll' | 'options';
  canBreak: boolean; // Avantage STRICTEMENT supérieur → peut Briser l'Empoignade gratuitement
  atk: TestResult | null; // jet de Force du foe, figé (jamais relancé)
  def: TestResult | null; // jet de Force de l'acteur (influençable)
  result: 'success' | 'failure' | 'tie' | null; // 'success' = l'acteur l'emporte ; 'tie' = statu quo
  /** Relance par Chance du jet de l'acteur déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
}

/** Incantation en attente : flux par modale (sélection → « Lancer » jet figé → Chance → appliquer),
 *  comme l'attaque. Tous les jets méritent leur modale. */
export interface PendingCast {
  casterId: string;
  targetId: string;
  spellId: string;
  /** Projectile magique (résolution façon attaque) vs autre sort / prière. */
  missile: boolean;
  /** Sort focalisé à NI 0 (consommé à l'application). */
  focused: boolean;
  /** Résultat figé du jet d'incantation (null = pas encore lancé). */
  result: (CastResult & Partial<MissileResult>) | null;
  /** Relance par Chance déjà effectuée (1 max/Test, LDB ch.12 l.56). */
  rerolled?: boolean;
  /** Incantation forcée par Résilience (LDB 17 l.73) → le joueur peut CHOISIR la valeur du dé. */
  forced?: boolean;
  /** « Prêchez, ma sœur ! » (LDB 40 l.40-42, option `prayer-conviction`) : Prière entonnée
   *  DISCRÈTEMENT / sans conviction (murmurée) → Difficulté d'un cran plus dure (`discreetPrayerDifficulty`).
   *  Ne concerne que les Prières ; absent/faux = à voix haute (Intermédiaire, RAW). */
  discreet?: boolean;
  /** Incantation CRITIQUE (LDB 46 l.52-59) : choix du lanceur — Blessure Critique
   *  (Projectile à Dégâts) / Puissance totale (lancé quel que soit le NI, dissipable) /
   *  Force inéluctable (indissipable). Défaut auto à l'application. */
  critChoice?: 'critique' | 'puissance' | 'ineluctable';
  /** Forme choisie pour une arme invoquée à forme libre (Arme aethyrique, op `grantWeapon` +
   *  `chooseForm`) — le lanceur sélectionne la Compétence de Corps à corps/profil d'arme. Défaut
   *  (absent) : sa meilleure Spé de Corps à corps. */
  conjureForm?: ConjureForm;
  /** Surincantation : nombre de PAS alloués à chaque axe (chaque pas = +2 DR du surplus). L'effet
   *  d'UN pas est SOURCE-AWARE (`engine/overcast.ts`) — Sort/Miracle : +valeur initiale (×initial,
   *  LDB 47 l.13-17 / 42 l.7-13) ; Bénédiction : +6 m Portée / +1 Cible / +6 Rounds (FIXE, LDB 41
   *  l.21-27, pas de ZdE). `range`/`zone`/`duration` étendent Portée/gabarit/durée ; `targets` débloque
   *  des cibles SUPPLÉMENTAIRES (`extraTargetIds`, capacité = `extraTargetCapacity`). */
  overcast?: { range: number; zone: number; duration: number; targets: number };
  extraTargetIds?: string[];
  /** Choix des cibles supplémentaires EN COURS sur le champ de bataille : la modale s'efface
   *  (bandeau TargetPrompt + clic carte → castToggleExtraTarget), « Valider » la restaure. */
  pickingTargets?: boolean;
  /** Sort à Zone d'Effet (LDB 47 l.44) — flux « jet PUIS pose » : la modale s'ouvre SANS cible
   *  (`center: null`, `targetId` = ancre lanceur), le jet et la Surincantation (+Zone via `r0m`,
   *  rayon initial en mètres) précèdent la pose ; `placing` = choix de la case en cours sur la
   *  carte (la modale s'efface). À la pose : tous les combattants dans `radius` (cases,
   *  Chebyshev) sont visés par le MÊME jet. */
  zone?: { center: { x: number; y: number } | null; radius: number; r0m?: number; placing?: boolean;
    /** ZdE d'un lanceur IA : CENTRE auto-choisi par l'IA pure (sur un paquet de héros, `ai.ts`
     *  `castArea.center`), MÉMORISÉ tant que `center` reste null. C'est l'ÉQUIVALENT du curseur souris
     *  d'un héros : `castConfirm` (chemin PARTAGÉ) le lit pour poser la zone tout seul quand le lanceur
     *  est `aiDriven` — exactement comme l'auto-combat fournit `castRoll`/`castConfirm`. La pose vit ainsi
     *  dans le `castConfirm` UNIQUE (gardée par `aiDriven`), pas dans un chemin spécial de Contre-sort.
     *  Absent = pose joueur classique (attend le clic réel). */
    autoCenter?: { x: number; y: number } };
  /** Lancé DEPUIS le grimoire porté (sort non mémorisé de son Domaine, LDB 47 l.34) :
   *  le NI est DOUBLÉ à la résolution (et le livre s'expose aux dégâts/au vol — narratif). */
  grimoire?: boolean;
  /** OPPOSITION de la cible RÉSOLUE (issue figée du flux `castOpposition`) : par cible, indique si
   *  le Sort a été RÉSISTÉ et la MARGE de DR (écart) pour les échelles `perSL`. Lu par `applyCast`
   *  qui saute les ops d'une cible résistante et passe la marge en `ctx.sl`. */
  opposedOutcome?: Record<string, { resisted: boolean; margin: number }>;
}

/** Un héros qui tente le Contre-sort : participant du flux MULTI (son propre jet + influence). */
export interface CounterParticipant extends RollParticipant {
  /** Résultat du Test opposé de Langue (Magick) de CE héros, ou null = pas encore lancé. */
  result: CounterspellOutcome | null;
}
/** Contre-sort à PLUSIEURS (Dissipation, LDB 46 l.201-202/207 : chaque dissipateur lance SÉPARÉMENT)
 *  — flux multi-participants « réaction type défense ». Le jet d'incantation ENNEMI vit dans
 *  `pendingCast` (figé, suspend l'IA) ; ce pending ne porte QUE les héros contre-lanceurs, chacun
 *  opposant son Langue (Magick) avec son propre cycle Chance/+1 DR/Pacte/Résilience. L'application
 *  réutilise `castConfirm` (issue agrégée : dissipé si UN gagne ; sinon le sort se résout au meilleur
 *  DR net). « Laisser passer » = aucun Contre-sort → le sort se résout tel quel. */
export type PendingCounterspell = MultiPending<CounterParticipant>;

/** Issue du Test d'OPPOSITION d'UNE cible contre l'incantation figée (résist FM/Int ou contact Bagarre). */
export interface OppositionOutcome {
  /** Le Test opposé de la cible (FM / Intelligence / Corps à corps (Bagarre)). */
  oppose: TestResult;
  /** La cible l'emporte → le Sort est RÉSISTÉ. */
  resisted: boolean;
  /** Marge de DR (incantation − opposition) quand le LANCEUR l'emporte (échelle `perSL` des ops). */
  margin: number;
}
/** Une cible qui OPPOSE son Test à l'incantation : participant du flux MULTI (son jet + influence). */
export interface OppositionParticipant extends RollParticipant {
  result: OppositionOutcome | null;
}
/** Le Sort déclare une OPPOSITION (`spec.opposed`) : chaque cible oppose son Test (FM/Int/Bagarre) à
 *  l'incantation FIGÉE (`pendingCast.result`), avec son propre cycle Chance/Pacte/Résilience. L'agrégat
 *  (`oppositionConfirm`) écrit `pendingCast.opposedOutcome` par cible, puis `castConfirm` applique
 *  (cible résistante → aucune op ; sinon ops à la marge). « Réaction type défense » : cible IA = rangée
 *  témoin (jet auto + révélée dans la modale) ; cible héros = rangée interactive. */
export interface PendingCastOpposition extends MultiPending<OppositionParticipant> {
  kind: 'resist' | 'contact';
  skill?: string;
  char?: CharKey;
}

/** Un Round d'un Test Étendu : le jet de CE Round (slot du flux multi SÉQUENTIEL). */
export interface ExtendedTestRound extends RollParticipant {
  result: { roll: number; sl: number; success: boolean } | null;
}
/** Un héros qui frappe la porte : participant du flux MULTI PARALLÈLE (son propre jet + dégâts). */
export interface ForceDoorParticipant extends RollParticipant {
  /** Jet de Corps à corps (Bagarre) de CE héros + dégâts infligés à la porte, ou null = pas lancé. */
  result: { roll: number; target: number; sl: number; damage: number } | null;
}
/** Enfoncer une porte À PLUSIEURS (EDO Appendice 2, « Portes ») — flux multi PARALLÈLE : la porte est
 *  un OBJET (BE = Bonus d'Endurance, B = Blessures). Chaque héros frappe INDÉPENDAMMENT (Test de
 *  Corps à corps (Bagarre)), dégâts = max(0, DR + Bonus de Force − BE) — objets : PAS de minimum 1
 *  (l.92). Chacun son cycle Chance/+1 DR/Pacte/Résilience. La porte cède quand B ≤ 0 ; sinon un
 *  nouveau Round s'ouvre (chacun re-frappe). Hors combat comme en combat (acteurs via `actorIn`). */
export interface PendingForceDoor extends MultiPending<ForceDoorParticipant> {
  label: string; // « Porte de la cave »
  doorBE: number; // Bonus d'Endurance de l'objet
  doorB: number; // Blessures restantes (cède à ≤ 0)
  doorBmax: number; // Blessures initiales (jauge)
  /** Flag de scène posé quand la porte cède (ouverture en jeu) — optionnel. */
  flag?: string;
}

/** Test Étendu (LDB 12 l.197-211 : « atteindre un certain DR … les DR obtenus à chaque Round sont
 *  additionnés jusqu'à atteindre une valeur cible … Si le DR total passe en dessous de 0, recommencer
 *  depuis le début »). Flux multi SÉQUENTIEL : un Round à la fois (chacun son cycle Chance/Pacte/
 *  Résilience), le DR de chaque Round CUMULÉ — la réussite d'un Round DÉPEND du total des précédents.
 *  Ex. enfoncer une porte renforcée (DR cible 20). Le câblage par Round vit dans `FLOWS.extendedTest`,
 *  la progression (cumul + Round suivant + réussite) dans `extendedTestNext`. */
export interface PendingExtendedTest extends PendingBase {
  actorId: string; // qui effectue le Test (solo)
  label: string; // « Enfoncer la porte »
  skillLabel: string; // « Force » / « Athlétisme » (affichage)
  target: number; // cible effective d'UN Round (difficulté déjà appliquée)
  targetDR: number; // DR CUMULÉ à atteindre (LDB 12 : « une valeur cible »)
  total: number; // DR cumulé courant (dépend des Rounds précédents → c'est ce qui rend le flux SÉQUENTIEL)
  rounds: ExtendedTestRound[];
  /** Flag de scène posé à la RÉUSSITE (DR cumulé ≥ cible) — gate la suite (porte/serrure d'éditeur). */
  flag?: string;
  /** SOUTIEN (LDB 12 l.214-225) : le meneur (`actorId`) lance, +10 par soutien plafonné au Bonus de
   *  Caractéristique (`assistedTest`). Déjà FONDU dans `target` ; conservé pour l'affichage (« +20, 2 soutiens »). */
  support?: { count: number; bonus: number };
  /** Issue DISSIPATION (LDB 46 l.204-207) : à la réussite (DR cumulé ≥ NI), retire les effets du Sort
   *  (`dissipateSpell` sur les combattants) au lieu de poser un flag de scène. */
  dispel?: { spellId: string; casterId: string; label: string };
}

/** Paramètres SÉRIALISABLES de la conséquence d'une étape (jamais de closure — coop : le pending est
 *  snapshoté/transmis). Index primitif (`days`/`count`/`severity`/… lus par `String()`/`Number()`) +
 *  deux Flows OPTIONNELS pour l'étape GÉNÉRIQUE `triggeredTest` (la conséquence `onSuccess`/`onFail`
 *  voyage dans le `meta`, exécutée par l'applier — un Flow est pur-donnée, donc sérialisable). */
/** Jet ATTAQUANT FIGÉ d'une étape `triggeredTest` OPPOSÉE (Assommante : Force du porteur vs Résistance
 *  de la victime). Pré-jeté par `resolveFlowTest`, il voyage dans le `meta` (TestResult = pur-donnée,
 *  sérialisable/coop) et reste FIGÉ pendant que le défenseur (héros) influence SON jet ; chaque
 *  (re)résolution recalcule l'issue via `resolveOpposed(jetDéfenseur, aT)` — calque exact de `recover`. */
export interface OpposedFreeze {
  /** Jet COMPLET de l'attaquant (porteur), figé. */
  aT: TestResult;
  /** Nom de l'attaquant (affichage de la ligne d'opposition). */
  attackerName?: string;
  /** Libellé du côté attaquant (« Force ») — affichage. */
  attackerLabel?: string;
  /** Bonus de DR ajouté au jet du DÉFENSEUR avant l'opposition (Piège-lame, LDB 62 l.295) — `FlowTest.
   *  opposed.bonusSL` figé : chaque (re)résolution oppose `def.sl + bonusSL` à `aT`. Absent/0 = Assommante. */
  bonusSL?: number;
}
/** Contexte SÉRIALISABLE d'une DÉFENSE de manœuvre de ZONE (Souffle/Vomi/Regard/Étreinte/Langue, LDB 85)
 *  porté par une étape de cascade `maneuverDefense` : le héros ciblé JETTE sa réaction (Esquive/Initiative/
 *  Parade) opposée au jet d'attaquant FIGÉ (dans `meta.opposed.aT`), influençable (Chance/Résilience). À la
 *  validation, l'applier RE-oppose et applique les effets de la manœuvre (`findManeuverById(maneuverId).effects`)
 *  avec la marge nette + `indice`/`spent` — SOURCE partagée avec le chemin silencieux (`applyManeuverEffects`).
 *  Tout est primitif (ids/nombres) → snapshoté/transmis en coop, jamais de closure. */
export interface ManeuverDefenseFreeze {
  /** Créature attaquante (référent des effets/formules). */
  attackerId: string;
  /** Id de la manœuvre (`maneuvers.json`) → `findManeuverById` reconstruit `effects`/`advantageMode`. */
  maneuverId: string;
  /** Indice de la manœuvre (Dégâts = 4 + BF pour une arme naturelle, LDB 85). */
  indice: number;
  /** Avantage dépensé (marge des manœuvres à Avantage VARIABLE, ex. Regard +1 DR/Av, LDB 85 l.238). */
  spent: number;
}
/** Contexte SÉRIALISABLE d'une ATTAQUE GRATUITE de talent (op `grantFreeAttack`) porté par une étape de
 *  cascade : la CIBLE de la frappe (`targetId` — un TIERS : le chargeur pour Frappe réactive), le plafond
 *  /Round (`cap` = niveau du talent) et la `key` d'imputation (`freeAttacksThisTurn`). Reconstruit l'`exec`
 *  impur de l'applier (la frappe est ouverte via `runCombatFlow` + le hook `freeAttack`). */
export interface FreeAttackFreeze {
  targetId: string;
  cap: number;
  key: string;
}
/** Contexte SÉRIALISABLE de la CONSÉQUENCE d'un Test opposé de Piège-lame GAGNÉ (op `breakBlade`) porté par
 *  une étape de cascade : l'attaquant désarmé (`attackerId`), la lame visée (`weaponUid`, uid universel), le
 *  bonus de DR de la défense (`defSL`, LDB 62 l.295) et le DR FIGÉ de l'attaquant (`attackerSL`). La marge
 *  nette = `(DR du défenseur + defSL) − attackerSL` ≥ 6 → la lame est BRISÉE (sauf Incassable), sinon
 *  ARRACHÉE. Reconstruit l'`exec` impur de l'applier (le bris/désarmement passe par `runCombatFlow` + le
 *  hook `bladeTrap`). Tout est primitif → mirroir dans `meta.bladeTrap` pour la voie cascade (héros manuel). */
export interface BladeTrapFreeze {
  attackerId: string;
  weaponUid: string;
  defSL: number;
  attackerSL: number;
}
export interface CascadeStepMeta {
  [key: string]: number | string | boolean | Flow | GameOp[] | OpposedFreeze | FreeAttackFreeze | BladeTrapFreeze | ManeuverDefenseFreeze | undefined;
  /** Branche de réussite d'une étape `triggeredTest` (exécutée via `applyTriggeredTestBranch`). */
  onSuccess?: Flow;
  /** Branche d'échec d'une étape `triggeredTest`. */
  onFail?: Flow;
  /** Branche OUI d'une étape `triggeredChoice` (décision opt-in acceptée — Frappe réactive « tenter »). */
  choiceYes?: Flow;
  /** Branche NON d'une étape `triggeredChoice` (décision refusée — défaut = renoncer). */
  choiceNo?: Flow;
  /** Coût d'Avantage d'une étape `triggeredChoice` (dépensé sur OUI si payable) — absent = gratuit. */
  choiceCost?: number;
  /** CIBLE de la branche d'un `triggeredChoice` quand elle DIFFÈRE du décideur (`on:'victim'` : le décideur
   *  est le porteur/attaquant `caster`, mais la branche `yes` vise la VICTIME — Déstabilisante : Test opposé
   *  contre la cible touchée). Id sérialisable, restauré en `ctx.target` par l'applier. Absent ⇒ la cible =
   *  le décideur (Frappe réactive : Test sur soi, le tiers voyage dans `freeAttack`). */
  choiceTargetId?: string;
  /** CONTINUATION reprise APRÈS la branche d'un `triggeredTest`/`triggeredChoice` enfoui dans un Flow (le
   *  reste du `seq` qui suivait le nœud). Pur-donnée (voyage en coop) ; rejouée par l'applier via
   *  `runCombatFlow`. Absent (= EMPTY_FLOW) pour un nœud top-level (Mâchoires) → aucune suite. */
  after?: Flow;
  /** Jet ATTAQUANT FIGÉ d'un `triggeredTest` OPPOSÉ — présent ⇒ l'issue du défenseur vient de
   *  `resolveOpposed(jetDéfenseur, aT)` au lieu de `roll ≤ target` (Assommante). Absent ⇒ Test simple. */
  opposed?: OpposedFreeze;
  /** Contexte d'attaque gratuite (Frappe réactive : la branche success porte `grantFreeAttack`) — la frappe
   *  vise le tiers `targetId`. Reconstruit l'`exec` impur de l'applier. Absent ⇒ branche purement data. */
  freeAttack?: FreeAttackFreeze;
  /** Contexte de Piège-lame GAGNÉ (la branche success porte `breakBlade`) — désarme/brise la lame de
   *  l'attaquant ciblé. Reconstruit l'`exec` impur de l'applier. Absent ⇒ branche purement data. */
  bladeTrap?: BladeTrapFreeze;
  /** Contexte d'une DÉFENSE de manœuvre de zone (applier `maneuverDefense`) : l'attaquant + la manœuvre +
   *  l'indice/l'Avantage. Le jet d'attaquant FIGÉ voyage à côté dans `opposed.aT`. */
  maneuverDefense?: ManeuverDefenseFreeze;
}
/** Le jet d'UNE étape de cascade (slot du flux multi SÉQUENTIEL `FLOWS.cascade`). */
export interface CascadeRoll {
  roll: number;
  target: number;
  sl: number;
  success: boolean;
}
/**
 * Une ÉTAPE influençable d'une CASCADE séquentielle (bilan de nuit, journée de voyage…). Le `kind`
 * détermine la CONSÉQUENCE (appliée à la validation par `cascadeAppliers[kind]`, cf. state/cascade.ts) ;
 * le jet lui-même est kind-agnostique (Test de `base`+difficulté sur `target`). `meta` porte les
 * paramètres sérialisables de la conséquence (ex. `days`, `count`) — PAS de closure (coop : le pending
 * est snapshoté/transmis). Une étape SANS `target` est un simple passage (rare) ; les notes en clair
 * vont dans `PendingCascade.log`, pas en étapes.
 */
export interface CascadeStep extends RollParticipant {
  /** Nature de la conséquence (clé de `cascadeAppliers`). Ex. 'recovery' | 'nightmare' | 'exposure'. */
  kind: string;
  /** Héros qui lance (résolu via `actorIn`). Absent → étape de groupe (rare). */
  actorId?: string;
  icon?: string;
  /** Étape-JET : le jet d'attaque/Piétinement/défense/magie/Test/désengagement/porte EST l'étape 0 de
   *  la séquence, rendu par `CascadeModal` via le hook ou la modale correspondante (`useAttackJetProps`/
   *  `useTrampleJetProps`/`useDefenseJetProps`/`useTestJetProps`/`useExtendedTestJetProps`/`CastModal`/
   *  `DisengageModal`/`ForceDoorModal`) → une seule fenêtre. Les données vivent dans `pendingAttack`/
   *  `pendingTrample`/`pendingDefense`/`pendingCast`/`pendingTest`/`pendingExtendedTest`/`pendingDisengage`/
   *  `pendingForceDoor` (coexistants — comme l'attaque), résolus par leur `xConfirm`/`xNext` qui ferme la cascade. */
  jet?: 'attack' | 'trample' | 'defense' | 'fumble' | 'cast' | 'test' | 'extended' | 'disengage' | 'forceDoor';
  /** Étape de GROUPE (action collective : enfoncer une porte à plusieurs) — l'arbitre coop lui donne
   *  l'owner '*' (chacun pilote ses héros) au lieu de `actorId` (une étape forceDoor n'a pas d'acteur
   *  unique). Absent sur les autres `kind` → repli sur `actorId` (identique à aujourd'hui). */
  groupOwner?: boolean;
  /** Libellé du Test affiché (« Résistance », « Calme », « Survie en extérieur »…). */
  rollLabel?: string;
  /** Valeur « brute » du Test (carac/compétence, avant difficulté) — affichage. */
  base?: number;
  /** Cible EFFECTIVE (difficulté déjà appliquée → Test « +0 » sur `target`). Absent → étape sans jet. */
  target?: number;
  result?: CascadeRoll | null;
  /** Paramètres sérialisables de la conséquence (jamais de closure — coop) ; cf. `CascadeStepMeta`
   *  (primitives + Flows `onSuccess`/`onFail` de l'étape générique `triggeredTest`). */
  meta?: CascadeStepMeta;
  /** Étape déjà validée (conséquence appliquée). */
  committed?: boolean;
  /** Conséquence appliquée à la validation (journal) — gardée pour rester lisible dans la pile. */
  outcome?: string[];
  /** Charge RICHE d'une étape d'affichage (ex. Coup Critique : localisation/Blessures/Traumatismes/
   *  États) — rendue par le panneau détaillé partagé (`CriticalBody`) au lieu de simples lignes. */
  reveal?: RevealEntry;
  /** Étape de CHOIX « déviation » (folding P3a) : porte le Critique pré-tiré + le contexte d'attaque
   *  (JSON-sérialisable) ; l'applier appelle `resolveDeviation(step.deviation, chosen)`. */
  deviation?: PendingDeviation;
  /** Étape de CHOIX « piège-lame » (folding P3b) : contexte du Test opposé ; l'applier appelle
   *  `resolveBladeTrap(step.bladeTrap, chosen === 'trap')`. */
  bladeTrap?: PendingBladeTrap;
  /** Étape-JET « Maladresse » (LDB 14, Tableau des Oups !) : SOURCE UNIQUE de la maladresse — l'arme
   *  utilisée + le résultat tiré vivent ICI (l'acteur est `actorId`). Plus de `pendingFumble` top-level
   *  parallèle à désynchroniser : si l'étape existe la donnée existe, si la cascade ferme la maladresse
   *  s'en va — orphelin structurellement impossible. Flux : `fumbleRoll` (rollOups → result),
   *  `fumbleConfirm` (applyOups). */
  fumble?: { weapon: Weapon; result: OupsResolved | null };
  /** Étape-JET de Psychologie À LA RENCONTRE (LDB 21) : un héros face à une source de Peur/Terreur/
   *  Trait ciblé à l'entrée de scène. Test de Calme générique (`target`=Calme) ; l'applier
   *  'encounterPsych' pose le `psychState` (Brisé de Terreur dérivé du DR). Détermination = immunité. */
  encounterPsych?: { kind: PsychType; sourceId: string; sourceName: string; indice: number; cible?: string };
  /** Étape-JET de Psychologie EN COMBAT (LDB 21) : un héros face à une source de Peur/Terreur/Trait
   *  ciblé. Les Traits ciblés ET les NOUVELLES Terreurs se testent au DÉBUT du Round (l.14) ; la Peur
   *  est un Test ÉTENDU testé à la FIN de chaque Round (l.27) → `prevDR` = DR déjà cumulé, l'applier
   *  'combatPsych' cumule `prevDR + DR` vers l'Indice (vainc à ≥ Indice, retire la Peur). Distinct de
   *  `encounterPsych` (simple) car la Peur de combat est ÉTENDUE. Détermination = immunité (LDB 17 l.62). */
  combatPsych?: { kind: PsychType; sourceId: string; sourceName: string; indice: number; cible?: string; prevDR: number; sansPeur?: boolean };
  /** DÉTERMINATION (LDB 17 l.62) sur une étape de Psychologie : le héros gagne une immunité TEMPORAIRE
   *  (≈ 1 Round, `psychImmuneRoundsLeft`) — la Peur/Terreur/Trait est IGNORÉE ce Round, PAS vaincue.
   *  L'applier psy lit ce flag pour NE PAS cumuler le DR (Peur) ni poser le Brisé (Terreur) : il
   *  enregistre seulement « X est temporairement insensible » ; la source reprend à l'expiration. */
  immune?: boolean;
  /** Étape « choix » : options présentées au joueur (l'option retenue pilote la conséquence). */
  options?: { key: string; label: string; detail?: string }[];
  /** Option retenue (clé) — analogue de `result` pour une étape « choix ». */
  chosen?: string;
  /** Clé choisie d'office par « Tout lancer » / résolution immédiate (défaut = `options[0]`). */
  defaultChoice?: string;
}
/**
 * CASCADE séquentielle influençable (régime choisi par l'utilisateur pour les jets de NUIT et de
 * VOYAGE — cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md, Étape 3) : on présente
 * UNE étape à la fois, chacune avec son cycle Chance/+1 DR/Pacte/Résilience, on valide, on enchaîne.
 * `participants` = les seules étapes INFLUENÇABLES (les notes en clair vont dans `log`). `cursor` =
 * l'étape courante. À la validation d'une étape, sa conséquence est appliquée (`cascadeAppliers`) et
 * elle peut INSÉRER des étapes suivantes (dépendance : abri → nombre de jets d'Exposition). `purpose`
 * pilote la FINALISATION (reprise de voyage…). Même fabrique que le Test Étendu — seule la sémantique
 * d'étape (conséquence par `kind` au lieu d'un cumul de DR) change. */
export interface PendingCascade extends MultiPending<CascadeStep> {
  title: string;
  icon?: string;
  /** Index de l'étape courante dans `participants`. */
  cursor: number;
  /** Journal de la cascade (entretien, conséquences validées) — affiché sous l'étape courante. */
  log: string[];
  /** Finalisation : 'night' (bilan de repos), 'travel' (halte → reprise), 'travelDay' (jets du JOUR de
   *  voyage — fluvial/… : à la clôture, le store recalcule la progression du jour puis enchaîne halte/
   *  arrivée via le handler du domaine), 'test' (autonome), 'combat' (conséquences d'un jet de combat —
   *  fermeture simple, pas de reprise). */
  purpose: 'night' | 'travel' | 'travelDay' | 'test' | 'combat';
  /** HALTE de voyage : la finalisation REPREND la route (continueTravelAfterNight). */
  travelHalt?: boolean;
  /** Cascade de PEUR de FIN de Round (combat) : à sa fermeture, le store ré-appelle `resolveRoundBoundary`
   *  pour enchaîner sur la pause de début de Round (la Peur est désormais marquée testée ce Round). */
  roundBoundary?: boolean;
  /** Cascade de FIN DE COMBAT (Tests de Résistance maladie/Corruption des héros survivants, LDB 18/19/20)
   *  ouverte AVANT l'écran de victoire : à sa fermeture, le store enchaîne sur `finishCombatEnd` (writeback
   *  + écran de victoire/défaite) au lieu de reprendre l'IA. */
  combatEndBoundary?: boolean;
  /** Cascade de DÉFENSE à une MANŒUVRE de zone IA (Souffle/Vomi/Regard/Étreinte/Langue, LDB 85) : chaque
   *  héros ciblé y jette sa réaction INFLUENÇABLE. À la fermeture, le store REPREND le tour de la créature
   *  `attackerId` (attaques gratuites restantes puis avance) au lieu du `resumeSuspendedAI` générique —
   *  `free` = la manœuvre était une attaque gratuite (ne re-déclenche pas les libres d'Arme post-Action). */
  maneuverResume?: { attackerId: string; free: boolean };
}

/** Soin de Guérison en attente (LDB 09-Compétences) : flux modale — « Lancer » (healRoll) → Chance
 *  (relance / +1 DR) → Résilience → « Appliquer » (healConfirm). Soigneur/cible résolus par `actorIn`
 *  (combat ⇄ groupe, cf. combatOrParty). `intBonus` figé à l'ouverture. La CHIRURGIE n'est PLUS un
 *  mode de pendingHeal : c'est une opération « armée » sur l'infirmerie (state/medicFlow). */
export interface PendingHeal {
  healerId: string;
  healerName: string;
  targetId: string;
  targetName: string;
  mode: HealMode; // 'wounds' | 'bleed' | 'trauma' (jamais 'surgery' — cf. medicFlow)
  intBonus: number; // Bonus d'Intelligence du soigneur
  skillValue: number; // testValue(soigneur, 'Guérison')
  difficulty: Difficulty; // 'intermediaire' (+0, LDB 09 l.243)
  target: number; // cible effective (affichage)
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR
  rerolled?: boolean;
  /** Acte PAYANT d'un PNJ (infirmerie) : prix déjà débité — remboursé si Annuler AVANT le jet. */
  paidCost?: { gold?: number; silver?: number; brass?: number };
}

/** Chirurgie (Test ÉTENDU multi-passes, LDB 10 l.154 / 12 l.200) — le Test de Médecine d'UNE passe,
 *  DIFFÉRÉ en modale INFLUENÇABLE (« un jet = une modale ») : le chirurgien peut être un HÉROS, qui
 *  dépense Chance/Pacte/Résilience sur SON jet (PNJ → `actorIn` introuvable → influence no-op, comme
 *  `PendingHeal`). Calque `PendingHeal` (jet du soigneur) + `PendingExtendedTest` (cumul du DR). Le cumul
 *  et la sélection patient/Critique vivent sur `medic.surgery` (état de setup) ; chaque passe inflige
 *  1d10 PB + 1 Hémorragie à la validation (`surgeryNext`). `traumaIdx/targetDR/cumDR` sont recopiés de
 *  `medic.surgery` à l'ouverture de la passe (affichage DrBar dans la modale). */
export interface PendingSurgery extends PendingBase {
  healerId: string; // chirurgien (héros → influence ; PNJ → no-op)
  healerName: string;
  targetId: string; // patient opéré
  targetName: string;
  skillValue: number; // testValue(chirurgien, 'Guérison')
  intBonus: number; // Bonus d'Intelligence du chirurgien
  difficulty: Difficulty; // 'intermediaire' (+0)
  target: number; // cible effective d'une passe (affichage) = skillValue
  roll: number | null; // null tant que pas lancé (Chance possible ensuite)
  success: boolean;
  sl: number; // DR de la passe
  traumaIdx: number; // Blessure Critique visée (index dans surgeryTraumas) — figé de medic.surgery
  targetDR: number; // DR cumulé cible (LDB 10) — recopié de medic.surgery (DrBar)
  cumDR: number; // DR cumulé courant — recopié de medic.surgery (DrBar)
  /** Acte PAYANT d'un PNJ (infirmerie) : prix déjà débité — remboursé si on annule AVANT toute passe. */
  paidCost?: { gold?: number; silver?: number; brass?: number };
}
