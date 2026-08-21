/**
 * COMPILATION VOLUMIQUE d'un décor — la recette locale d'un `PropData` (`volume.primitives`) devient
 * des `Face[]` du pivot, en espace MONDE. PUR au sens le plus strict du builder : ni scène, ni caméra,
 * ni React, ni store, ni `three` ne sont importés ici — l'appelant apporte l'entité, son type de décor
 * et l'altitude métrique du sol de sa case.
 *
 * REPÈRE : la recette est authorée dans le repère LOCAL du type (origine au CENTRE de la case
 * d'ancrage, `x`/`y` en cases, `h` en mètres au-dessus du sol de la case, cf. `data/props.types.ts`).
 * `SceneEntity.facing` (défaut `S`) le fait tourner UNE fois, autour de l'origine locale ; `groundHeightM`
 * s'ajoute UNE fois à chaque hauteur.
 *
 * ORIENTATION : chaque polygone sort tourné vers le DEHORS de la primitive qui le porte — la cuisson
 * (`backends/webgl/sceneMeshes`) propage ce sens tel quel pour la carte d'ombre.
 */
import { DIR8_ORDER, type Dir8 } from '../../state/dir8';
import type { PropData, PropPoint3, PropPrimitive } from '../../data/props.types';
import type { SceneEntity } from '../../state/scene';
import type { Face, GP } from './types';

/** Rotation du repère local au cap d'auteur — l'UNIQUE endroit où `facing` tourne une géométrie de décor. */
const rotateLocal = (x: number, y: number, facing: Dir8): [number, number] => {
  const a = DIR8_ORDER.indexOf(facing) * Math.PI / 4;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** Sommet LOCAL d'une primitive, avant cap et avant sol. */
interface Sommet { x: number; y: number; h: number }

/** Normale (non unitaire) d'un polygone local, en convention three (X = est, Y = haut, Z = sud) — Newell. */
function normale(poly: readonly Sommet[]): Sommet {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a.h - b.h) * (a.y + b.y);
    ny += (a.y - b.y) * (a.x + b.x);
    nz += (a.x - b.x) * (a.h + b.h);
  }
  return { x: nx, y: ny, h: nz };
}

/** Le polygone, tourné vers le DEHORS du centre fourni (sens de parcours inversé s'il regardait dedans). */
function versLeDehors(poly: Sommet[], centre: PropPoint3): Sommet[] {
  const n = normale(poly);
  const c = poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, y: acc.y + p.y / poly.length, h: acc.h + p.h / poly.length }), { x: 0, y: 0, h: 0 });
  // Produit scalaire en convention three : (X, Y, Z) = (x, h, y).
  const dehors = n.x * (c.x - centre.x) + n.y * (c.h - centre.h) + n.h * (c.y - centre.y);
  return dehors >= 0 ? poly : [...poly].reverse();
}

/** Les six faces d'une caisse droite, dans l'ordre −x, +x, −y, +y, bas, haut. */
function facesBoite(centre: PropPoint3, size: { x: number; y: number; h: number }): Sommet[][] {
  const x0 = centre.x - size.x / 2, x1 = centre.x + size.x / 2;
  const y0 = centre.y - size.y / 2, y1 = centre.y + size.y / 2;
  const h0 = centre.h - size.h / 2, h1 = centre.h + size.h / 2;
  const s = (x: number, y: number, h: number): Sommet => ({ x, y, h });
  return [
    [s(x0, y0, h0), s(x0, y1, h0), s(x0, y1, h1), s(x0, y0, h1)],
    [s(x1, y0, h0), s(x1, y1, h0), s(x1, y1, h1), s(x1, y0, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y0, h1), s(x0, y0, h1)],
    [s(x0, y1, h0), s(x1, y1, h0), s(x1, y1, h1), s(x0, y1, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y1, h0), s(x0, y1, h0)],
    [s(x0, y0, h1), s(x1, y0, h1), s(x1, y1, h1), s(x0, y1, h1)],
  ].map((poly) => versLeDehors(poly, centre));
}

/** Les `sides` faces latérales d'un cylindre, plus son dessus et son dessous. */
function facesCylindre(centre: PropPoint3, radius: number, heightM: number, sides: number): Sommet[][] {
  const h0 = centre.h - heightM / 2, h1 = centre.h + heightM / 2;
  const anneau = Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * 2 * Math.PI;
    return { x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a) };
  });
  const out: Sommet[][] = [];
  for (let k = 0; k < sides; k++) {
    const a = anneau[k];
    const b = anneau[(k + 1) % sides];
    out.push([{ ...a, h: h0 }, { ...b, h: h0 }, { ...b, h: h1 }, { ...a, h: h1 }]);
  }
  out.push(anneau.map((p) => ({ ...p, h: h0 })));
  out.push(anneau.map((p) => ({ ...p, h: h1 })));
  return out.map((poly) => versLeDehors(poly, centre));
}

/** Arête BASSE d'un prisme selon sa pente : la pente DESCEND vers ce côté, l'arête opposée porte la hauteur pleine. */
const BAS_DE_PENTE: Record<'x+' | 'x-' | 'y+' | 'y-', (p: Sommet) => boolean> = {
  'x+': (p) => p.x > 0,
  'x-': (p) => p.x < 0,
  'y+': (p) => p.y > 0,
  'y-': (p) => p.y < 0,
};

/** Les cinq faces d'un prisme : semelle, rampant, dosseret vertical du haut de pente, deux joues triangulaires. */
function facesPrisme(centre: PropPoint3, size: { x: number; y: number; h: number }, slope: 'x+' | 'x-' | 'y+' | 'y-'): Sommet[][] {
  const dx = size.x / 2, dy = size.y / 2;
  const h0 = centre.h - size.h / 2, h1 = centre.h + size.h / 2;
  const bas = BAS_DE_PENTE[slope];
  // Les quatre coins de la semelle, en tour, plus la hauteur de crête que chacun porte.
  const coins = [
    { x: -dx, y: -dy }, { x: dx, y: -dy }, { x: dx, y: dy }, { x: -dx, y: dy },
  ].map((c) => ({ x: centre.x + c.x, y: centre.y + c.y, crete: bas({ x: c.x, y: c.y, h: 0 }) ? h0 : h1 }));
  const semelle = coins.map((c) => ({ x: c.x, y: c.y, h: h0 }));
  const rampant = coins.map((c) => ({ x: c.x, y: c.y, h: c.crete }));
  const hauts = coins.filter((c) => c.crete === h1);
  const dosseret = [
    { x: hauts[0].x, y: hauts[0].y, h: h0 },
    { x: hauts[1].x, y: hauts[1].y, h: h0 },
    { x: hauts[1].x, y: hauts[1].y, h: h1 },
    { x: hauts[0].x, y: hauts[0].y, h: h1 },
  ];
  const joues = [0, 1].map((k) => {
    const haut = hauts[k];
    const bas0 = coins.find((c) => c.crete === h0 && (c.x === haut.x || c.y === haut.y))!;
    return [
      { x: haut.x, y: haut.y, h: h0 },
      { x: bas0.x, y: bas0.y, h: h0 },
      { x: haut.x, y: haut.y, h: h1 },
    ];
  });
  return [semelle, rampant, dosseret, ...joues].map((poly) => versLeDehors(poly, centre));
}

/** Les polygones LOCAUX d'une primitive, déjà tournés vers le dehors. */
function polygonesLocaux(p: PropPrimitive): Sommet[][] {
  if (p.kind === 'box') return facesBoite(p.center, p.size);
  if (p.kind === 'cylinder') return facesCylindre(p.center, p.radius, p.heightM, p.sides);
  return facesPrisme(p.center, p.size, p.slope);
}

/**
 * Les faces MONDE d'un décor volumique : recette locale × cap de l'entité × case d'ancrage, posées sur
 * `groundHeightM` (l'altitude métrique de la surface de la case, relief et couche compris). Chaque face
 * porte le matériau de sa primitive (`domain: 'prop'`) et l'id de l'ENTITÉ, sur lequel le picking la
 * résout une fois fondue dans la géométrie commune.
 */
export function buildPropVolumes(ent: SceneEntity, prop: PropData, groundHeightM: number): Face[] {
  const facing = ent.facing ?? 'S';
  const out: Face[] = [];
  for (const primitive of prop.volume?.primitives ?? []) {
    const material = { domain: 'prop' as const, id: primitive.material };
    for (const poly of polygonesLocaux(primitive)) {
      const monde: GP[] = poly.map((p) => {
        const [rx, ry] = rotateLocal(p.x, p.y, facing);
        return { x: ent.pos.x + rx, y: ent.pos.y + ry, h: groundHeightM + p.h };
      });
      out.push({ poly: monde, material, entId: ent.id });
    }
  }
  return out;
}
