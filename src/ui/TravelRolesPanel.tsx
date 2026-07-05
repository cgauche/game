import { useGame } from '../state/store';
import { activitiesFor, defaultTravelRole } from '../engine/activities';
import { activityAsPoste } from '../state/poste';
import { PostesRoster } from './PostesRoster';

/**
 * Wrapper store des Rôles de marche (Voyage par Étapes, EDOC ch.5) : projette les Activités de voyage
 * en Postes (`activityAsPoste`) et relie le store à la surface roster PARTAGÉE `PostesRoster` (fini le
 * `*View` dupliqué du pendant maritime). Rendu SOUS la règle « Voyage par Étapes » (gating au point
 * d'appel, `WorldMapView`).
 */
export function TravelRolesPanel() {
  const party = useGame((s) => s.party);
  const setTravelRole = useGame((s) => s.setTravelRole);
  const heroes = party.filter((h) => !h.dead && !h.outOfRencontre && h.kind === 'hero');
  return (
    <PostesRoster
      title="Rôles de marche"
      heroes={heroes}
      postes={activitiesFor('voyage').map(activityAsPoste)}
      currentOf={(h) => h.travelRole ?? defaultTravelRole(h)}
      pinnedOf={(h) => h.travelRole}
      onSet={setTravelRole}
    />
  );
}
