/**
 * Champ d'AUTHORING des places assises d'un décor (`Scene.seatAssignments`) — une rangée par place
 * déclarée par le type de meuble, dans l'ordre du catalogue.
 *
 * ID-ONLY : chaque place se remplit par un `<select>` dont les valeurs sont des ids d'entités de la
 * scène (le libellé n'est que de l'affichage) ; aucune saisie libre, aucun nom tapé à la main. Les
 * héros ne sont proposés que si le DOCUMENT en nomme déjà un — l'éditeur ne connaît pas le groupe de
 * la partie.
 *
 * ATOMIQUE : le geste passe par `seatOccupant`/`releaseSeat`, qui posent la `pos` du corps sur l'abord
 * résolu de sa place ; un refus se dit en toutes lettres et n'écrit rien.
 */
import { useState } from 'react';
import type { Scene } from '../../state/scene';
import { releaseSeat, seatSlotsOf, type SeatAssignmentResult, type SeatOccupant } from '../../state/seating';
import { seatOccupant } from '../../state/sceneEdit';

/** Motif de refus d'`assignSeat`, dit à l'auteur. */
const REFUS: Record<Exclude<SeatAssignmentResult, { ok: true }>['reason'], string> = {
  'prop-absent': 'ce décor n’est plus dans la scène',
  'slot-absent': 'ce type de décor n’offre pas cette place',
  'occupant-absent': 'ce corps n’est pas dans la scène',
  'occupant-assis': 'ce corps tient déjà une autre place',
  'slot-occupe': 'cette place est déjà tenue',
  'approche-invalide': 'aucun abord libre et praticable ne dessert cette place',
};

/** Valeur de `<select>` d'un occupant : préfixée par sa nature, pour qu'un id de héros et un id
 *  d'entité ne se confondent jamais. */
const valueOf = (occupant: SeatOccupant): string =>
  occupant.kind === 'party' ? `party:${occupant.heroId}` : `entity:${occupant.entityId}`;

const occupantOf = (value: string): SeatOccupant =>
  value.startsWith('party:') ? { kind: 'party', heroId: value.slice(6) } : { kind: 'entity', entityId: value.slice(7) };

export function SeatAssignmentsField({
  scene,
  propId,
  onChange,
}: {
  scene: Scene;
  propId: string;
  onChange: (scene: Scene) => void;
}) {
  const [refus, setRefus] = useState<string | null>(null);
  const places = seatSlotsOf(scene, propId);
  if (!places.length) return null;

  const parMeuble = scene.seatAssignments?.[propId] ?? {};
  const pnjs = scene.entities.filter((e) => e.kind === 'personnage');
  /** Héros nommés par le document lui-même — jamais une liste de groupe, que l'éditeur ne connaît pas. */
  const heros = [
    ...new Set(
      Object.values(scene.seatAssignments ?? {}).flatMap((occupation) =>
        Object.values(occupation).flatMap((occupant) => (occupant.kind === 'party' ? [occupant.heroId] : [])),
      ),
    ),
  ];

  const choisir = (slotId: string, value: string) => {
    setRefus(null);
    const tenant = parMeuble[slotId];
    let base = tenant ? releaseSeat(scene, tenant) : scene;
    if (!value) { onChange(base); return; }
    const occupant = occupantOf(value);
    base = releaseSeat(base, occupant); // rasseoir un corps le DÉPLACE : un corps, une place
    const res = seatOccupant(base, propId, slotId, occupant);
    if (!res.ok) { setRefus(REFUS[res.reason]); return; }
    onChange(res.scene);
  };

  return (
    <div className="ed-field">
      <span className="mini-title">
        Places assises — {places.length} place{places.length > 1 ? 's' : ''}
      </span>
      {places.map((place) => (
        <label className="ed-field" key={place.slotId}>
          Place {place.slotId}
          <select value={parMeuble[place.slotId] ? valueOf(parMeuble[place.slotId]) : ''} onChange={(e) => choisir(place.slotId, e.target.value)}>
            <option value="">— personne —</option>
            {pnjs.map((pnj) => (
              <option key={pnj.id} value={`entity:${pnj.id}`}>
                {pnj.label ? `${pnj.label} (${pnj.id})` : pnj.id}
              </option>
            ))}
            {heros.map((heroId) => (
              <option key={heroId} value={`party:${heroId}`}>
                Héros {heroId}
              </option>
            ))}
          </select>
        </label>
      ))}
      <p className="hint">
        Le corps assis se tient sur l’abord de sa place : sa position suit le meuble, elle ne se pose pas à la main.
      </p>
      {refus && <p className="hint" role="alert">Place refusée : {refus}.</p>}
    </div>
  );
}
