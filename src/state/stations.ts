/**
 * STATIONS — index PUR des « postes » d'une scène pour une future vue top-down réutilisable : pièces d'artillerie
 * d'équipage (postes navals / emplacements de siège), et plus tard activités et scènes de bataille imbriquées.
 * Une Station est un point d'ancrage + une identité (label/icône/faction/équipage) ; AUCUN effet de règle — la
 * vérité mécanique reste la coque et ses `postes` (cf. `shipPostes.ts`). Module PUR (moteur + state pur, pas de store).
 */
import { isPosteManned } from './shipPostes';
import type { FireArc } from './fireArc';
import type { Combatant, ShipPoste } from '../engine/types';

export type StationKind = 'poste' | 'activity' | 'battleScene';

/** Référence STABLE d'une Station vers son entité-source (l'union est figée dès maintenant ; seul `poste`
 *  est peuplé en phase 1, `activity`/`battleScene` viendront). */
export type StationRef =
  | { kind: 'poste'; hullId: string; posteUid: string }
  | { kind: 'activity'; activityId: string }
  | { kind: 'battleScene'; sceneId: string };

export interface Station {
  id: string;
  kind: StationKind;
  pos: { x: number; y: number; z?: number };
  label: string;
  /** id `ICON_DEFS` (registre `src/ui/icons`) — pièce d'artillerie servie = `action/serve-engine`. */
  icon: string;
  /** Faction dérivée du `kind` de la coque : héros → allié, ennemi → ennemi, PNJ → neutre. */
  faction: 'ally' | 'enemy' | 'neutral';
  assignedIds: string[];
  manned: boolean;
  side?: FireArc;
  ref: StationRef;
}

const FACTION: Record<Combatant['kind'], Station['faction']> = { hero: 'ally', enemy: 'enemy', npc: 'neutral' };

/**
 * Indexe en Stations chaque poste des Combattants-coque (coque navale OU emplacement de siège — indifférent).
 * `anchorOf` résout la position spatiale de la pièce ; par défaut = la position de la coque (trivial pour un
 * emplacement au sol ; le consommateur naval injectera `posteAnchor` avec le cap). Un poste dont l'ancre est
 * indéfinie est ignoré. Le label et l'état d'équipage réutilisent les sources uniques existantes
 * (`poste.item.name`, `isPosteManned`). PUR.
 */
export function postesToStations(
  combatants: Combatant[],
  anchorOf: (hull: Combatant, poste: ShipPoste) => { x: number; y: number; z?: number } | undefined = (hull) => hull.pos,
): Station[] {
  const out: Station[] = [];
  for (const hull of combatants) {
    if (!hull.postes?.length) continue;
    for (const poste of hull.postes) {
      const pos = anchorOf(hull, poste);
      if (!pos) continue;
      out.push({
        id: `poste:${hull.id}:${poste.item.uid}`,
        kind: 'poste',
        pos,
        label: poste.item.name,
        icon: 'action/serve-engine',
        faction: FACTION[hull.kind],
        assignedIds: poste.crewIds ?? [],
        manned: isPosteManned(poste, combatants),
        side: poste.side,
        ref: { kind: 'poste', hullId: hull.id, posteUid: poste.item.uid },
      });
    }
  }
  return out;
}
