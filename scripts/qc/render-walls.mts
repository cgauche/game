/**
 * QC — rend une petite SALLE délimitée par des MURS sur arêtes (+ une porte) pour valider la géométrie
 * du rendu de cloisons. npx tsx scripts/qc/render-walls.mts → public/qc/walls.png
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { buildFloors } from '../../src/gameIso/builders/floors';
import { floorSvg, floorDepth } from '../../src/gameIso/backends/affineFloors';
import { buildWalls } from '../../src/gameIso/builders/walls';
import { wallDepth, wallSvg } from '../../src/gameIso/backends/affineWalls';
import { DEFS } from '../../src/gameIso/sprites';
import { stageSize, depth, type Dims } from '../../src/geometry/iso';
import type { Scene, Terrain, WallSeg } from '../../src/state/scene';

const W = 7, H = 7;
const tiles = new Array(W * H).fill('dalle') as Terrain[];
// Salle (1,1)-(3,3) cernée de murs ; porte au sud (2,4,N).
const walls: WallSeg[] = [];
for (let x = 1; x <= 3; x++) { walls.push({ x, y: 1, side: 'N' }); walls.push({ x, y: 4, side: 'N', door: x === 2 }); }
for (let y = 1; y <= 3; y++) { walls.push({ x: 0, y, side: 'E' }); walls.push({ x: 3, y, side: 'E' }); }
// deux cloisons DIAGONALES (éventail/courbe) hors de la salle, pour valider le rendu oblique
walls.push({ x: 5, y: 2, side: '\\' }, { x: 5, y: 4, side: '/' });
const scene = {
  id: 's', nom: '', description: '', dimensions: { w: W, h: H },
  layers: [{ z: 0, tiles }], walls, entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
} as unknown as Scene;

const d: Dims = { w: W, h: H };
const objs: { d: number; svg: string }[] = [];
for (const el of buildFloors(scene, undefined, { viewZ: 0 })) objs.push({ d: floorDepth(el, d), svg: floorSvg(el, d) });
for (const el of buildWalls(scene)) objs.push({ d: wallDepth(el, d), svg: wallSvg(el, d) });
// un jeton DANS la salle pour juger l'occlusion (le mur du fond passe derrière lui, le mur avant devant)
const { cx, cy } = (await import('../../src/geometry/iso')).tileCenter(2, 2, d);
objs.push({ d: depth(2, 2, d) + 0.5, svg: `<g><ellipse cx="${cx}" cy="${cy}" rx="9" ry="4" fill="#000" opacity="0.3"/><rect x="${cx - 6}" y="${cy - 40}" width="12" height="40" rx="4" fill="#c44"/></g>` });
objs.sort((a, b) => a.d - b.d);

const stage = stageSize(d);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${stage.w} ${stage.h}" width="${stage.w}" height="${stage.h}"><defs>${DEFS}</defs><rect width="${stage.w}" height="${stage.h}" fill="#14161f"/>${objs.map((o) => o.svg).join('')}</svg>`;
const png = new Resvg(svg, { fitTo: { mode: 'width', value: stage.w * 2 }, font: { loadSystemFonts: true } }).render().asPng();
mkdirSync('public/qc', { recursive: true });
writeFileSync('public/qc/walls.png', png);
console.log('OK: public/qc/walls.png — salle cernée de murs, porte au sud, jeton à l’intérieur');
