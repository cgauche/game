import { useGame } from '../state/store';
import type { JSX } from 'react';
import { TestModal } from './TestModal';
import { RollModal } from './RollModal';
import { ReloadModal } from './ReloadModal';
import { StateRecoveryModal } from './StateRecoveryModal';
import { DefenseModal } from './DefenseModal';
import { DeviationModal } from './DeviationModal';
import { BladeTrapModal } from './BladeTrapModal';
import { MountTargetModal } from './MountTargetModal';
import { FateSaveModal } from './FateSaveModal';
import { DisengageModal } from './DisengageModal';
import { CleaveModal } from './CleaveModal';
import { DualStrikeModal } from './DualStrikeModal';
import { TrampleModal } from './TrampleModal';
import { RunModal } from './RunModal';
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
  | 'fateSave' | 'fumble' | 'deviation' | 'bladeTrap' | 'cleave' | 'trample' | 'reveal' | 'dualStrike' | 'defense'
  | 'psych' | 'encounterPsych' | 'disengage' | 'mountTarget' | 'frenzy'
  | 'run' | 'focus' | 'heal' | 'cast' | 'reload' | 'stateRecovery' | 'attack' | 'test' | 'corruption';

/** Sous-ensemble de l'état lu par l'arbitre (les `pending*` de combat). */
export interface ModalPendings {
  pendingFateSave?: unknown; pendingFumble?: unknown; pendingDeviation?: unknown; pendingBladeTrap?: unknown;
  pendingCleave?: unknown; pendingDualStrike?: unknown; pendingTrample?: unknown; pendingReveals?: unknown[];
  pendingDefense?: unknown; pendingPsych?: unknown; pendingEncounterPsych?: unknown;
  pendingDisengage?: unknown; pendingMountTarget?: unknown;
  pendingFrenzy?: unknown; pendingRun?: unknown; pendingFocus?: unknown; pendingHeal?: unknown;
  pendingCast?: unknown; pendingReload?: unknown; pendingStateRecovery?: unknown;
  pendingAttack?: unknown; pendingTest?: unknown; pendingCorruption?: unknown;
}

/**
 * PURE : la modale de combat à afficher MAINTENANT, par priorité sémantique explicite (la 1ʳᵉ dont le
 * `pending` est posé). Garantit qu'UNE seule modale est montée à la fois ; les autres `pending` restent
 * dans le store et reprennent la main quand les plus prioritaires se ferment (file naturelle). `null` = aucune.
 *
 * Ordre : sauvetage par Destin > Maladresse > Déviation critique > Frappe Mortelle/Piétinement > révélations
 * témoins > défense réactive > psychologie > manœuvres/actions du joueur > jet.
 * (Le DÉBUT DE ROUND n'est plus une modale : c'est une pause in-situ — frise d'initiative (InitiativeStrip) +
 *  bouton « Commencer le round » dans l'ActionBar — pour ne pas doubler l'ordre déjà affiché à droite.)
 */
export function pickActiveModalKey(s: ModalPendings): ModalKey | null {
  const order: [boolean, ModalKey][] = [
    [!!s.pendingFateSave, 'fateSave'],
    [!!s.pendingFumble, 'fumble'],
    [!!s.pendingDeviation, 'deviation'],
    [!!s.pendingBladeTrap, 'bladeTrap'],
    // Frappe Mortelle : le jet d'enchaînement (pendingAttack) prend la main — sinon CleaveModal rend `null`.
    [!!s.pendingCleave && !s.pendingAttack, 'cleave'],
    [!!s.pendingTrample, 'trample'],
    [(s.pendingReveals?.length ?? 0) > 0, 'reveal'],
    // Maniement de deux armes : sélection de la 2ᵉ cible — APRÈS les révélations (Critique de la 1ʳᵉ frappe
    // d'abord) ; cède au jet de la 2ᵉ frappe (pendingAttack), sinon DualStrikeModal rend `null`.
    [!!s.pendingDualStrike && !s.pendingAttack, 'dualStrike'],
    [!!s.pendingDefense, 'defense'],
    [!!s.pendingPsych, 'psych'],
    [!!s.pendingEncounterPsych, 'encounterPsych'],
    [!!s.pendingDisengage, 'disengage'],
    [!!s.pendingMountTarget, 'mountTarget'],
    [!!s.pendingFrenzy, 'frenzy'],
    [!!s.pendingRun, 'run'],
    [!!s.pendingFocus, 'focus'],
    [!!s.pendingHeal, 'heal'],
    [!!s.pendingCast, 'cast'],
    [!!s.pendingReload, 'reload'],
    [!!s.pendingStateRecovery, 'stateRecovery'],
    [!!s.pendingAttack, 'attack'],
    [!!s.pendingTest, 'test'],
    [!!s.pendingCorruption, 'corruption'],
  ];
  return order.find(([on]) => on)?.[1] ?? null;
}

const COMPONENT: Record<ModalKey, () => JSX.Element | null> = {
  fateSave: FateSaveModal, fumble: FumbleModal, deviation: DeviationModal, bladeTrap: BladeTrapModal, cleave: CleaveModal,
  trample: TrampleModal, reveal: RevealModal, dualStrike: DualStrikeModal, defense: DefenseModal, psych: PsychModal,
  encounterPsych: EncounterPsychModal, disengage: DisengageModal,
  mountTarget: MountTargetModal, frenzy: FrenzyModal, run: RunModal, focus: FocusModal,
  heal: HealModal, cast: CastModal, reload: ReloadModal, stateRecovery: StateRecoveryModal,
  attack: RollModal, test: TestModal, corruption: CorruptionModal,
};

/**
 * Arbitre de modales (R2) : ne monte QUE la modale de combat la plus prioritaire active — au lieu de ~20
 * modales montées côte à côte dont l'empilement dépendait de l'ordre JSX. Les modales HORS combat
 * (Marchand, Document) ne passent pas par l'arbitre (contexte exclusif).
 */
export function ActiveModal(): JSX.Element | null {
  const key = pickActiveModalKey(useGame());
  if (!key) return null;
  const Comp = COMPONENT[key];
  return <Comp />;
}
