/**
 * Registre des POSSESSIONS d'un héros (#649) — la fiche n'affichait que `hero.items` (Sac) : une
 * monture/un véhicule/un serviteur semé au registre `state.possessions` restait invisible côté
 * joueur. Affichage EN LECTURE SEULE (pas de gestion/transfert ici) — groupé par `nature`, une
 * `Band` par groupe non vide, une `PlaqueRow` par possession (même patron que le Sac, `CharacterSheet.tsx`).
 *
 * Helpers de présentation (`NATURE_*`/`prefixOf`/`labelOf`/`locationBadge`) EXPORTÉS — réutilisés tels
 * quels par `PossessionsScreen.tsx` (#620 Lot 2, écran de gestion) : source unique du vocabulaire
 * visuel d'une Possession, jamais une 2e copie.
 */
import type { ReactNode } from 'react';
import type { Combatant } from '../engine/types';
import type { Possession } from '../engine/possession';
import { possessionLabel, possessionCapacity, possessionTotalEnc } from '../engine/possession';
import type { MountInjury } from '../engine/mountTravel';
import { useGame } from '../state/store';
import { ownedPossessions } from '../state/possessionsFlow';
import { placeById } from '../state/worldMap';
import { Band } from './Band';
import { PlaqueRow } from './PlaqueRow';
import { LifeBar } from './LifeBar';
import { ItemIcon } from './ItemIcon';
import { Icon } from './Icon';
import { CodexRef } from './compendium/CodexRef';
import { woundsTone } from './gaugeTones';
import { findVehicleById } from '../data';

export const NATURE_ORDER: Possession['nature'][] = ['bete', 'vehicule', 'navire', 'serviteur', 'immeuble'];

export const NATURE_TITLE: Record<Possession['nature'], string> = {
  bete: 'Montures & bêtes',
  vehicule: 'Véhicules',
  navire: 'Navires',
  serviteur: 'Serviteurs',
  immeuble: 'Immeubles',
};

export const NATURE_ICON: Record<Possession['nature'], string> = {
  bete: 'travel/mount',
  vehicule: 'travel/cart',
  navire: 'travel/sail-ship',
  serviteur: 'map-tool/npc',
  immeuble: 'rest/home',
};

export const MOUNT_INJURY_LABEL: Record<MountInjury, string> = {
  'sangle-cassee': 'Sangle cassée',
  'perte-d-un-fer': 'Perte d’un fer',
  boiteux: 'Boiteux',
  'patte-brisee': 'Patte brisée',
};

export function locationBadge(p: Possession, worldMap: ReturnType<typeof useGame.getState>['worldMap']): ReactNode {
  if (p.location.kind === 'avec-le-groupe') return null;
  if (p.location.kind === 'embarquee') return <span className="chip">Embarquée</span>;
  const label = (worldMap && placeById(worldMap, p.location.placeId)?.label) ?? p.location.placeId;
  return <span className="chip">À l’écurie · {label}</span>;
}

export function prefixOf(p: Possession): ReactNode {
  if (p.nature === 'vehicule' || p.nature === 'navire') {
    const icon = findVehicleById(p.vehicleId)?.icon ?? NATURE_ICON[p.nature];
    return <Icon id={icon} size="sm" />;
  }
  return <Icon id={NATURE_ICON[p.nature]} size="sm" />;
}

export function labelOf(p: Possession): ReactNode {
  const label = possessionLabel(p);
  if ((p.nature === 'bete' || p.nature === 'serviteur') && 'creatureId' in p.ref) {
    return <CodexRef category="creatures" id={p.ref.creatureId} label={label} />;
  }
  if ((p.nature === 'vehicule' || p.nature === 'navire')) {
    return <CodexRef category="vehicles" id={p.vehicleId} label={label} />;
  }
  return label;
}

function PossessionRow({ p, allPossessions }: { p: Possession; allPossessions: Possession[] }) {
  const worldMap = useGame((s) => s.worldMap);
  const badges: ReactNode[] = [];
  if (p.nature === 'bete' && p.mountInjury) {
    badges.push(<span key="injury" className="chip tone-warn">{MOUNT_INJURY_LABEL[p.mountInjury]}</span>);
  }
  const locBadge = locationBadge(p, worldMap);
  if (locBadge) badges.push(<span key="loc">{locBadge}</span>);

  const capacity = possessionCapacity(p);
  const carried = possessionTotalEnc(p, allPossessions);

  return (
    <div className="inv-item">
      <PlaqueRow
        valueMuted
        prefix={prefixOf(p)}
        content={labelOf(p)}
        meta={badges.length ? <>{badges}</> : undefined}
        value={capacity != null ? <>Enc {carried}/{capacity}</> : <>Enc {carried}</>}
      />
      {'wounds' in p && p.wounds && (
        <LifeBar value={p.wounds.current} max={p.wounds.max} tone={woundsTone} label="Blessures" />
      )}
      {(p.items.length > 0 || (p.cargo?.length ?? 0) > 0) && (
        <div className="inv-nested">
          {p.items.slice(0, 6).map((it) => (
            <span key={it.uid} className="chip">
              <ItemIcon item={it} size="sm" /> {it.label}
            </span>
          ))}
          {p.items.length > 6 && <span className="chip">+{p.items.length - 6}</span>}
          {(p.cargo?.length ?? 0) > 0 && (
            <span className="chip">{p.cargo!.length} lot{p.cargo!.length > 1 ? 's' : ''} de cargaison</span>
          )}
        </div>
      )}
    </div>
  );
}

export function PossessionsRegistry({ hero }: { hero: Combatant }) {
  const possessions = useGame((s) => s.possessions);
  const owned = ownedPossessions(possessions, hero.id).filter((p) => !p.destroyed);
  if (owned.length === 0) return null;

  const groups = NATURE_ORDER.map((nature) => ({ nature, items: owned.filter((p) => p.nature === nature) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <>
      {groups.map((g) => (
        <Band key={g.nature} title={NATURE_TITLE[g.nature]} right={<span className="muted">{g.items.length}</span>}>
          {g.items.map((p) => (
            <PossessionRow key={p.uid} p={p} allPossessions={possessions} />
          ))}
        </Band>
      ))}
    </>
  );
}
