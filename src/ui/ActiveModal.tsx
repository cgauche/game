import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { modalOwnerOf } from '../state/modalArbiter';
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
import { MedicModal } from './MedicModal';
import { CastModal } from './CastModal';
import { FumbleModal } from './FumbleModal';
import { RevealModal } from './RevealModal';
import { CorruptionModal } from './CorruptionModal';
import { ActivityModal } from './ActivityModal';

// REGISTRE des modales : state/modalArbiter (une entrée = quand + concerné, ordre = priorité).
// Ajouter une modale = 1 entrée au registre + son composant dans COMPONENT ci-dessous.
export { pickActiveModalKey, type ModalKey } from '../state/modalArbiter';
import { pickActiveModalKey, type ModalKey } from '../state/modalArbiter';

const COMPONENT: Record<ModalKey, () => JSX.Element | null> = {
  fateSave: FateSaveModal, fumble: FumbleModal, deviation: DeviationModal, bladeTrap: BladeTrapModal, renounce: RenounceModal,
  trample: TrampleModal, reveal: RevealModal, defense: DefenseModal, psych: PsychModal,
  encounterPsych: EncounterPsychModal, disengage: DisengageModal,
  mountTarget: MountTargetModal, frenzy: FrenzyModal, approach: ApproachModal, run: RunModal, focus: FocusModal,
  medic: MedicModal, heal: HealModal, cast: CastModal, reload: ReloadModal, stateRecovery: StateRecoveryModal,
  attack: RollModal, test: TestModal, corruption: CorruptionModal, activity: ActivityModal,
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
    const ownerId = modalOwnerOf(s);
    if (ownerId !== '*' && ownerId !== null && !ownsLocally(s, ownerId)) {
      const seat = ownerId ? s.net.ownership[ownerId] ?? 0 : 0;
      return <SpectatorChip name={s.net.seatNames[seat] ?? 'L’hôte'} />;
    }
  }
  const Comp = COMPONENT[key];
  return <Comp />;
}
