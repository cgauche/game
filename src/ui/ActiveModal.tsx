import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { modalOwnerOf } from '../state/modalArbiter';
import { willAutoResolve } from '../state/combatAuto';
import type { JSX } from 'react';
import { ReloadModal } from './ReloadModal';
import { StateRecoveryModal } from './StateRecoveryModal';
import { RenounceModal } from './RenounceModal';
import { MountTargetModal } from './MountTargetModal';
import { FateSaveModal } from './FateSaveModal';
import { TrampleModal } from './TrampleModal';
import { ManeuverModal } from './ManeuverModal';
import { RunModal } from './RunModal';
import { ShipManeuverModal } from './ShipManeuverModal';
import { ShipBatteryModal } from './ShipBatteryModal';
import { ApproachModal } from './ApproachModal';
import { WardModal } from './WardModal';
import { FocusModal } from './FocusModal';
import { DispelModal } from './DispelModal';
import { FrenzyModal } from './FrenzyModal';
import { AuContactModal } from './AuContactModal';
import { GrappleModal } from './GrappleModal';
import { HealModal } from './HealModal';
import { MedicModal } from './MedicModal';
import { RestModal } from './RestModal';
// CastModal n'est plus monté ici : la situation d'incantation est une étape `jet:'cast'` de la
// cascade (rendue par `CascadeModal`, qui hôte `CastModal`) — cf. state/modalArbiter (entrée `cast` retirée).
import { CascadeModal } from './CascadeModal';
import { RevealModal } from './RevealModal';
import { CorruptionModal } from './CorruptionModal';
import { ActivityModal } from './ActivityModal';

// REGISTRE des modales : state/modalArbiter (une entrée = quand + concerné, ordre = priorité).
// Ajouter une modale = 1 entrée au registre + son composant dans COMPONENT ci-dessous.
export { pickActiveModalKey, type ModalKey } from '../state/modalArbiter';
import { pickActiveModalKey, type ModalKey } from '../state/modalArbiter';

const COMPONENT: Record<ModalKey, () => JSX.Element | null> = {
  fateSave: FateSaveModal, renounce: RenounceModal,
  trample: TrampleModal, maneuver: ManeuverModal, reveal: RevealModal,
  mountTarget: MountTargetModal, frenzy: FrenzyModal, auContact: AuContactModal, grapple: GrappleModal, approach: ApproachModal, ward: WardModal, run: RunModal, shipManeuver: ShipManeuverModal, shipBattery: ShipBatteryModal, focus: FocusModal, dispel: DispelModal,
  medic: MedicModal, rest: RestModal, heal: HealModal, cascade: CascadeModal, reload: ReloadModal, stateRecovery: StateRecoveryModal,
  corruption: CorruptionModal, activity: ActivityModal,
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
  // Cadence Rapide/Auto : si le driver va auto-résoudre cette modale, NE PAS la rendre (fini le flash
  // de quelques ms). Le BILAN voyage/nuit et les vrais choix (surincantation/Destin en Rapide) restent rendus.
  if (willAutoResolve(s)) return null;
  if (s.net.mode !== 'local') {
    const ownerId = modalOwnerOf(s);
    if (ownerId !== '*' && ownerId !== null && !ownsLocally(s, ownerId)) {
      // Anti-doublon : pendant le TOUR d'un héros distant, la barre d'action affiche déjà
      // « ⏳ X joue Héros… » — la puce ne sert que si la modale concerne un AUTRE combattant
      // (ex. défense réactive d'un héros distant pendant un tour ennemi).
      const activeId = s.battle && !s.battle.over ? s.battle.order[s.battle.turn] : undefined;
      if (ownerId !== undefined && ownerId === activeId) return null;
      const seat = ownerId ? s.net.ownership[ownerId] ?? 0 : 0;
      return <SpectatorChip name={s.net.seatNames[seat] ?? 'L’hôte'} />;
    }
  }
  const Comp = COMPONENT[key];
  return <Comp />;
}
