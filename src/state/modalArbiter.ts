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
}

export const MODAL_DEFS = [
  { key: 'fateSave', when: (s) => !!s.pendingFateSave, owner: (s) => s.pendingFateSave?.heroId, auto: { mode: 'choice' } },
  // (La Maladresse n'a PLUS d'entrée propre : c'est une étape `jet:'fumble'` de la cascade `combat`, rendue
  //  par `cascade` (CascadeModal → useFumbleJetProps). La donnée (arme/résultat) vit SUR l'étape (`step.fumble`),
  //  source unique — plus de `pendingFumble` parallèle. `fumbleConfirm` enchaîne le curseur.)
  // (Le Renversement (Déstabilisante) n'a PLUS d'entrée propre : c'est une étape de CHOIX de la
  //  cascade d'ATTAQUE — comme Déviation/Piège-lame — rendue par `cascade`.)
  { key: 'renounce', when: (s) => !!s.pendingRenounce, owner: (s) => s.pendingRenounce?.heroId, auto: { mode: 'choice' } },
  { key: 'trample', when: (s) => !!s.pendingTrample, owner: (s) => s.pendingTrample?.attackerId, auto: { mode: 'self', drive: ['trampleRoll', 'trampleConfirm'] } },
  { key: 'maneuver', when: (s) => !!s.pendingManeuver, owner: (s) => s.pendingManeuver?.attackerId, auto: { mode: 'self', drive: ['maneuverRoll', 'maneuverConfirm'] } },
  { key: 'reveal', when: (s) => (s.pendingReveals?.length ?? 0) > 0, owner: (s) => s.pendingReveals?.[0]?.subjectId, auto: { mode: 'partial' } }, // sans sujet (entretien) → hôte
  // (La Défense n'a PLUS d'entrée propre : c'est une étape `jet:'defense'` de la cascade `combat`,
  //  rendue par `cascade` ci-dessous — `pendingDefense` coexiste comme porteur de données. La défense
  //  ET son Critique/Maladresse vivent dans UNE seule fenêtre. Owner = `actorId` (le défenseur) de l'étape.)
  // (La Psychologie n'a PLUS d'entrée propre : EN COMBAT comme À LA RENCONTRE, c'est une cascade à N
  //  étapes — une par héros — rendue par `cascade`. Combat : Traits/Terreur au DÉBUT de Round, Peur à la
  //  FIN (openRoundStartPsych/openRoundEndPsych). Rencontre : openEncounterPsych à l'entrée de scène.)
  // (Le Désengagement n'a PLUS d'entrée propre : c'est une étape `jet:'disengage'` de la cascade,
  //  rendue par `cascade` ci-dessous — `pendingDisengage` coexiste comme porteur de données/phases.)
  { key: 'mountTarget', when: (s) => !!s.pendingMountTarget, owner: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), auto: { mode: 'choice' } }, // l'attaquant actif qui a cliqué le couple
  { key: 'frenzy', when: (s) => !!s.pendingFrenzy, owner: (s) => s.pendingFrenzy?.combatantId, auto: { mode: 'self', drive: ['frenzyRoll', 'frenzyConfirm'] } },
  { key: 'approach', when: (s) => !!s.pendingApproach, owner: (s) => s.pendingApproach?.combatantId, auto: { mode: 'self', drive: ['approachRoll', 'approachConfirm'] } },
  { key: 'ward', when: (s) => !!s.pendingWard, owner: (s) => s.pendingWard?.attackerId, auto: { mode: 'self', drive: ['wardRoll', 'wardConfirm'] } },
  { key: 'run', when: (s) => !!s.pendingRun, owner: (s) => s.pendingRun?.combatantId, auto: { mode: 'self', drive: ['runRoll', 'runConfirm'] } },
  { key: 'focus', when: (s) => !!s.pendingFocus, owner: (s) => s.pendingFocus?.casterId, auto: { mode: 'self', drive: ['focusRoll', 'focusConfirm'] } },
  { key: 'dispel', when: (s) => !!s.pendingDispel, owner: (s) => s.pendingDispel?.casterId, auto: { mode: 'self', drive: ['dispelRoll', 'dispelConfirm'] } },
  // Infirmerie OUVERTE : c'est ELLE qui rend le jet de soin (zone embarquée) — la modale `heal`
  // autonome ne sert qu'au combat (ActionBar). Owner : le soigneur du jet en cours, sinon tous.
  { key: 'medic', when: (s) => !!s.medic, owner: (s) => s.pendingHeal?.healerId ?? '*', auto: { mode: 'hostOnly' } },
  // Repos (nuit) : chacun règle SES héros, ready-check, l'hôte dort — modale chez tous.
  { key: 'rest', when: (s) => !!s.pendingRest, owner: () => '*', auto: { mode: 'hostOnly' } },
  { key: 'heal', when: (s) => !!s.pendingHeal && !s.medic, owner: (s) => s.pendingHeal?.healerId, auto: { mode: 'self', drive: ['healRoll', 'healConfirm'] } },
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
    // Étape de GROUPE (enfoncer une porte) → '*' (chacun pilote ses héros) ; sinon le héros de l'étape.
    const cur = s.pendingCascade?.participants[s.pendingCascade.cursor];
    return cur?.groupOwner ? '*' : cur?.actorId;
  }, auto: { mode: 'partial' } },
  // (L'incantation n'a PLUS d'entrée propre : la situation « lancer un sort » (jet → opposition de
  //  cible → Contre-sort → Surincantation/pose de zone → Critique → effets) est une étape `jet:'cast'`
  //  de la cascade, rendue par `cascade` ci-dessus (`CastModal` bespoke). `pendingCast` coexiste comme
  //  porteur de données ; ses résolveurs ferment LES DEUX. OWNER équivalent : un Sort ENNEMI ouvre la
  //  cascade avec `groupOwner:true` → l'entrée `cascade` met l'owner à '*' (moment partagé + Contre-sort
  //  multi en coop) ; un Sort de HÉROS sans `groupOwner` → owner = `actorId` (le lanceur). Le ciblage
  //  CARTE (pickingTargets / pose de zone) efface la modale via le `return null` du host dans CascadeModal.)
  { key: 'reload', when: (s) => !!s.pendingReload, owner: (s) => s.pendingReload?.actorId, auto: { mode: 'self', drive: ['reloadRoll', 'reloadConfirm'] } },
  { key: 'stateRecovery', when: (s) => !!s.pendingStateRecovery, owner: (s) => s.pendingStateRecovery?.actorId, auto: { mode: 'self', drive: ['recoverRoll', 'recoverConfirm'] } },
  // (L'attaque n'a PLUS d'entrée propre : c'est une étape `jet:'attack'` de la cascade `combat` (CascadeModal
  //  → useAttackJetProps) — `pendingAttack` coexiste comme porteur de données. TOUS les chemins d'attaque
  //  (Charge / normale / gratuite + balayage/dual qui réutilisent) ouvrent une cascade → plus de modale
  //  `attack` autonome ni de `RollModal`. L'auto-résolution passe donc par `JET_AUTO['attack']` (combatAuto).)
  // (Le Test de scène n'a PLUS d'entrée propre : c'est une cascade `jet:'test'` rendue par `cascade`
  //  ci-dessus — `pendingTest` coexiste comme porteur de données, comme `pendingAttack` pour l'attaque.)
  // Jet d'Activité d'interlude (LDB 23) — hors combat, mais même règle coop : le PROPRIÉTAIRE
  // du héros joue, les autres voient « X joue… » (audit M8 : fini la modale chez tout le monde).
  { key: 'activity', when: (s) => !!s.pendingActivity, owner: (s) => s.pendingActivity?.heroId, auto: { mode: 'hostOnly' } },
  { key: 'corruption', when: (s) => !!s.pendingCorruption, owner: (s) => s.pendingCorruption?.heroId, auto: { mode: 'self', drive: ['corruptionRoll', 'resolveCorruption'] } },
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
