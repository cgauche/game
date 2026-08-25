import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { RING_A_PX } from './dynamicMarks';
import { HALO_RX_PX, haloRadiusK, interactionHalos, NO_INTERACTION_HALOS } from './interactHalos';
import type { BillboardPropEl } from './types';

/**
 * DÉRIVATION des halos d'interaction (#1176, P3-0g) : c'est ELLE qui décide qui appelle le
 * joueur — un décor fouillable non épuisé, un PNJ interlocuteur sous le curseur. Le rendu la consomme
 * SANS rien re-décider ; ce qu'il ne pourrait pas rattraper, c'est un halo dérivé pour un objet déjà
 * fouillé.
 */
function décor(id: string, x: number, y: number, extra: Partial<BillboardPropEl> = {}): BillboardPropEl {
  return {
    kind: 'prop',
    key: `prop:${id}`,
    cell: { x, y, z: 0 },
    source: 'entity',
    entId: id,
    ref: 'tonneau',
    foot: { offX: 0, offY: 0, scale: 1 },
    interact: true,
    states: { visible: true },
    ...extra,
  };
}

function scèneAvec(...entities: SceneEntity[]): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, ...entities] };
}

const pnj = (id: string, x: number, y: number, extra: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id, kind: 'personnage', pos: { x, y }, dialogueId: 'd1', ...extra }) as SceneEntity;

const EXPLORE = { exploring: true, combat: false };

describe('Halos d’interaction — le décor FOUILLABLE (#1176 P3-0g)', () => {
  it('un décor interactif porte un halo ; le flag d’épuisement l’éteint', () => {
    const els = [décor('coffre', 3, 4)];
    const vivants = interactionHalos(els, scèneAvec(), {}, null, EXPLORE);
    expect(vivants.fouilles.map((h) => h.id)).toEqual(['coffre']);
    expect(interactionHalos(els, scèneAvec(), { __fouille_coffre: true }, null, EXPLORE).fouilles).toHaveLength(0);
    // et le flag d'un AUTRE décor n'éteint pas celui-ci
    expect(interactionHalos(els, scèneAvec(), { __fouille_tonneau: true }, null, EXPLORE).fouilles).toHaveLength(1);
  });

  it('ni un décor NON interactif ni un overlay de TERRAIN n’appellent le joueur', () => {
    const els = [
      décor('mort', 1, 1, { interact: false }),
      { ...décor('arbre', 2, 2), source: 'terrain' as const, entId: undefined, interact: false },
    ];
    expect(interactionHalos(els, scèneAvec(), {}, null, EXPLORE).fouilles).toHaveLength(0);
  });

  it('le halo est aux PIEDS du décor : le centre de l’empreinte, et son étage', () => {
    const [h] = interactionHalos(
      [décor('epave', 4, 6, { cell: { x: 4, y: 6, z: 2 }, span: { w: 2, h: 2 }, foot: { offX: 0.5, offY: 0.5, scale: 2 } })],
      scèneAvec(),
      {},
      null,
      EXPLORE,
    ).fouilles;
    expect(h.cell).toEqual({ x: 4, y: 6, z: 2 });
    expect(h.centre).toEqual({ x: 4.5, y: 6.5 });
    expect(h.span).toEqual({ w: 2, h: 2 });
    expect(h.scale, 'un grand décor porte un grand halo').toBe(2);
  });

  it('le SURVOL renforce le halo — sur SA case, à SON étage, et seulement en exploration', () => {
    const els = [décor('coffre', 3, 4, { cell: { x: 3, y: 4, z: 1 } })];
    const survolé = (hover: { x: number; y: number; z?: number } | null, ctx = EXPLORE) =>
      interactionHalos(els, scèneAvec(), {}, hover, ctx).fouilles[0].hovered;
    expect(survolé({ x: 3, y: 4, z: 1 })).toBe(true);
    expect(survolé({ x: 3, y: 4, z: 0 }), 'un étage plus bas n’est pas ce décor').toBe(false);
    expect(survolé({ x: 3, y: 5, z: 1 })).toBe(false);
    expect(survolé(null)).toBe(false);
    expect(survolé({ x: 3, y: 4, z: 1 }, { exploring: false, combat: false }), 'hors exploration, pas de renfort').toBe(false);
  });

  it('le RAYON monde du halo est la projection de l’ellipse affine — la même loi que l’anneau d’équipe', () => {
    // l'affine trace `rx = 17·échelle` px ; `RING_A_PX` px valent UNE case de rayon monde.
    expect(haloRadiusK(HALO_RX_PX)).toBeCloseTo(HALO_RX_PX / RING_A_PX, 12);
    expect(haloRadiusK(HALO_RX_PX) * RING_A_PX).toBeCloseTo(HALO_RX_PX, 12);
  });
});

describe('Halos d’interaction — le PNJ INTERLOCUTEUR (#1176 P3-0g)', () => {
  it('révélé au SURVOL seul, et jamais sans interlocution', () => {
    const scène = scèneAvec(pnj('marchand', 5, 5), pnj('badaud', 6, 5, { dialogueId: undefined }));
    expect(interactionHalos([], scène, {}, null, EXPLORE).pnjs, 'aucun survol, aucun halo').toHaveLength(0);
    expect(interactionHalos([], scène, {}, { x: 5, y: 5 }, EXPLORE).pnjs.map((p) => p.id)).toEqual(['marchand']);
    expect(interactionHalos([], scène, {}, { x: 6, y: 5 }, EXPLORE).pnjs, 'un badaud sans dialogue ne s’allume pas').toHaveLength(0);
  });

  it('un MARCHAND sans dialogue s’allume quand même (il ouvre son panneau)', () => {
    const scène = scèneAvec(pnj('etal', 2, 2, { dialogueId: undefined, merchant: { archetype: 'general' } } as Partial<SceneEntity>));
    expect(interactionHalos([], scène, {}, { x: 2, y: 2 }, EXPLORE).pnjs.map((p) => p.id)).toEqual(['etal']);
  });

  it('en COMBAT, aucun halo de PNJ — le survol y sert au ciblage', () => {
    const scène = scèneAvec(pnj('marchand', 5, 5));
    expect(interactionHalos([], scène, {}, { x: 5, y: 5 }, { exploring: false, combat: true }).pnjs).toHaveLength(0);
    // mais le décor fouillable, lui, garde son halo permanent
    expect(interactionHalos([décor('coffre', 3, 4)], scène, {}, { x: 5, y: 5 }, { exploring: false, combat: true }).fouilles).toHaveLength(1);
  });

  it('un MEUBLE À PLACES appelle le joueur SANS porter `interact`, et s’éteint quand tout est pris', () => {
    const table: SceneEntity = { id: 'table-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'N' };
    const el = décor('table-1', 3, 3, { interact: false, ref: 'table-ronde-4-tabourets' });
    const libre = scèneAvec(table);
    expect(interactionHalos([el], libre, {}, null, EXPLORE).fouilles.map((h) => h.id)).toEqual(['table-1']);

    const pleine = { ...libre, seatAssignments: { 'table-1': Object.fromEntries(['nord', 'est', 'sud', 'ouest'].map((s) => [s, { kind: 'entity' as const, entityId: `pnj-${s}` }])) } };
    expect(interactionHalos([el], pleine, {}, null, EXPLORE).fouilles).toHaveLength(0);

    // Le flag de FOUILLE n'a aucune prise sur une place : ce n'est pas une ressource qui s'épuise.
    expect(interactionHalos([el], libre, { __fouille_table_1: true, '__fouille_table-1': true }, null, EXPLORE).fouilles).toHaveLength(1);
  });

  it('la valeur VIDE est gelée — une voie ne peut pas la salir pour l’autre', () => {
    expect(Object.isFrozen(NO_INTERACTION_HALOS)).toBe(true);
    expect(Object.isFrozen(NO_INTERACTION_HALOS.fouilles)).toBe(true);
    expect(Object.isFrozen(NO_INTERACTION_HALOS.pnjs)).toBe(true);
  });
});
