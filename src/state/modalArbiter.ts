/**
 * REGISTRE des modales de combat (R2 + coop) — une entrée par modale, l'ORDRE du tableau est la
 * priorité d'affichage. Chaque entrée déclare :
 *  - `when`  : le pending qui l'active ;
 *  - `owner` : le combattant CONCERNÉ (gating coop « chacun voit SES modales » + validation des
 *              intents côté hôte) — `'*'` = tout le monde (sort ennemi : Contre-sort multi),
 *              `undefined` = aucun acteur joueur → l'HÔTE seul.
 *  - `auto`  : POLITIQUE d'automatisation « Cadence de combat » (cf. `combatAuto.ts`) — REQUISE :
 *              ajouter une modale FORCE à déclarer comment elle s'auto-résout (le commit ne compile
 *              pas sinon → exhaustivité garantie). `self` = jet propre (drive = actions à enchaîner),
 *              `choice` = vrai choix joueur (Rapide laisse ; l'IA tranche en Auto-combat), `partial` =
 *              pilote dédié (cascade pas-à-pas, révélation auto-acquittée), `hostOnly` = hors-combat / jamais auto.
 *
 * AJOUTER UNE MODALE = UNE entrée ici (+ son composant dans `ui/ActiveModal.COMPONENT`).
 * `pickActiveModalKey` et `modalOwnerOf` sont DÉRIVÉS du registre — rien d'autre à toucher.
 */
import type { GameState } from './store';
import { WORLD_STEP_OWNER } from './pendings';
import type { PendingKey } from './stateFields';

/** État partiel accepté par l'arbitre (les tests passent des objets minces). */
export type ArbiterState = Partial<GameState>;

/**
 * Politique d'auto-résolution d'une modale (Cadence Rapide/Auto). Les noms d'actions de `drive` sont
 * des résolveurs RÉELS du store (typés `keyof GameState`, vérifiés par `modalAuto.valid.test.ts`) —
 * jamais une dérivation (le mapping clé→action n'est PAS 1:1 : `stateRecovery`→`recover*`,
 * `corruption`→`resolveCorruption`…). Les jets de COMBAT (attaque/défense/cast/…) n'ont plus de clé
 * propre : ce sont des étapes de la `cascade` (`partial`), pilotées via `JET_AUTO` dans `combatAuto`.
 */
export type AutoPolicy =
  | { mode: 'self'; drive: readonly (keyof GameState)[] }                  // jet propre : enchaîner roll → confirm
  | { mode: 'choice'; autoDrive?: readonly (keyof GameState)[] }           // vrai choix : Rapide LAISSE (joueur) ;
                                                                            // Auto-combat tranche — `autoDrive` = actions à
                                                                            // enchaîner si l'IA doit le résoudre (ex. cast)
  | { mode: 'partial' }                                                    // cascade / révélation : pilote dédié (combatAuto)
  | { mode: 'hostOnly' };                                                  // hors-combat / hôte : jamais auto-résolu

export interface ModalDef {
  key: string;
  /** Le pending de cette modale est-il posé ? */
  when: (s: ArbiterState) => boolean;
  /** Combattant concerné ('*' = tous ; undefined = hôte seul). */
  owner: (s: ArbiterState) => string | undefined | '*';
  /** Politique d'automatisation (Cadence de combat) — REQUISE. */
  auto: AutoPolicy;
  /** Clé(s) `pending*` que CETTE modale possède/rend — REQUISE (patron `auto` ci-dessus, #284). Une
   *  entrée normale porte SA seule clé (`'fateSave'` → `['pendingFateSave']`) ; `cascade`/`medic`
   *  couvrent en plus les pendings COEXISTANTS qu'elles rendent (porteurs de données d'une étape —
   *  `pendingAttack`/`pendingCast`/… n'ont plus de modale propre, cf. commentaires ci-dessous). Preuve
   *  exhaustive AU COMPILATEUR : `_pendingOwnerCoverageCheck` (fin de fichier) exige que l'union
   *  `covers` + `HORS_MODAL` reproduise EXACTEMENT `PendingKey` — un `pending*` oublié ne compile pas. */
  covers: readonly PendingKey[];
}

export const MODAL_DEFS = [
  { key: 'fateSave', when: (s) => !!s.pendingFateSave, owner: (s) => s.pendingFateSave?.heroId, auto: { mode: 'choice' }, covers: ['pendingFateSave'] },
  // (La Maladresse n'a PLUS d'entrée propre : c'est une étape `jet:'fumble'` de la cascade `combat`, rendue
  //  par `cascade` (CascadeModal → useFumbleJetProps). La donnée (arme/résultat) vit SUR l'étape (`step.fumble`),
  //  source unique — plus de `pendingFumble` parallèle. `fumbleConfirm` enchaîne le curseur.)
  // (Le Renversement (Déstabilisante) n'a PLUS d'entrée propre : c'est une étape de CHOIX de la
  //  cascade d'ATTAQUE — comme Déviation/Piège-lame — rendue par `cascade`.)
  { key: 'renounce', when: (s) => !!s.pendingRenounce, owner: (s) => s.pendingRenounce?.heroId, auto: { mode: 'choice' }, covers: ['pendingRenounce'] },
  // (Le Piétinement n'a PLUS d'entrée propre : c'est une étape `jet:'trample'` de la cascade `combat`
  //  (CascadeModal → useTrampleJetProps) — `pendingTrample` coexiste comme porteur de données. Le jet ET
  //  son Coup Critique vivent dans UNE fenêtre (fini la 2ᵉ modale « Conséquences »). L'auto-résolution
  //  passe donc par `JET_AUTO['trample']` (combatAuto), comme l'attaque.)
  // Battement (LDB 10 l.103) : jet PROPRE de CC (non opposé) → 'self' (Lancer puis Appliquer), comme le Piétinement.
  { key: 'battement', when: (s) => !!s.pendingBattement, owner: (s) => s.pendingBattement?.attackerId, auto: { mode: 'self', drive: ['battementRoll', 'battementConfirm'] }, covers: ['pendingBattement'] },
  // Distraire (LDB 10 l.364) : jet PROPRE d'Athlétisme opposé au Calme figé du foe → 'self' (le mover pilote son jet).
  { key: 'distraire', when: (s) => !!s.pendingDistraire, owner: (s) => s.pendingDistraire?.moverId, auto: { mode: 'self', drive: ['distraireRoll', 'distraireConfirm'] }, covers: ['pendingDistraire'] },
  { key: 'maneuver', when: (s) => !!s.pendingManeuver, owner: (s) => s.pendingManeuver?.attackerId, auto: { mode: 'self', drive: ['maneuverRoll', 'maneuverConfirm'] }, covers: ['pendingManeuver'] },
  { key: 'reveal', when: (s) => (s.pendingReveals?.length ?? 0) > 0, owner: (s) => s.pendingReveals?.[0]?.subjectId, auto: { mode: 'partial' }, covers: ['pendingReveals'] }, // sans sujet (entretien) → hôte
  // (La Défense n'a PLUS d'entrée propre : c'est une étape `jet:'defense'` de la cascade `combat`,
  //  rendue par `cascade` ci-dessous — `pendingDefense` coexiste comme porteur de données. La défense
  //  ET son Critique/Maladresse vivent dans UNE seule fenêtre. Owner = `actorId` (le défenseur) de l'étape.)
  // (La Psychologie n'a PLUS d'entrée propre : EN COMBAT comme À LA RENCONTRE, c'est une cascade à N
  //  étapes — une par héros — rendue par `cascade`. Combat : Traits/Terreur au DÉBUT de Round, Peur à la
  //  FIN (openRoundStartPsych/openRoundEndPsych). Rencontre : openEncounterPsych à l'entrée de scène.)
  // (Le Désengagement n'a PLUS d'entrée propre : c'est une étape `jet:'disengage'` de la cascade,
  //  rendue par `cascade` ci-dessous — `pendingDisengage` coexiste comme porteur de données/phases.)
  // « Au Contact » (LDB 62 l.176) : Test opposé de Corps à corps PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `renounce`/`mountTarget`). Initiée par le joueur (jamais par l'IA) → aucun
  // auto-drive : en Rapide la modale reste au joueur, l'IA ne la déclenche pas (pas de hang).
  { key: 'auContact', when: (s) => !!s.pendingAuContact, owner: (s) => s.pendingAuContact?.moverId, auto: { mode: 'choice' }, covers: ['pendingAuContact'] },
  // Empoignade (LDB 14 l.161) : Test opposé de Force OU « Briser » PUIS choix du vainqueur → vrai CHOIX
  // (mode 'choice', comme `auContact`). Initiée par le joueur (jamais par l'IA) → pas d'auto-drive.
  { key: 'grapple', when: (s) => !!s.pendingGrapple, owner: (s) => s.pendingGrapple?.actorId, auto: { mode: 'choice' }, covers: ['pendingGrapple'] },
  { key: 'mountTarget', when: (s) => !!s.pendingMountTarget, owner: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), auto: { mode: 'choice' }, covers: ['pendingMountTarget'] }, // l'attaquant actif qui a cliqué le couple
  { key: 'frenzy', when: (s) => !!s.pendingFrenzy, owner: (s) => s.pendingFrenzy?.combatantId, auto: { mode: 'self', drive: ['frenzyRoll', 'frenzyConfirm'] }, covers: ['pendingFrenzy'] },
  { key: 'approach', when: (s) => !!s.pendingApproach, owner: (s) => s.pendingApproach?.combatantId, auto: { mode: 'self', drive: ['approachRoll', 'approachConfirm'] }, covers: ['pendingApproach'] },
  { key: 'ward', when: (s) => !!s.pendingWard, owner: (s) => s.pendingWard?.attackerId, auto: { mode: 'self', drive: ['wardRoll', 'wardConfirm'] }, covers: ['pendingWard'] },
  { key: 'run', when: (s) => !!s.pendingRun, owner: (s) => s.pendingRun?.combatantId, auto: { mode: 'self', drive: ['runRoll', 'runConfirm'] }, covers: ['pendingRun'] },
  { key: 'shipManeuver', when: (s) => !!s.pendingShipManeuver, owner: (s) => s.pendingShipManeuver?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipManeuver'] }, // Test d'équipage MULTI : chaque PJ pilote SON jet (cf. RollRow), pas d'auto-drive mono
  { key: 'shipBattery', when: (s) => !!s.pendingShipBattery, owner: (s) => s.pendingShipBattery?.shipId, auto: { mode: 'choice' }, covers: ['pendingShipBattery'] }, // Tir de batterie MULTI (Artilleurs) — idem manœuvre
  { key: 'crewTest', when: (s) => !!s.pendingCrewTest, owner: (s) => s.pendingCrewTest?.shipId, auto: { mode: 'choice' }, covers: ['pendingCrewTest'] }, // Test d'équipage GÉNÉRIQUE (Rude épreuve…) — idem manœuvre
  { key: 'shanty', when: (s) => !!s.pendingShanty, owner: (s) => s.pendingShanty?.singerId, auto: { mode: 'choice' }, covers: ['pendingShanty'] }, // Chanson de marin : CHOIX de la chanson (pré-jet) — jamais auto-résolue
  { key: 'focus', when: (s) => !!s.pendingFocus, owner: (s) => s.pendingFocus?.casterId, auto: { mode: 'self', drive: ['focusRoll', 'focusConfirm'] }, covers: ['pendingFocus'] },
  { key: 'dispel', when: (s) => !!s.pendingDispel, owner: (s) => s.pendingDispel?.casterId, auto: { mode: 'self', drive: ['dispelRoll', 'dispelConfirm'] }, covers: ['pendingDispel'] },
  // Infirmerie OUVERTE : c'est ELLE qui rend les jets EMBARQUÉS (soin OU passe de Chirurgie) — les
  // modales autonomes `heal`/surgery ne servent qu'au combat (et la Chirurgie est toujours hors combat).
  // Owner : le soigneur/chirurgien du jet INFLUENÇABLE en cours (coop), sinon tous. `pendingSurgery`
  // n'a PAS d'entrée propre : il vit DANS l'infirmerie (rendu par MedicModal), comme `pendingHeal` ici.
  // L'infirmerie CÈDE le devant à une CASCADE en cours (`!s.pendingCascade`) — le Test d'infection
  // post-opératoire (LDB 10 l.365) est un jet INFLUENÇABLE qui doit passer AU-DESSUS du panneau (comme
  // la révélation d'antan) ; à sa clôture l'infirmerie RÉAPPARAÎT (même patron que `heal` cédant à `medic`).
  { key: 'medic', when: (s) => !!s.medic && !s.pendingCascade, owner: (s) => s.pendingHeal?.healerId ?? s.pendingSurgery?.healerId ?? '*', auto: { mode: 'hostOnly' }, covers: ['pendingSurgery'] }, // pendingHeal COUVERT par 'heal' ci-dessous (l'infirmerie le lit aussi, mais n'en est pas l'unique propriétaire)
  // Repos (nuit) : chacun règle SES héros, ready-check, l'hôte dort — modale chez tous.
  { key: 'rest', when: (s) => !!s.pendingRest, owner: () => '*', auto: { mode: 'hostOnly' }, covers: ['pendingRest'] },
  // Conseil de bord (paie hebdomadaire + Moral, #229) : décision de bourse PARTAGÉE → l'hôte seul (comme
  // les autres actions à l'argent du groupe) ; hors-combat, jamais auto (la cadence auto ne l'ouvre pas).
  { key: 'council', when: (s) => !!s.pendingCouncil, owner: () => undefined, auto: { mode: 'hostOnly' }, covers: ['pendingCouncil'] },
  { key: 'heal', when: (s) => !!s.pendingHeal && !s.medic, owner: (s) => s.pendingHeal?.healerId, auto: { mode: 'self', drive: ['healRoll', 'healConfirm'] }, covers: ['pendingHeal'] },
  // (Le Contre-sort (Dissipation) n'a PLUS d'entrée propre : c'est une RÉACTION au Sort ENNEMI figé
  //  dans `pendingCast`, rendue DANS la modale `cast` ci-dessous (rangées ParticipantSpell par héros
  //  contre-lanceur — comme l'opposition de cible). « Le contre-sort, c'est le lancement d'un sort qui
  //  peut être opposé → pas une modale différente. » L'owner du Sort ennemi est déjà '*' (cf. `cast`).)
  // (L'enfoncement de porte n'a PLUS d'entrée propre : c'est une étape `jet:'forceDoor'` (groupOwner)
  //  de la cascade, rendue par `cascade` ci-dessous — `pendingForceDoor` coexiste comme porteur de
  //  données/participants ; chacun ne pilote que ses héros (gating per-participant côté UI).)
  // (Le Test étendu n'a PLUS d'entrée propre : c'est une cascade `jet:'extended'` rendue par `cascade`
  //  ci-dessous — `pendingExtendedTest` coexiste comme porteur de données, comme `pendingAttack`.)
  // CASCADE séquentielle (jets de nuit/voyage) : l'étape COURANTE a son héros → modale chez son
  // propriétaire (coop : chaque contrôleur influence ses propres jets, l'un après l'autre).
  { key: 'cascade', when: (s) => !!s.pendingCascade, owner: (s) => {
    // Étape de GROUPE (enfoncer une porte) → '*' (chacun pilote ses héros) ; étape MONDE sans acteur
    // (`worldOwner`, seam #275 Décision 3 — désertion/Moral) → sentinel routé au siège MJ par
    // `netOwnership.seatOwns` ; sinon le héros de l'étape.
    const cur = s.pendingCascade?.participants[s.pendingCascade.cursor];
    if (cur?.groupOwner) return '*';
    if (!cur?.actorId && cur?.worldOwner) return WORLD_STEP_OWNER;
    return cur?.actorId;
  }, auto: { mode: 'partial' }, covers: [
    'pendingCascade',
    // Porteurs de données des étapes-jet (cf. `CascadeStep.jet`, plus de modale propre) :
    'pendingTest', 'pendingAttack', 'pendingDefense', 'pendingDisengage', 'pendingCast',
    'pendingExtendedTest', 'pendingForceDoor', 'pendingTrample',
    // Coexistent DANS l'étape `jet:'cast'` (Contre-sort/opposition de cible, rendus par CastModal) :
    'pendingCounterspell', 'pendingCastOpposition',
  ] },
  // (L'incantation n'a PLUS d'entrée propre : la situation « lancer un sort » (jet → opposition de
  //  cible → Contre-sort → Surincantation/pose de zone → Critique → effets) est une étape `jet:'cast'`
  //  de la cascade, rendue par `cascade` ci-dessus (`CastModal` bespoke). `pendingCast` coexiste comme
  //  porteur de données ; ses résolveurs ferment LES DEUX. OWNER équivalent : un Sort ENNEMI ouvre la
  //  cascade avec `groupOwner:true` → l'entrée `cascade` met l'owner à '*' (moment partagé + Contre-sort
  //  multi en coop) ; un Sort de HÉROS sans `groupOwner` → owner = `actorId` (le lanceur). Le ciblage
  //  CARTE (pickingTargets / pose de zone) efface la modale via le `return null` du host dans CascadeModal.)
  { key: 'reload', when: (s) => !!s.pendingReload, owner: (s) => s.pendingReload?.actorId, auto: { mode: 'self', drive: ['reloadRoll', 'reloadConfirm'] }, covers: ['pendingReload'] },
  // Main ensanglantée (AA l.2569) : Test de Dextérité PAR ACTION — jet PROPRE de l'attaquant (`self`) ;
  // en cadence Rapide/Auto le driver le résout (Lancer → Appliquer), comme `reload`.
  { key: 'handGate', when: (s) => !!s.pendingHandGate, owner: (s) => s.pendingHandGate?.attackerId, auto: { mode: 'self', drive: ['handGateRoll', 'handGateConfirm'] }, covers: ['pendingHandGate'] },
  { key: 'stateRecovery', when: (s) => !!s.pendingStateRecovery, owner: (s) => s.pendingStateRecovery?.actorId, auto: { mode: 'self', drive: ['recoverRoll', 'recoverConfirm'] }, covers: ['pendingStateRecovery'] },
  // Sauvegarde d'Initiative « Fuite de vapeur » (MDG 12 l.326-328) : jet PROPRE de la personne au moteur.
  { key: 'steamSave', when: (s) => !!s.pendingSteamSave, owner: (s) => s.pendingSteamSave?.actorId, auto: { mode: 'self', drive: ['steamSaveRoll', 'steamSaveConfirm'] }, covers: ['pendingSteamSave'] },
  // (L'attaque n'a PLUS d'entrée propre : c'est une étape `jet:'attack'` de la cascade `combat` (CascadeModal
  //  → useAttackJetProps) — `pendingAttack` coexiste comme porteur de données. TOUS les chemins d'attaque
  //  (Charge / normale / gratuite + balayage/dual qui réutilisent) ouvrent une cascade → plus de modale
  //  `attack` autonome ni de `RollModal`. L'auto-résolution passe donc par `JET_AUTO['attack']` (combatAuto).)
  // (Le Test de scène n'a PLUS d'entrée propre : c'est une cascade `jet:'test'` rendue par `cascade`
  //  ci-dessus — `pendingTest` coexiste comme porteur de données, comme `pendingAttack` pour l'attaque.)
  // Jet d'Activité d'interlude (LDB 23) — hors combat, mais même règle coop : le PROPRIÉTAIRE
  // du héros joue, les autres voient « X joue… » (audit M8 : fini la modale chez tout le monde).
  { key: 'activity', when: (s) => !!s.pendingActivity, owner: (s) => s.pendingActivity?.heroId, auto: { mode: 'hostOnly' }, covers: ['pendingActivity'] },
  { key: 'corruption', when: (s) => !!s.pendingCorruption, owner: (s) => s.pendingCorruption?.heroId, auto: { mode: 'self', drive: ['corruptionRoll', 'resolveCorruption'] }, covers: ['pendingCorruption'] },
] as const satisfies readonly ModalDef[];

export type ModalKey = (typeof MODAL_DEFS)[number]['key'];

/** PURE : la modale à afficher MAINTENANT (1ʳᵉ entrée active du registre). `null` = aucune.
 *  Frappe Mortelle / 2ᵉ frappe / Surincantation « +Cible » = ciblages CARTE (pas de modale). */
export function pickActiveModalKey(s: ArbiterState): ModalKey | null {
  return (MODAL_DEFS.find((d) => d.when(s))?.key as ModalKey | undefined) ?? null;
}

/** Combattant concerné par la MODALE ACTIVE (ou '*' / undefined). null = aucune modale. */
export function modalOwnerOf(s: ArbiterState): string | undefined | '*' | null {
  const def = MODAL_DEFS.find((d) => d.when(s));
  return def ? def.owner(s) : null;
}

/** Politique d'auto-résolution de la modale ACTIVE (cf. `combatAuto.ts`). null = aucune modale. */
export function autoPolicyOf(s: ArbiterState): AutoPolicy | null {
  const def = MODAL_DEFS.find((d) => d.when(s));
  return def ? def.auto : null;
}

/**
 * L'écran-hub de VOYAGE (`VoyageScreen`, #333) est-il la surface active ? Un voyage EN COURS (non
 * interrompu, hors recap d'arrivée), en exploration, carte fermée, hors combat → le hub plein-champ
 * HÉBERGE la cascade du jour (rendue EN SON CENTRE, `CascadeBody embedded`) au lieu d'une modale
 * flottante (le geste anti-tunnel). `ActiveModal` supprime alors la cascade flottante ; la porte de
 * consultation (Dossier navire, fiches) reste ouvrable par-dessus (règle GÉNÉRALE, pas par-écran). */
export function voyageHubActive(s: ArbiterState): boolean {
  return !!s.travelPlan && !s.travelPlan.interrupted && !s.travelRecap
    && s.mode === 'exploration' && !s.worldMapOpen && !s.battle;
}

/**
 * Registre des pendings HORS-modale (#284) : pas d'entrée `MODAL_DEFS`, rendus par un ÉCRAN dédié
 * (`ScreenShell`/panneau de jeu) plutôt qu'une modale de combat — marché/butin/victoire/campagne/
 * ciblage carte… Chaque entrée déclare son OWNER coop, MÊME VOCABULAIRE que `ModalDef.owner`
 * ('*' = tous les sièges voient/agissent, `undefined` = hôte seul). Ce registre ne CÂBLE rien —
 * il documente qui DEVRAIT gater l'écran ; le branchement effectif par écran est un lot séparé (#284
 * ne pose que le verrou de type + la déclaration).
 */
export interface HorsModalDef {
  key: string;
  pendingKey: PendingKey;
  owner: (s: ArbiterState) => string | undefined | '*';
}

export const HORS_MODAL = [
  { key: 'bargain', pendingKey: 'pendingBargain', owner: (s) => s.pendingBargain?.playerId }, // Marchandage (écran Marché)
  { key: 'appraise', pendingKey: 'pendingAppraise', owner: (s) => s.pendingAppraise?.actorId }, // Évaluation/Détection (écran Marché/Compendium)
  { key: 'loot', pendingKey: 'pendingLoot', owner: () => '*' }, // Butin hors victoire : chacun voit qui l'emporte
  { key: 'victory', pendingKey: 'pendingVictory', owner: () => '*' }, // Écran de victoire : `readyBySeat`, unanimité
  { key: 'siegeAim', pendingKey: 'pendingSiegeAim', owner: (s) => s.pendingSiegeAim?.gunnerId }, // Placeur de case (ciblage carte, pas de modale)
  { key: 'interact', pendingKey: 'pendingInteract', owner: () => undefined }, // Interaction de décor : hôte (pas de héros structuré porté par le pending)
  { key: 'roundStart', pendingKey: 'pendingRoundStart', owner: () => '*' }, // Pause de début de Round (fenêtre Chance) : ready-check par siège
  { key: 'seaActivities', pendingKey: 'pendingSeaActivities', owner: () => '*' }, // Activités hebdomadaires en mer : décision de groupe
  { key: 'manannPriest', pendingKey: 'pendingManannPriest', owner: () => '*' }, // Événement de port (MDG 15) : décision de groupe
  { key: 'shoreLeave', pendingKey: 'pendingShoreLeave', owner: () => '*' }, // Relâche à terre (MDG 15) : décision de groupe
  { key: 'campaign', pendingKey: 'pendingCampaign', owner: () => undefined }, // Campagne choisie au menu : avant tout siège coop, hôte
  { key: 'orders', pendingKey: 'pendingOrders', owner: () => undefined }, // Commandes d'interlude : dépense de bourse de groupe, hôte
  { key: 'cleave', pendingKey: 'pendingCleave', owner: (s) => s.pendingCleave?.attackerId }, // Balayage : ciblage carte (TargetPrompt), pas de modale
  { key: 'dualStrike', pendingKey: 'pendingDualStrike', owner: (s) => s.pendingDualStrike?.attackerId }, // 2ᵉ frappe (deux armes) : ciblage carte, idem
  { key: 'logQueue', pendingKey: 'pendingLogQueue', owner: () => undefined }, // File de journal DIFFÉRÉE : système, drainée automatiquement (pas d'acteur)
] as const satisfies readonly HorsModalDef[];

/** Toutes les clés `pending*` couvertes par `MODAL_DEFS` (owner MODALE, direct + coexistants). */
type ModalCoveredKey = (typeof MODAL_DEFS)[number]['covers'][number];
/** Toutes les clés `pending*` couvertes par `HORS_MODAL` (owner HORS-modale). */
type HorsModalCoveredKey = (typeof HORS_MODAL)[number]['pendingKey'];

/**
 * VERROU DE COMPILATION (#284) : tout `pending*` de `GameState` (`PendingKey`, dérivé — cf.
 * `stateFields.ts`) doit être couvert par `MODAL_DEFS.covers` OU `HORS_MODAL` — le TIERS n'existe
 * pas. Un `pending*` ajouté sans classer son owner coop casse tsc ICI : `_pendingOwnerCoverage`
 * n'accepte que `never` en 2ᵉ position ; toute clé manquante s'y affiche en litige (patron AutoPolicy).
 */
type _MissingPendingOwner = Exclude<PendingKey, ModalCoveredKey | HorsModalCoveredKey>;
type _pendingOwnerCoverage = [manquant: _MissingPendingOwner] extends [never] ? true : ['pending* sans owner coop déclaré (MODAL_DEFS.covers ni HORS_MODAL)', _MissingPendingOwner];
const _pendingOwnerCoverageCheck: _pendingOwnerCoverage = true;
void _pendingOwnerCoverageCheck;
