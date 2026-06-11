import { useGame, type GameState } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import type { JSX } from 'react';
import { TestModal } from './TestModal';
import { RollModal } from './RollModal';
import { ReloadModal } from './ReloadModal';
import { StateRecoveryModal } from './StateRecoveryModal';
import { DefenseModal } from './DefenseModal';
import { DeviationModal } from './DeviationModal';
import { BladeTrapModal } from './BladeTrapModal';
import { RenounceModal } from './RenounceModal';
import { MountTargetModal } from './MountTargetModal';
import { FateSaveModal } from './FateSaveModal';
import { DisengageModal } from './DisengageModal';
import { TrampleModal } from './TrampleModal';
import { RunModal } from './RunModal';
import { ApproachModal } from './ApproachModal';
import { FocusModal } from './FocusModal';
import { PsychModal } from './PsychModal';
import { EncounterPsychModal } from './EncounterPsychModal';
import { FrenzyModal } from './FrenzyModal';
import { HealModal } from './HealModal';
import { CastModal } from './CastModal';
import { FumbleModal } from './FumbleModal';
import { RevealModal } from './RevealModal';
import { CorruptionModal } from './CorruptionModal';

/** Clés de modales de combat, de la PLUS prioritaire à la moins prioritaire (R2 du diagnostic). */
export type ModalKey =
  | 'fateSave' | 'fumble' | 'deviation' | 'bladeTrap' | 'renounce' | 'trample' | 'reveal' | 'defense'
  | 'psych' | 'encounterPsych' | 'disengage' | 'mountTarget' | 'frenzy'
  | 'approach' | 'run' | 'focus' | 'heal' | 'cast' | 'reload' | 'stateRecovery' | 'attack' | 'test' | 'corruption';

/** Sous-ensemble de l'état lu par l'arbitre (les `pending*` de combat). */
export interface ModalPendings {
  pendingFateSave?: unknown; pendingFumble?: unknown; pendingDeviation?: unknown; pendingBladeTrap?: unknown; pendingRenounce?: unknown;
  pendingCleave?: unknown; pendingDualStrike?: unknown; pendingTrample?: unknown; pendingReveals?: unknown[];
  pendingDefense?: unknown; pendingPsych?: unknown; pendingEncounterPsych?: unknown;
  pendingDisengage?: unknown; pendingMountTarget?: unknown;
  pendingFrenzy?: unknown; pendingApproach?: unknown; pendingRun?: unknown; pendingFocus?: unknown; pendingHeal?: unknown;
  pendingCast?: unknown; pendingReload?: unknown; pendingStateRecovery?: unknown;
  pendingAttack?: unknown; pendingTest?: unknown; pendingCorruption?: unknown;
}

/**
 * PURE : la modale de combat à afficher MAINTENANT, par priorité sémantique explicite (la 1ʳᵉ dont le
 * `pending` est posé). Garantit qu'UNE seule modale est montée à la fois ; les autres `pending` restent
 * dans le store et reprennent la main quand les plus prioritaires se ferment (file naturelle). `null` = aucune.
 *
 * Ordre : sauvetage par Destin > Maladresse > Déviation critique > Piétinement > révélations
 * témoins > défense réactive > psychologie > manœuvres/actions du joueur > jet.
 * (Le DÉBUT DE ROUND n'est plus une modale : c'est une pause in-situ — frise d'initiative (InitiativeStrip) +
 *  bouton « Commencer le round » dans l'ActionBar — pour ne pas doubler l'ordre déjà affiché à droite.)
 *
 * Frappe Mortelle / 2ᵉ frappe (Deux armes) / Surincantation « +Cible » ne sont PLUS des modales :
 * ce sont des CIBLAGES SUR LE CHAMP DE BATAILLE (bandeau `TargetPrompt` + surbrillances IsoStage +
 * clic carte) — l'arbitre rend `null` pendant ces phases (la carte doit rester cliquable).
 */
export function pickActiveModalKey(s: ModalPendings): ModalKey | null {
  // Surincantation : choix des cibles en cours sur la carte → la modale d'incantation s'efface.
  const castPicking = !!(s.pendingCast as { pickingTargets?: boolean } | null | undefined)?.pickingTargets;
  const order: [boolean, ModalKey][] = [
    [!!s.pendingFateSave, 'fateSave'],
    [!!s.pendingFumble, 'fumble'],
    [!!s.pendingDeviation, 'deviation'],
    [!!s.pendingBladeTrap, 'bladeTrap'],
    [!!s.pendingRenounce, 'renounce'],
    [!!s.pendingTrample, 'trample'],
    [(s.pendingReveals?.length ?? 0) > 0, 'reveal'],
    [!!s.pendingDefense, 'defense'],
    [!!s.pendingPsych, 'psych'],
    [!!s.pendingEncounterPsych, 'encounterPsych'],
    [!!s.pendingDisengage, 'disengage'],
    [!!s.pendingMountTarget, 'mountTarget'],
    [!!s.pendingFrenzy, 'frenzy'],
    [!!s.pendingApproach, 'approach'],
    [!!s.pendingRun, 'run'],
    [!!s.pendingFocus, 'focus'],
    [!!s.pendingHeal, 'heal'],
    [!!s.pendingCast && !castPicking, 'cast'],
    [!!s.pendingReload, 'reload'],
    [!!s.pendingStateRecovery, 'stateRecovery'],
    [!!s.pendingAttack, 'attack'],
    [!!s.pendingTest, 'test'],
    [!!s.pendingCorruption, 'corruption'],
  ];
  return order.find(([on]) => on)?.[1] ?? null;
}

const COMPONENT: Record<ModalKey, () => JSX.Element | null> = {
  fateSave: FateSaveModal, fumble: FumbleModal, deviation: DeviationModal, bladeTrap: BladeTrapModal, renounce: RenounceModal,
  trample: TrampleModal, reveal: RevealModal, defense: DefenseModal, psych: PsychModal,
  encounterPsych: EncounterPsychModal, disengage: DisengageModal,
  mountTarget: MountTargetModal, frenzy: FrenzyModal, approach: ApproachModal, run: RunModal, focus: FocusModal,
  heal: HealModal, cast: CastModal, reload: ReloadModal, stateRecovery: StateRecoveryModal,
  attack: RollModal, test: TestModal, corruption: CorruptionModal,
};

/** Combattant CONCERNÉ par chaque modale (gating coop : « chacun voit SES modales », spec §4bis).
 *  `undefined` = pas d'acteur joueur → seul l'HÔTE la voit (exploration miroir, entretiens…). */
const OWNER_OF: Record<ModalKey, (s: GameState) => string | undefined> = {
  fateSave: (s) => s.pendingFateSave?.heroId,
  fumble: (s) => s.pendingFumble?.combatantId,
  deviation: (s) => s.pendingDeviation?.targetId,
  bladeTrap: (s) => s.pendingBladeTrap?.defenderId,
  renounce: (s) => s.pendingRenounce?.heroId,
  trample: (s) => s.pendingTrample?.attackerId,
  reveal: (s) => s.pendingReveals[0]?.subjectId, // sans sujet (entretien) → hôte
  defense: (s) => s.pendingDefense?.defenderId,
  psych: (s) => s.pendingPsych?.combatantId,
  encounterPsych: (s) => s.pendingEncounterPsych?.heroId,
  disengage: (s) => s.pendingDisengage?.moverId,
  mountTarget: (s) => (s.battle ? s.battle.order[s.battle.turn] : undefined), // l'attaquant actif qui a cliqué le couple
  frenzy: (s) => s.pendingFrenzy?.combatantId,
  approach: (s) => s.pendingApproach?.combatantId,
  run: (s) => s.pendingRun?.combatantId,
  focus: (s) => s.pendingFocus?.casterId,
  heal: (s) => s.pendingHeal?.healerId,
  // Sort d'un ENNEMI : modale chez TOUT LE MONDE (moment partagé + Contre-sort multi — chacun
  // n'engage que SES contre-lanceurs, filtrés dans CastModal) ; sort d'un héros : son propriétaire.
  cast: (s) => {
    const casterId = s.pendingCast?.casterId;
    const caster = casterId && s.battle ? s.battle.combatants.find((c) => c.id === casterId) : undefined;
    return caster?.kind === 'enemy' ? '*' : casterId;
  },
  reload: (s) => s.pendingReload?.actorId,
  stateRecovery: (s) => s.pendingStateRecovery?.actorId,
  attack: (s) => s.pendingAttack?.attackerId,
  test: (s) => s.pendingTest?.actorId,
  corruption: (s) => s.pendingCorruption?.heroId,
};

/** Indicateur discret pour les NON-concernés : qui joue la modale en cours. */
function SpectatorChip({ name }: { name: string }) {
  return <div className="spectator-chip">⏳ {name} joue…</div>;
}

/**
 * Arbitre de modales (R2) : ne monte QUE la modale de combat la plus prioritaire active — au lieu de ~20
 * modales montées côte à côte dont l'empilement dépendait de l'ordre JSX. Les modales HORS combat
 * (Marchand, Document) ne passent pas par l'arbitre (contexte exclusif).
 * EN COOP : la modale ne s'affiche que chez le PROPRIÉTAIRE du combattant concerné ('*' = tous) ;
 * les autres voient la scène + une puce « X joue… ».
 */
export function ActiveModal(): JSX.Element | null {
  const s = useGame();
  const key = pickActiveModalKey(s);
  if (!key) return null;
  if (s.net.mode !== 'local') {
    const ownerId = OWNER_OF[key](s);
    if (ownerId !== '*' && !ownsLocally(s, ownerId)) {
      const seat = ownerId ? s.net.ownership[ownerId] ?? 0 : 0;
      return <SpectatorChip name={s.net.seatNames[seat] ?? 'L’hôte'} />;
    }
  }
  const Comp = COMPONENT[key];
  return <Comp />;
}
