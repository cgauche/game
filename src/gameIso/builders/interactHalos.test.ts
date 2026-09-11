import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../../state/scene';
import { RING_A_PX } from './dynamicMarks';
import { HALO_RX_PX, haloRadiusK, interactionHalos, NO_INTERACTION_HALOS } from './interactHalos';
import { cleActionJouee } from '../../state/usable';
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
    states: { visible: true },
    ...extra,
  };
}

/** L'ENTITÉ derrière l'élément de décor : l'élément de rendu ne porte plus AUCUNE offre, le halo la
 *  dérive de la scène (`actionsDe`). Un geste authoré non épuisé est tout ce qu'il demande. */
const fouillable = (id: string, x = 0, y = 0): SceneEntity => ({
  id, kind: 'prop', pos: { x, y }, ref: 'tonneau',
  usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
});

function scèneAvec(...entities: SceneEntity[]): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, ...entities] };
}

const pnj = (id: string, x: number, y: number, extra: Partial<SceneEntity> = {}): SceneEntity =>
  ({ id, kind: 'personnage', pos: { x, y }, dialogueId: 'd1', ...extra }) as SceneEntity;

const EXPLORE = { exploring: true, combat: false };

describe('Halos d’interaction — le décor FOUILLABLE (#1176 P3-0g)', () => {
  it('un décor à geste authoré porte un halo ; le drapeau d’épuisement l’éteint', () => {
    const els = [décor('coffre', 3, 4)];
    const sc = scèneAvec(fouillable('coffre', 3, 4));
    expect(interactionHalos(els, sc, {}, null, EXPLORE).fouilles.map((h) => h.id)).toEqual(['coffre']);
    expect(interactionHalos(els, sc, { [cleActionJouee('coffre', 'fouiller')]: true }, null, EXPLORE).fouilles).toHaveLength(0);
    // et le drapeau d'un AUTRE décor n'éteint pas celui-ci
    expect(interactionHalos(els, sc, { [cleActionJouee('tonneau', 'fouiller')]: true }, null, EXPLORE).fouilles).toHaveLength(1);
  });

  it('UNE action épuisée sur DEUX n’éteint rien : le halo s’éteint quand il ne reste PLUS RIEN à jouer', () => {
    const deux: SceneEntity = {
      id: 'coffre', kind: 'prop', pos: { x: 3, y: 4 }, ref: 'tonneau',
      usable: { actions: [
        { id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true },
        { id: 'ouvrir', flow: { kind: 'seq', steps: [] }, unique: true },
      ] },
    };
    const els = [décor('coffre', 3, 4)];
    const sc = scèneAvec(deux);
    const une = { [cleActionJouee('coffre', 'fouiller')]: true };
    expect(interactionHalos(els, sc, une, null, EXPLORE).fouilles).toHaveLength(1);
    expect(interactionHalos(els, sc, { ...une, [cleActionJouee('coffre', 'ouvrir')]: true }, null, EXPLORE).fouilles).toHaveLength(0);
  });

  it('ni un décor SANS offre ni un overlay de TERRAIN n’appellent le joueur', () => {
    const nu: SceneEntity = { id: 'mort', kind: 'prop', pos: { x: 1, y: 1 }, ref: 'tonneau' };
    const els = [
      décor('mort', 1, 1),
      { ...décor('arbre', 2, 2), source: 'terrain' as const, entId: undefined },
    ];
    expect(interactionHalos(els, scèneAvec(nu), {}, null, EXPLORE).fouilles).toHaveLength(0);
  });

  it('le halo est aux PIEDS du décor : le centre de l’empreinte, et son étage', () => {
    const [h] = interactionHalos(
      [décor('epave', 4, 6, { cell: { x: 4, y: 6, z: 2 }, span: { w: 2, h: 2 }, foot: { offX: 0.5, offY: 0.5, scale: 2 } })],
      scèneAvec(fouillable('epave')),
      {},
      null,
      EXPLORE,
    ).fouilles;
    expect(h.cell).toEqual({ x: 4, y: 6, z: 2 });
    expect(h.centre).toEqual({ x: 4.5, y: 6.5 });
    expect(h.span).toEqual({ w: 2, h: 2 });
    expect(h.echelle, 'un grand décor porte un grand halo').toEqual({ x: 2, y: 2 });
  });

  /**
   * LE HALO ÉPOUSE L'EMPREINTE, AXE PAR AXE (#1509 L9′). Un facteur ISOTROPE (le côté max) faisait
   * déborder le halo d'une demi-case sur l'axe COURT : sur les tables murales de la Diligence (1×2,
   * dos au mur est), l'anneau doré passait à travers la cloison, dans la pièce voisine. Ce que ce
   * contrat tient, c'est la CONTENANCE : le halo tient dans le bloc de cases du décor, et rien d'autre
   * ne change pour les décors d'une case.
   */
  it('l’échelle du halo suit CHAQUE axe de l’empreinte, et le halo tient dans son bloc de cases', () => {
    const murale = décor('murale', 14, 11, { span: { w: 1, h: 2 }, foot: { offX: 0, offY: 0.5, scale: 2 } });
    const [h] = interactionHalos([murale], scèneAvec(fouillable('murale')), {}, null, EXPLORE).fouilles;
    expect(h.echelle, 'un 1×2 ne grandit que sur y').toEqual({ x: 1, y: 2 });
    // CONTENANCE, en cases : demi-axes du halo (rayon monde × échelle) contre le demi-bloc (w/2, h/2).
    const demi = { x: haloRadiusK(HALO_RX_PX) * h.echelle.x, y: haloRadiusK(HALO_RX_PX) * h.echelle.y };
    expect(demi.x, 'axe court : le halo reste dans la case, jamais dans le mur').toBeLessThanOrEqual(h.span.w / 2);
    expect(demi.y, 'axe long : le halo reste dans les deux cases').toBeLessThanOrEqual(h.span.h / 2);
  });

  /** Les décors d'UNE case ne bougent pas d'un flottant : leur halo reste le cercle qu'il était. */
  it('un décor 1×1 garde un halo ISOTROPE (contrat de non-régression)', () => {
    const [h] = interactionHalos([décor('coffre', 3, 4)], scèneAvec(fouillable('coffre')), {}, null, EXPLORE).fouilles;
    expect(h.echelle).toEqual({ x: 1, y: 1 });
    expect(h.centre).toEqual({ x: 3, y: 4 });
  });

  it('le SURVOL renforce le halo — sur SA case, à SON étage, et seulement en exploration', () => {
    const els = [décor('coffre', 3, 4, { cell: { x: 3, y: 4, z: 1 } })];
    const survolé = (hover: { x: number; y: number; z?: number } | null, ctx = EXPLORE) =>
      interactionHalos(els, scèneAvec(fouillable('coffre')), {}, hover, ctx).fouilles[0].hovered;
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
    const scène = scèneAvec(pnj('marchand', 5, 5), fouillable('coffre', 3, 4));
    expect(interactionHalos([], scène, {}, { x: 5, y: 5 }, { exploring: false, combat: true }).pnjs).toHaveLength(0);
    // mais le décor fouillable, lui, garde son halo permanent
    expect(interactionHalos([décor('coffre', 3, 4)], scène, {}, { x: 5, y: 5 }, { exploring: false, combat: true }).fouilles).toHaveLength(1);
  });

  it('un MEUBLE À PLACES appelle le joueur SANS aucune action authorée, et s’éteint quand tout est pris', () => {
    const table: SceneEntity = { id: 'table-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'N', usable: { assise: true } };
    const el = décor('table-1', 3, 3, { ref: 'table-ronde-4-tabourets' });
    const libre = scèneAvec(table);
    expect(interactionHalos([el], libre, {}, null, EXPLORE).fouilles.map((h) => h.id)).toEqual(['table-1']);

    const pleine = { ...libre, seatAssignments: { 'table-1': Object.fromEntries(['place-1', 'place-2', 'place-3', 'place-4'].map((s) => [s, { kind: 'entity' as const, entityId: `pnj-${s}` }])) } };
    expect(interactionHalos([el], pleine, {}, null, EXPLORE).fouilles).toHaveLength(0);

    // Un drapeau d'ÉPUISEMENT n'a aucune prise sur une place : ce n'est pas une ressource qui s'épuise.
    expect(interactionHalos([el], libre, { [cleActionJouee('table-1', 'fouiller')]: true, [cleActionJouee('table-1', 'sasseoir')]: true }, null, EXPLORE).fouilles).toHaveLength(1);
  });

  it('la valeur VIDE est gelée — une voie ne peut pas la salir pour l’autre', () => {
    expect(Object.isFrozen(NO_INTERACTION_HALOS)).toBe(true);
    expect(Object.isFrozen(NO_INTERACTION_HALOS.fouilles)).toBe(true);
    expect(Object.isFrozen(NO_INTERACTION_HALOS.pnjs)).toBe(true);
  });
});
