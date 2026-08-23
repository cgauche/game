import { describe, expect, it } from 'vitest';
import { propSvg } from './decor';
import { findPropById, props } from '../../data';
import type { PropPrimitive } from '../../data/props.types';
import { buildProps } from '../builders/props';
import { collectBillboards, wholeSceneBillboardEls } from '../backends/webgl/sceneMeshes';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';

/**
 * LE MOBILIER VOLUMIQUE — six refs de `props.json` dont le corps MONDE est leur
 * recette, et dont le SVG de catalogue n'est plus qu'une vignette de palette. Ce fichier tient les
 * deux moitiés du contrat : l'identité (vignette + recette + places) et l'EXCLUSIVITÉ de la voie
 * monde (une ref volumique n'a plus aucun sujet de billboard).
 */
const IDS = ['cheminee-interieure', 'comptoir-droit', 'comptoir-angle', 'table-ronde-4-tabourets', 'table-murale-2-tabourets', 'armoire'] as const;

const propEntity = ({ id, ref, pos, facing }: { id: string; ref: string; pos: { x: number; y: number }; facing: 'N' | 'E' | 'S' | 'O' }): SceneEntity =>
  ({ id, kind: 'prop', pos, ref, facing }) as SceneEntity;
const sceneWith = (...entities: SceneEntity[]): Scene => ({ ...emptyScene(8, 8), entities });
const METRES_PAR_CASE = 2;

/** Emprise d'une primitive : sa boîte englobante au sol (cases) et ses deux hauteurs (mètres). */
function emprise(p: PropPrimitive): { x0: number; x1: number; y0: number; y1: number; bas: number; haut: number } {
  const dx = p.kind === 'cylinder' ? p.radius : p.size.x / 2;
  const dy = p.kind === 'cylinder' ? p.radius : p.size.y / 2;
  const dh = (p.kind === 'cylinder' ? p.heightM : p.size.h) / 2;
  return { x0: p.center.x - dx, x1: p.center.x + dx, y0: p.center.y - dy, y1: p.center.y + dy, bas: p.center.h - dh, haut: p.center.h + dh };
}
type Emprise = ReturnType<typeof emprise>;
const seChevauchent = (a: Emprise, b: Emprise): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Distance HORIZONTALE d'un point à un segment, en cases — le bord d'une face, pas ses seuls sommets. */
function distanceAuSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

describe('mobilier volumique — six refs, leur vignette et leur corps monde', () => {
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
    expect(findPropById('table-ronde-4-tabourets')!.seatSlots).toEqual([
      { id: 'place-nord', anchor: { x: 0, y: -0.43, h: 0.49 }, facing: 'S', approach: { x: 0, y: -1 } },
      { id: 'place-est', anchor: { x: 0.43, y: 0, h: 0.49 }, facing: 'O', approach: { x: 1, y: 0 } },
      { id: 'place-sud', anchor: { x: 0, y: 0.43, h: 0.49 }, facing: 'N', approach: { x: 0, y: 1 } },
      { id: 'place-ouest', anchor: { x: -0.43, y: 0, h: 0.49 }, facing: 'E', approach: { x: -1, y: 0 } },
    ]);
    expect(findPropById('table-murale-2-tabourets')!.seatSlots?.map((s) => s.id)).toEqual(['place-gauche', 'place-droite']);
    for (const id of ['cheminee-interieure', 'comptoir-droit', 'comptoir-angle', 'armoire'])
      expect(findPropById(id)!.seatSlots, id).toBeUndefined();
  });

  /** Ancres FIGÉES de la table murale : la sonde d'implantation de la salle les attend au millimètre. */
  it('la table murale porte ses deux ancres canoniques, caps N et approches en diagonale', () => {
    expect(findPropById('table-murale-2-tabourets')!.seatSlots).toEqual([
      { id: 'place-gauche', anchor: { x: -0.22, y: 0.34, h: 0.49 }, facing: 'N', approach: { x: -1, y: 1 } },
      { id: 'place-droite', anchor: { x: 0.22, y: 0.34, h: 0.49 }, facing: 'N', approach: { x: 1, y: 1 } },
    ]);
  });

  /**
   * ASSISE SERVIE PAR SON MEUBLE — deux mesures sur les `Face[]` réelles, pour TOUT décor du catalogue
   * qui offre une place : le corps porte au SOL (aucun meuble suspendu à un mur qui n'est pas dans sa
   * case) et le plan de travail est à portée de bras de l'ancre du bassin. Sans elles, une recette peut
   * déclarer des places qu'aucun corps assis n'atteint.
   */
  const propsAvecPlaces = props.filter((p) => (p.seatSlots?.length ?? 0) > 0);

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque volume porte, au sol ou sur un appui', (id) => {
    const primitives = findPropById(id)!.volume!.primitives.map(emprise);
    // Un volume PORTE s'il touche terre, ou s'il repose sur un volume déjà porté qui monte jusqu'à lui.
    const portes = primitives.map((p) => p.bas <= 1e-6);
    for (let passe = 0; passe < primitives.length; passe++)
      primitives.forEach((p, i) => {
        if (portes[i]) return;
        portes[i] = primitives.some((q, k) => portes[k] && k !== i && q.haut >= p.bas - 1e-6 && q.bas <= p.bas && seChevauchent(p, q));
      });
    const suspendus = primitives.filter((_, i) => !portes[i]).map((p) => `bas à ${p.bas} m`);
    expect(suspendus, `${id} : volumes suspendus dans le vide`).toEqual([]);
  });

  it.each(propsAvecPlaces.map((p) => p.id))('%s : chaque ancre est à portée du plan de travail', (id) => {
    const scene = sceneWith(propEntity({ id: 'e-1', ref: id, pos: { x: 3, y: 4 }, facing: 'N' }));
    const el = buildProps(scene)[0] as { faces: { poly: { x: number; y: number; h: number }[] }[] };
    for (const slot of findPropById(id)!.seatSlots!) {
      const ancre = { x: 3 + slot.anchor.x, y: 4 + slot.anchor.y };
      let ecart = Number.POSITIVE_INFINITY;
      for (const face of el.faces)
        for (let i = 0; i < face.poly.length; i++) {
          const a = face.poly[i], b = face.poly[(i + 1) % face.poly.length];
          if (a.h <= slot.anchor.h || b.h <= slot.anchor.h) continue; // sous l'assise : ce n'est pas le plan de travail
          ecart = Math.min(ecart, distanceAuSegment(ancre, a, b) * METRES_PAR_CASE);
        }
      expect(ecart, `${id}/${slot.id} : écart ancre → bord du plan (m)`).toBeLessThanOrEqual(0.3);
    }
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
