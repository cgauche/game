import { describe, expect, it } from 'vitest';
import { propSvg } from './decor';
import { findPropById } from '../../data';
import { buildProps } from '../builders/props';
import { collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';

/**
 * LE PREMIER LOT DE MOBILIER VOLUMIQUE — cinq refs de `props.json` dont le corps MONDE est leur
 * recette, et dont le SVG de catalogue n'est plus qu'une vignette de palette. Ce fichier tient les
 * deux moitiés du contrat : l'identité (vignette + recette + places) et l'EXCLUSIVITÉ de la voie
 * monde (une ref volumique n'a plus aucun sujet de billboard).
 */
const IDS = ['cheminee-interieure', 'comptoir-droit', 'comptoir-angle', 'table-ronde-4-tabourets', 'table-murale-2-tabourets'] as const;

const propEntity = ({ id, ref, pos, facing }: { id: string; ref: string; pos: { x: number; y: number }; facing: 'N' | 'E' | 'S' | 'O' }): SceneEntity =>
  ({ id, kind: 'prop', pos, ref, facing }) as SceneEntity;
const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });

describe('mobilier volumique — cinq refs, leur vignette et leur corps monde', () => {
  it.each(IDS)('%s possède vignette et volume monde, jamais billboard monde', (id) => {
    expect(propSvg(id).length).toBeGreaterThan(120);
    const prop = findPropById(id)!;
    expect(prop.volume!.primitives.length).toBeGreaterThan(0);
    const scene = sceneWith(propEntity({ id: `e-${id}`, ref: id, pos: { x: 2, y: 2 }, facing: 'S' }));
    expect(buildProps(scene)[0]).toMatchObject({ entId: `e-${id}`, faces: expect.any(Array) });
    const els = wholeSceneBillboardEls(scene);
    expect(collectBillboards(scene, sceneMetresPerTile(scene), els).some((b) => b.identity.includes(`e-${id}`))).toBe(false);
  });

  it('la table ronde offre quatre places, la table murale deux, le reste aucune', () => {
    expect(findPropById('table-ronde-4-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['nord', 'est', 'sud', 'ouest']);
    expect(findPropById('table-murale-2-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['gauche', 'droite']);
    for (const id of ['cheminee-interieure', 'comptoir-droit', 'comptoir-angle'])
      expect(findPropById(id)!.seatSlots, id).toBeUndefined();
  });

  /** Ancres FIGÉES de la table murale : la sonde d'implantation de la salle les attend au millimètre. */
  it('la table murale porte ses deux ancres canoniques, caps N et approches en diagonale', () => {
    expect(findPropById('table-murale-2-tabourets')!.seatSlots).toEqual([
      { id: 'gauche', anchor: { x: -0.22, y: 0.34, h: 0.49 }, facing: 'N', approach: { x: -1, y: 1 } },
      { id: 'droite', anchor: { x: 0.22, y: 0.34, h: 0.49 }, facing: 'N', approach: { x: 1, y: 1 } },
    ]);
  });

  /** Le corps monde tient dans la case du meuble : une empreinte 1×1 ne déborde pas chez le voisin. */
  it.each(IDS)('%s tient dans son empreinte au cap d’identité', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
    for (const face of el.faces)
      for (const p of face.poly) {
        expect(Math.abs(p.x - 3), `${id} x`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(p.y - 4), `${id} y`).toBeLessThanOrEqual(0.5);
        expect(p.h, `${id} h`).toBeGreaterThanOrEqual(0);
      }
  });
});
