/**
 * REGISTRE des modales de combat (R2 + coop) — une entrée par modale, l'ORDRE du tableau est la
 * priorité d'affichage. Chaque entrée déclare :
 *  - `when`  : le pending qui l'active ;
 *  - `owner` : le combattant CONCERNÉ (gating coop « chacun voit SES modales » + validation des
 *              intents côté hôte) — `'*'` = tout le monde (sort ennemi : Contre-sort multi),
 *              `undefined` = aucun acteur joueur → l'HÔTE seul.
 *
 * AJOUTER UNE MODALE = UNE entrée ici (+ son composant dans `ui/ActiveModal.COMPONENT`).
 * `pickActiveModalKey` et `modalOwnerOf` sont DÉRIVÉS du registre — rien d'autre à toucher.
 */
import type { GameState } from './store';

/** État partiel accepté par l'arbitre (les tests passent des objets minces). */
export type ArbiterState = Partial<GameState>;

export interface ModalDef {
  key: string;
  /** Le pending de cette modale est-il posé ? */
  when: (s: ArbiterState) => boolean;
  /** Combattant concerné ('*' = tous ; undefined = hôte seul). */
  owner: (s: ArbiterState) => string | undefined | '*';
}

export const MODAL_DEFS = [
  { key: 'fateSave', when: (s) => !!s.pendingFateSave, owner: (s) => s.pendingFateSave?.heroId },
  { key: 'fumble', when: (s) => !!s.pendingFumble, owner: (s) => s.pendingFumble?.combatantId },
  { key: 'deviation', when: (s) => !!s.pendingDeviation, owner: (s) => s.pendingDeviation?.targetId },
  { key: 'bladeTrap', when: (s) => !!s.pendingBladeTrap, owner: (s) => s.pendingBladeTrap?.defenderId },
  { key: 'renounce', when: (s) => !!s.pendingRenounce, owner: (s) => s.pendingRenounce?.heroId },
  { key: 'trample', when: (s) => !!s.pendingTrample, owner: (s) => s.pendingTrample?.attackerId },
  { key: 'reveal', when: (s) => (s.pendingReveals?.length ?? 0) > 0, owner: (s) => s.pendingReveals?.[0]?.subjectId }, // sans sujet (entretien) → hôte
  { key: 'defense', when: (s) => !!s.pendingDefense, owner: (s) => s.pendingDefense?.defenderId },
  { key: 'psych', when: (s) => !!s.pendingPsych, owner: (s) => s.pendingPsych?.combatantId },
  { key: 'encounterPsych', when: (s) => !!s.pendingEncounterPsych, owner: (s) => s.pendingEncounterPsych?.heroId },
  { key: 'disengage', when: (s) => !!s.pendingDisengage, owner: (s) => s.pendingDisengage?.moverId },
  { key: 'mountTarget', when: (s) => !!s.pendingMountTarget, owner: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined) }, // l'attaquant actif qui a cliqué le couple
  { key: 'frenzy', when: (s) => !!s.pendingFrenzy, owner: (s) => s.pendingFrenzy?.combatantId },
  { key: 'approach', when: (s) => !!s.pendingApproach, owner: (s) => s.pendingApproach?.combatantId },
  { key: 'run', when: (s) => !!s.pendingRun, owner: (s) => s.pendingRun?.combatantId },
  { key: 'focus', when: (s) => !!s.pendingFocus, owner: (s) => s.pendingFocus?.casterId },
  // Infirmerie OUVERTE : c'est ELLE qui rend le jet de soin (zone embarquée) — la modale `heal`
  // autonome ne sert qu'au combat (ActionBar). Owner : le soigneur du jet en cours, sinon tous.
  { key: 'medic', when: (s) => !!s.medic, owner: (s) => s.pendingHeal?.healerId ?? '*' },
  // Repos (nuit) : chacun règle SES héros, ready-check, l'hôte dort — modale chez tous.
  { key: 'rest', when: (s) => !!s.pendingRest, owner: () => '*' },
  { key: 'heal', when: (s) => !!s.pendingHeal && !s.medic, owner: (s) => s.pendingHeal?.healerId },
  // Contre-sort à PLUSIEURS (réaction au Sort ennemi figé dans pendingCast) : PRIORITAIRE sur `cast`
  // (les deux pendings coexistent) → la modale de réaction prend la main. Moment partagé → tous.
  { key: 'counterspell', when: (s) => !!s.pendingCounterspell, owner: () => '*' },
  // Enfoncer une porte à plusieurs (EDO Appendice 2) : action de GROUPE — modale chez tous, chacun
  // ne pilote que ses héros (gating per-participant côté UI + netOwnership).
  { key: 'forceDoor', when: (s) => !!s.pendingForceDoor, owner: () => '*' },
  // Test Étendu SÉQUENTIEL (un acteur enchaîne des Rounds) : modale chez le propriétaire de l'acteur.
  { key: 'extendedTest', when: (s) => !!s.pendingExtendedTest, owner: (s) => s.pendingExtendedTest?.actorId },
  // CASCADE séquentielle (jets de nuit/voyage) : l'étape COURANTE a son héros → modale chez son
  // propriétaire (coop : chaque contrôleur influence ses propres jets, l'un après l'autre).
  { key: 'cascade', when: (s) => !!s.pendingCascade, owner: (s) => s.pendingCascade?.participants[s.pendingCascade.cursor]?.actorId },
  {
    key: 'cast',
    // Surincantation : choix des cibles en cours sur la CARTE → la modale s'efface.
    // Pose de ZONE (flux « jet puis pose ») : idem — le gabarit suit le curseur.
    when: (s) => !!s.pendingCast && !s.pendingCast.pickingTargets && !s.pendingCast.zone?.placing,
    // Sort ENNEMI : chez tous (moment partagé + Contre-sort multi) ; sort d'un héros : son propriétaire.
    owner: (s) => {
      const casterId = s.pendingCast?.casterId;
      const caster = casterId && s.battle ? s.battle.combatants.find((c) => c.id === casterId) : undefined;
      return caster?.kind === 'enemy' ? '*' : casterId;
    },
  },
  { key: 'reload', when: (s) => !!s.pendingReload, owner: (s) => s.pendingReload?.actorId },
  { key: 'stateRecovery', when: (s) => !!s.pendingStateRecovery, owner: (s) => s.pendingStateRecovery?.actorId },
  { key: 'attack', when: (s) => !!s.pendingAttack, owner: (s) => s.pendingAttack?.attackerId },
  { key: 'test', when: (s) => !!s.pendingTest, owner: (s) => s.pendingTest?.actorId },
  // Jet d'Activité d'interlude (LDB 23) — hors combat, mais même règle coop : le PROPRIÉTAIRE
  // du héros joue, les autres voient « X joue… » (audit M8 : fini la modale chez tout le monde).
  { key: 'activity', when: (s) => !!s.pendingActivity, owner: (s) => s.pendingActivity?.heroId },
  { key: 'corruption', when: (s) => !!s.pendingCorruption, owner: (s) => s.pendingCorruption?.heroId },
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
