import { useGame } from '../state/store';
import { crewRoles } from '../data';
import { defaultCrewRole } from '../engine/crewMorale';
import { crewRoleAsPoste } from '../state/poste';
import { PostesRoster } from './PostesRoster';

/**
 * Wrapper store des Postes d'équipage naval (MDG ch.14) : projette les rôles d'équipage en Postes
 * (`crewRoleAsPoste`) et relie le store à la surface roster PARTAGÉE `PostesRoster` (pendant maritime
 * de `TravelRolesPanel`, désormais le MÊME composant). Rendu à l'appareillage (route maritime + navire
 * de campagne, gating au point d'appel, `WorldMapView`). `setShipRole` patche party ET battle.combatants.
 */
export function ShipRolesPanel() {
  const party = useGame((s) => s.party);
  const setShipRole = useGame((s) => s.setShipRole);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return (
    <PostesRoster
      title="Postes d’équipage"
      heroes={heroes}
      postes={crewRoles.map(crewRoleAsPoste)}
      currentOf={(h) => h.shipRole ?? defaultCrewRole(h)}
      pinnedOf={(h) => h.shipRole}
      onSet={setShipRole}
    />
  );
}
