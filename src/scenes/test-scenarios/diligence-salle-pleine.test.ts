import { describe, it, expect } from 'vitest';
import { scenario } from './diligence-salle-pleine';
import { seatSlotsOf } from '../../state/seating';
import { validateScene } from '../../state/validateScene';
import { isWalkable } from '../../state/scene';

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
    expect(depart!.pos).toEqual({ x: 13, y: 14 });
    expect(cases.has('13,14')).toBe(true);
    // La case de départ est LIBRE : ni meuble, ni abord de place (le groupe n'apparaît pas sur un
    // convive attablé).
    const meubles = new Set(scene.entities.filter((e) => e.kind === 'prop').map((e) => `${e.pos.x},${e.pos.y}`));
    const abords = new Set(tables.flatMap((t) => seatSlotsOf(scene, t).map((s) => `${s.approach.x},${s.approach.y}`)));
    expect(meubles.has('13,14')).toBe(false);
    expect(abords.has('13,14')).toBe(false);
  });

  /**
   * CÔTÉ CLIENTS — les deux critères que le document invoque pour cette case
   * (`diligence-salle-pleine.ts` § DEPART), tous deux DÉRIVÉS du meublage, jamais écrits en dur ici.
   * Les colonnes de comptoir donnent le bar (la plus fournie) et le mur ouest (la suivante) :
   *  · le PASSAGE traversant = les cases restées libres DANS la colonne du bar, entre son premier et
   *    son dernier module — la seule desserte entre la salle et le côté du tenancier ;
   *  · la RUELLE de service = les cases marchables ENTRE les deux colonnes, sur la même bande de
   *    rangs — l'allée derrière la barre et les creux de ses plans de travail (le test spatial de la
   *    salle la nomme case par case, `diligence/diligence-mobilier-spatial.test.ts` § RUELLE).
   * Le groupe entre en client : il ne se matérialise ni dans la desserte, ni derrière le comptoir.
   */
  it('le groupe démarre côté CLIENTS : ni dans le passage traversant, ni dans la ruelle du tenancier', () => {
    const comptoirs = scene.entities.filter((e) => e.kind === 'prop' && (e.ref ?? '').startsWith('comptoir'));
    const parColonne = new Map<number, number[]>();
    for (const c of comptoirs) parColonne.set(c.pos.x, [...(parColonne.get(c.pos.x) ?? []), c.pos.y]);
    const colonnes = [...parColonne.entries()].sort((a, b) => b[1].length - a[1].length);
    const [colonne, ys] = colonnes[0];
    const [colonneMur] = colonnes[1];
    const modules = new Set(ys);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const passage: string[] = [];
    for (let y = y0; y <= y1; y++)
      if (!modules.has(y) && isWalkable(scene, colonne, y, 0)) passage.push(`${colonne},${y}`);
    const ruelle: string[] = [];
    for (let x = colonneMur; x < colonne; x++)
      for (let y = y0; y <= y1; y++) if (isWalkable(scene, x, y, 0)) ruelle.push(`${x},${y}`);
    // TÉMOINS de dérivation — les deux ensembles nomment bien la desserte et l'allée de service.
    expect(passage, 'passage du bar').toEqual(['12,14', '12,15']);
    expect(ruelle.sort(), 'allée du tenancier et creux de ses plans de travail')
      .toEqual(['10,11', '10,14', '10,15', '10,16', '11,10', '11,11', '11,12', '11,13', '11,14', '11,15']);

    const depart = scene.entities.find((e) => e.kind === 'heroStart')!;
    const caseDepart = `${depart.pos.x},${depart.pos.y}`;
    expect(passage).not.toContain(caseDepart);
    expect(ruelle).not.toContain(caseDepart);
  });

  it('le document est valide — aucune erreur de validation de scène', () => {
    const erreurs = validateScene([scene]).filter((w) => w.level === 'error');
    expect(erreurs.map((e) => e.message)).toEqual([]);
  });
});
