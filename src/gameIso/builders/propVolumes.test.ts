import { describe, expect, it } from 'vitest';
import { DIR8_ORDER, type Dir8 } from '../../state/dir8';
import type { PropData } from '../../data/props.types';
import { polyNormal } from '../backends/webgl/worldTris';
import { buildPropVolumes, type AncrageVolume } from './propVolumes';
import type { Face } from './types';

/**
 * COMPILATION VOLUMIQUE — ce qu'un type de décor à recette produit comme géométrie MONDE, aux HUIT
 * caps. Les goldens tiennent la forme (nombre de faces par primitive, coordonnées) ; les assertions
 * qui les entourent tiennent ce qu'un golden ne dit pas : l'identité de picking, le domaine de
 * matériau, l'orientation vers le dehors et l'absence de face dégénérée.
 */
const PROP_TROIS_PRIMITIVES: PropData = {
  id: 'banc-d-epreuve',
  type: 'props',
  label: 'Banc d’épreuve',
  solid: true,
  volume: {
    primitives: [
      { kind: 'box', center: { x: 0, y: 0, h: 0.45 }, size: { x: 0.8, y: 0.4, h: 0.1 }, material: 'bois-chene' },
      { kind: 'cylinder', center: { x: 0.2, y: 0, h: 0.2 }, radius: 0.06, heightM: 0.4, sides: 8, material: 'fer-noirci' },
      { kind: 'prism', center: { x: -0.2, y: 0.1, h: 0.15 }, size: { x: 0.3, y: 0.2, h: 0.3 }, slope: 'x+', material: 'pierre-atre' },
    ],
  },
};

/** L'ANCRAGE d'un meuble posé : son point monde, son cap, l'altitude de son pied, l'entité porteuse. */
function ancrageDe({ id, ancre, facing, baseHeightM = 0 }: { id?: string; ancre: { x: number; y: number }; facing?: Dir8; baseHeightM?: number }): AncrageVolume {
  return { ancre, facing: facing ?? 'S', baseHeightM, ...(id ? { entId: id } : {}) };
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000;
/** Le golden d'une face : son matériau, son nombre de sommets, ses sommets arrondis au millimètre. */
const snapshotFaces = (faces: readonly Face[]): string[] =>
  faces.map((f) => `${f.material.domain}:${f.material.id}|${f.poly.length}|${f.poly.map((p) => `(${r3(p.x)},${r3(p.y)},${r3(p.h)})`).join(' ')}`);

/** Aire (m²) d'un polygone MONDE, à l'échelle d'une case d'un mètre : zéro = face dégénérée. */
function aire(face: Face): number {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < face.poly.length; i++) {
    const a = face.poly[i];
    const b = face.poly[(i + 1) % face.poly.length];
    nx += (a.h - b.h) * (a.y + b.y);
    ny += (a.y - b.y) * (a.x + b.x);
    nz += (a.x - b.x) * (a.h + b.h);
  }
  return Math.hypot(nx, ny, nz) / 2;
}

describe('buildPropVolumes — la recette locale devient de la géométrie monde', () => {
  it.each<Dir8>(['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'])('compile les trois primitives au cap %s', (facing) => {
    const ancrage = ancrageDe({ id: `meuble-${facing}`, ancre: { x: 4, y: 6 }, facing });
    const faces = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrage);
    expect(faces.length).toBe(6 + 10 + 5); // boîte, cylindre à 8 pans (+ dessus + dessous), prisme
    expect(faces.every((f) => f.entId === ancrage.entId && f.material.domain === 'prop')).toBe(true);
    expect(snapshotFaces(faces)).toMatchSnapshot();
  });

  it('aucune face dégénérée, et chaque polygone regarde le DEHORS de sa primitive', () => {
    const faces = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S' }));
    for (const face of faces) expect(aire(face)).toBeGreaterThan(1e-6);
    // Le centre de la BOÎTE, en monde : toute face de la boîte doit lui tourner le dos.
    const boite = faces.filter((f) => f.material.id === 'bois-chene');
    expect(boite).toHaveLength(6);
    const centre = { x: 4, y: 6, h: 0.45 };
    for (const face of boite) {
      const n = polyNormal(face.poly.map((p) => ({ x: p.x, y: p.h, z: p.y })))!;
      const c = face.poly.reduce((acc, p) => ({ x: acc.x + p.x / 4, y: acc.y + p.h / 4, z: acc.z + p.y / 4 }), { x: 0, y: 0, z: 0 });
      expect(n.x * (c.x - centre.x) + n.y * (c.y - centre.h) + n.z * (c.z - centre.y)).toBeGreaterThan(0);
    }
  });

  it('le CAP tourne la géométrie une seule fois, autour de la case d’ancrage', () => {
    const parCap = DIR8_ORDER.map((facing) =>
      buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing })));
    // Le cylindre est excentré (x = 0.2) : chaque cap le pose ailleurs — huit positions DISTINCTES.
    const piedsParCap = parCap.map((faces) => {
      const pied = faces.filter((f) => f.material.id === 'fer-noirci').flatMap((f) => f.poly);
      return `${r3(Math.min(...pied.map((p) => p.x)))},${r3(Math.min(...pied.map((p) => p.y)))}`;
    });
    expect(new Set(piedsParCap).size).toBe(8);
    // …et l'ancrage ne bouge pas : le centre de la boîte reste sur la case, à tous les caps.
    for (const faces of parCap) {
      const boite = faces.filter((f) => f.material.id === 'bois-chene').flatMap((f) => f.poly);
      expect(r3((Math.min(...boite.map((p) => p.x)) + Math.max(...boite.map((p) => p.x))) / 2)).toBe(4);
      expect(r3((Math.min(...boite.map((p) => p.y)) + Math.max(...boite.map((p) => p.y))) / 2)).toBe(6);
    }
  });

  /**
   * CAP D'IDENTITÉ (contrat de donnée, `data/props.types.ts`) : une recette s'authore FACE AU NORD, et
   * `N` est le seul cap qui la rende telle qu'écrite. Le piège que ce test matérialise : une entité
   * SANS `facing` vaut `S` — un DEMI-TOUR — donc un meuble à dos posé sans cap explicite montre son dos
   * là où l'auteur a dessiné sa face.
   */
  it('le cap `N` est l’identité de rotation ; l’absence de cap vaut `S`, soit un DEMI-TOUR', () => {
    /** L'emprise en x/y d'un matériau, RAMENÉE au repère local de la case d'ancrage. */
    const emprise = (facing: Dir8 | undefined, material: string) => {
      const pts = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, ...(facing ? { facing } : {}) }))
        .filter((f) => f.material.id === material)
        .flatMap((f) => f.poly.map((p) => ({ x: p.x - 4, y: p.y - 6 })));
      return {
        x: [r3(Math.min(...pts.map((p) => p.x))), r3(Math.max(...pts.map((p) => p.x)))],
        y: [r3(Math.min(...pts.map((p) => p.y))), r3(Math.max(...pts.map((p) => p.y)))],
      };
    };
    // Au cap `N`, chaque primitive occupe EXACTEMENT l'emprise que la recette déclare (centre ± demi-
    // dimension, centre ± rayon) : aucune rotation ne s'est appliquée.
    expect(emprise('N', 'bois-chene')).toEqual({ x: [-0.4, 0.4], y: [-0.2, 0.2] }); // box (0,0) × (0.8, 0.4)
    expect(emprise('N', 'fer-noirci')).toEqual({ x: [0.14, 0.26], y: [-0.06, 0.06] }); // cyl (0.2, 0) r 0.06
    expect(emprise('N', 'pierre-atre')).toEqual({ x: [-0.35, -0.05], y: [0, 0.2] }); // prism (−0.2, 0.1) × (0.3, 0.2)
    // …et l'ABSENCE de cap vaut `S` : un DEMI-TOUR, pas l'identité. Le pied change de bord.
    expect(emprise(undefined, 'fer-noirci')).toEqual(emprise('S', 'fer-noirci'));
    expect(emprise(undefined, 'fer-noirci')).toEqual({ x: [-0.26, -0.14], y: [-0.06, 0.06] });
    expect(emprise(undefined, 'pierre-atre')).toEqual({ x: [0.05, 0.35], y: [-0.2, 0] });
  });

  /**
   * ANCRE FRACTIONNAIRE (#1624) : une feature de façade s'ancre entre deux cases, un ornement de faîte au
   * milieu d'une empreinte paire. La recette y subit une TRANSLATION RIGIDE et rien d'autre — mêmes
   * normales face à face, mêmes aires, le seul écart étant le décalage demandé.
   */
  it('une ancre FRACTIONNAIRE translate la recette sans la déformer', () => {
    const surCase = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ ancre: { x: 4, y: 3 }, facing: 'NE' }));
    const entreCases = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ ancre: { x: 4.5, y: 3.5 }, facing: 'NE' }));
    expect(entreCases).toHaveLength(surCase.length);
    for (const [i, face] of entreCases.entries()) {
      const ref = surCase[i];
      expect(face.material).toEqual(ref.material);
      expect(face.poly.map((p) => ({ x: r3(p.x - 0.5), y: r3(p.y - 0.5), h: r3(p.h) })))
        .toEqual(ref.poly.map((p) => ({ x: r3(p.x), y: r3(p.y), h: r3(p.h) })));
      const n = (f: Face) => polyNormal(f.poly.map((p) => ({ x: p.x, y: p.h, z: p.y })))!;
      const [a, b] = [n(face), n(ref)];
      expect([r3(a.x), r3(a.y), r3(a.z)]).toEqual([r3(b.x), r3(b.y), r3(b.z)]);
      expect(r3(aire(face))).toBe(r3(aire(ref)));
    }
  });

  it('la hauteur du sol s’ajoute UNE fois à chaque hauteur locale', () => {
    const auSol = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S' }));
    const enHauteur = buildPropVolumes(PROP_TROIS_PRIMITIVES, ancrageDe({ id: 'meuble', ancre: { x: 4, y: 6 }, facing: 'S', baseHeightM: 7.25 }));
    expect(enHauteur.map((f) => f.poly.map((p) => r3(p.h - 7.25)))).toEqual(auSol.map((f) => f.poly.map((p) => r3(p.h))));
    expect(Math.min(...enHauteur.flatMap((f) => f.poly.map((p) => p.h)))).toBeCloseTo(7.25);
  });
});
