import { useGame } from '../state/store';
import { activitiesFor } from '../engine/activities';
import { activityAsPoste } from '../state/poste';
import { PostesRoster } from './PostesRoster';

/**
 * Wrapper store des Rôles de marche (Voyage par Étapes, EDOC 8) : projette les Activités de voyage
 * en Postes (`activityAsPoste`) et relie le store à la surface roster PARTAGÉE `PostesRoster` (fini le
 * `*View` dupliqué du pendant maritime). Rendu SOUS la règle « Voyage par Étapes » (gating au point
 * d'appel, `WorldMapView`).
 *
 * Comme les deux rosters navals, il n'affiche QUE l'ÉPINGLAGE : `defaultTravelRole` n'est pas mort —
 * il EST la résolution (`stageAssignmentFromRoles`, `engine/activities`, lu par `travelFlow`), et c'est
 * l'Étape qui montre l'Activité réellement tenue. Le banc dit donc qui la laisse décider.
 */
export function TravelRolesPanel() {
  const party = useGame((s) => s.party);
  const setTravelRole = useGame((s) => s.setTravelRole);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return (
    <PostesRoster
      title="Rôles de marche"
      banc="À la discrétion de l’Étape"
      heroes={heroes}
      postes={activitiesFor('voyage').map(activityAsPoste)}
      pinnedOf={(h) => h.travelRole}
      onSet={setTravelRole}
      codexCategory="activities"
    />
  );
}
