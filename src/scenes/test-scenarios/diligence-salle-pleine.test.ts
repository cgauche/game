import { describe, it, expect } from 'vitest';
import { scenario } from './diligence-salle-pleine';
import { seatSlotsOf } from '../../state/seating';
import { validateScene } from '../../state/validateScene';

/** La salle de La Diligence VUE HABITÉE : chaque place de chaque table porte un convive authoré,
 *  posé sur l'abord EFFECTIF de sa place (invariant de document, `seating.ts`). */
describe('La Diligence — salle pleine', () => {
  const scene = scenario.scene;
  const convives = scene.entities.filter((e) => e.kind === 'personnage' && e.id.startsWith('diligence-convive-'));
  const tables = ['diligence-salle-table-ronde-1', 'diligence-salle-table-ronde-2', 'diligence-salle-table-ronde-3',
    'diligence-salle-table-murale-1', 'diligence-salle-table-murale-2'];

  it('16 convives, un par place — toutes les places des 5 tables sont occupées', () => {
    expect(convives).toHaveLength(16);
    const places = tables.flatMap((t) => seatSlotsOf(scene, t).map((s) => `${t}/${s.slotId}`));
    expect(places).toHaveLength(16);
    const occupees = Object.entries(scene.seatAssignments ?? {})
      .flatMap(([propId, parMeuble]) => Object.keys(parMeuble).map((slotId) => `${propId}/${slotId}`));
    expect(occupees.sort()).toEqual(places.sort());
    const occupants = Object.values(scene.seatAssignments ?? {})
      .flatMap((parMeuble) => Object.values(parMeuble))
      .map((o) => (o.kind === 'entity' ? o.entityId : `party-${o.rang}`));
    expect(new Set(occupants).size).toBe(16);
    expect(occupants.sort()).toEqual(convives.map((c) => c.id).sort());
  });

  it('chaque convive est posé sur l’abord effectif de SA place', () => {
    for (const propId of tables) {
      for (const slot of seatSlotsOf(scene, propId)) {
        const occupant = scene.seatAssignments?.[propId]?.[slot.slotId];
        expect(occupant, `${propId}/${slot.slotId}`).toBeDefined();
        const id = occupant!.kind === 'entity' ? occupant!.entityId : '';
        const pnj = scene.entities.find((e) => e.id === id);
        expect(pnj!.pos, `${id} @ ${propId}/${slot.slotId}`).toEqual({ x: slot.approach.x, y: slot.approach.y });
      }
    }
  });

  it('tous les convives sont dans la salle (zone-S-z0), et le groupe démarre au milieu', () => {
    const salle = scene.effectZones?.find((z) => z.id === 'zone-S-z0');
    const cases = new Set((salle!.tiles ?? []).map((t) => `${t.x},${t.y}`));
    for (const c of convives) expect(cases.has(`${c.pos.x},${c.pos.y}`), `${c.id} en (${c.pos.x},${c.pos.y})`).toBe(true);
    const depart = scene.entities.find((e) => e.kind === 'heroStart');
    expect(depart!.pos).toEqual({ x: 12, y: 14 });
    expect(cases.has('12,14')).toBe(true);
  });

  it('le document est valide — aucune erreur de validation de scène', () => {
    const erreurs = validateScene([scene]).filter((w) => w.level === 'error');
    expect(erreurs.map((e) => e.message)).toEqual([]);
  });
});
