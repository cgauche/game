#!/usr/bin/env -S npx tsx
/**
 * `npm run map:check -- <scène> [--carte]` — outil de CONTRÔLE DE CARTE : rapporte chaque défaut de
 * plan avec le FICHIER, la LIGNE et la COLONNE exactes à éditer (+ extrait 3 lignes, curseur `^`).
 * Vérité géométrique = la Scène COMPILÉE (`buildScene`) ; la position dans le fichier est retrouvée
 * a posteriori (`locate.ts`) par égalité de contenu avec la grille ASCII source. Ne corrige RIEN.
 *
 *   npm run map:check -- diligence
 *   npm run map:check -- diligence --carte
 */
import { auditFacade, auditStairwells, auditUnsupportedFloor, auditZoneCoverage, floorPairs, type Defect, type ZoneDefect } from './audit';
import { terrainAt } from './geometry';
import { locateGrid, snippet, wallCellPos, wallEdgePos, zoneCellPos, type GridLocation, type SourcePos } from './locate';
import { findMap, MAP_REGISTRY } from './registry';

const [, , sceneArg, ...rest] = process.argv;
const withCarte = rest.includes('--carte');

if (!sceneArg) {
  console.error(`Usage : npm run map:check -- <scène> [--carte]`);
  console.error(`Scènes connues : ${MAP_REGISTRY.map((m) => m.key).join(', ')}`);
  process.exit(1);
}

const entry = findMap(sceneArg);
const scene = entry.build();

const walledLoc = new Map<number, GridLocation>();
const zoneLoc = new Map<number, GridLocation>();
function walled(z: number): GridLocation {
  let loc = walledLoc.get(z);
  if (!loc) {
    const raw = entry.walledGrids[`z${z}`];
    if (raw === undefined) throw new Error(`walledGrids.z${z} absent du registre pour « ${entry.key} »`);
    loc = locateGrid(entry.sourceDir, raw, 'single');
    walledLoc.set(z, loc);
  }
  return loc;
}
function zoneGrid(z: number): GridLocation | null {
  if (!entry.zoneGrids?.[`z${z}`]) return null;
  let loc = zoneLoc.get(z);
  if (!loc) {
    loc = locateGrid(entry.sourceDir, entry.zoneGrids[`z${z}`], 'multi');
    zoneLoc.set(z, loc);
  }
  return loc;
}

function posOf(d: Defect | ZoneDefect): SourcePos | undefined {
  if (d.grid === 'zone') {
    const loc = zoneGrid(d.z);
    if (!loc) return undefined; // pas de zoneMap ASCII pour cet étage — se taire, jamais interrompre le rapport
    return zoneCellPos(loc, d.x, d.y);
  }
  const loc = walled(d.z);
  return 'side' in d && d.side ? wallEdgePos(loc, d.x, d.y, d.side) : wallCellPos(loc, d.x, d.y);
}

function locOf(d: Defect | ZoneDefect): GridLocation | undefined {
  return d.grid === 'zone' ? (zoneGrid(d.z) ?? undefined) : walled(d.z);
}

function rowColOf(d: Defect | ZoneDefect): [number, number] {
  if (d.grid === 'zone') return [d.y, d.x];
  if ('side' in d && d.side) {
    switch (d.side) {
      case 'N': return [2 * d.y, 2 * d.x + 1];
      case 'S': return [2 * (d.y + 1), 2 * d.x + 1];
      case 'O': return [2 * d.y + 1, 2 * d.x];
      case 'E': return [2 * d.y + 1, 2 * (d.x + 1)];
    }
  }
  return [2 * d.y + 1, 2 * d.x + 1];
}

const FAMILY_TITLES: Record<string, string> = {
  'facade-decalee': "1. Façade décalée entre étages",
  'mur-manquant': '2. Mur manquant sur un périmètre',
  'etage-sur-exterior': "3. Étage au-dessus d'une zone exterior",
  'case-sans-zone': '4. Case sans zone déclarée',
  'etage-sans-appui': '5. Étage sans rien dessous',
};
const FAMILY_ORDER = ['facade-decalee', 'mur-manquant', 'etage-sur-exterior', 'case-sans-zone', 'etage-sans-appui'];

const allDefects: (Defect | ZoneDefect)[] = [];
const allTremies: ReturnType<typeof auditStairwells> = [];

for (const [aboveZ, belowZ] of floorPairs(scene)) {
  allDefects.push(...auditFacade(scene, aboveZ, belowZ));
  allDefects.push(...auditZoneCoverage(scene, aboveZ, belowZ));
  allDefects.push(...auditUnsupportedFloor(scene, aboveZ, belowZ, entry.groundTerrains));
  const belowGrid = walled(belowZ);
  allTremies.push(...auditStairwells(scene, aboveZ, belowZ, entry, (x, y) => {
    const [row, col] = [2 * y + 1, 2 * x + 1];
    return belowGrid.rows[row]?.[col] ?? ' ';
  }));
}

console.log(`=== Contrôle de carte — ${entry.label} (${sceneArg}) ===\n`);

const byFamily = new Map<string, (Defect | ZoneDefect)[]>();
for (const d of allDefects) {
  if (!byFamily.has(d.family)) byFamily.set(d.family, []);
  byFamily.get(d.family)!.push(d);
}

let total = 0;
for (const family of FAMILY_ORDER) {
  const rawDefects = byFamily.get(family) ?? [];
  const withPos = rawDefects
    .map((d) => ({ d, pos: posOf(d), rc: rowColOf(d) }))
    .filter((row): row is { d: Defect | ZoneDefect; pos: SourcePos; rc: [number, number] } => {
      if (row.pos) return true;
      console.error(`[map:check] défaut « ${row.d.family} » (${row.d.x},${row.d.y},z${row.d.z}) sans position localisable dans la grille source — omis du rapport`);
      return false;
    });
  total += withPos.length;
  console.log(`${FAMILY_TITLES[family]} — ${withPos.length}`);
  if (withPos.length === 0) { console.log(); continue; }
  withPos.sort((a, b) => a.pos.line - b.pos.line || a.pos.col - b.pos.col);
  for (const { d, pos, rc } of withPos) {
    const coord = 'side' in d && d.side ? `(${d.x},${d.y})${d.side}` : `(${d.x},${d.y})`;
    console.log(`  ${pos.file}:${pos.line}:${pos.col}  ${coord}  — ${d.detail}`);
    console.log(snippet(locOf(d)!, rc[0], rc[1]));
  }
  console.log();
}
console.log(`TOTAL défauts : ${total}\n`);

if (allTremies.length) {
  console.log(`6. Trémies d'escalier (informatif — LÉGITIME, ne pas corriger) et trous suspects`);
  for (const t of allTremies) {
    const belowZ = floorPairs(scene).find(([a]) => a === t.z)?.[1] ?? t.z - 1;
    const belowLoc = walled(belowZ);
    const pos = wallCellPos(belowLoc, t.x, t.y);
    console.log(`  ${t.legitimate ? 'TRÉMIE' : 'SUSPECT'}  ${pos.file}:${pos.line}:${pos.col}  ${t.detail}`);
  }
  console.log();
}

if (withCarte) {
  const [aboveZ, belowZ] = floorPairs(scene)[0] ?? [];
  if (aboveZ === undefined) {
    console.log('Carte de superposition : la scène n\'a qu\'un seul étage — rien à superposer.');
  } else {
    console.log(`=== Carte de superposition (z${aboveZ} sur z${belowZ}) ===`);
    console.log('# bâti aux deux étages · 1 étage seul · 0 rez seul · , cour · . dehors\n');
    for (let y = 0; y < scene.dimensions.h; y++) {
      let line = '';
      for (let x = 0; x < scene.dimensions.w; x++) {
        const e = terrainAt(scene, x, y, aboveZ) !== 'vide';
        const r = terrainAt(scene, x, y, belowZ) === entry.floorTerrain;
        const c = entry.paveTerrain ? terrainAt(scene, x, y, belowZ) === entry.paveTerrain : false;
        line += e && r ? '#' : e ? '1' : r ? '0' : c ? ',' : '.';
      }
      console.log(String(y).padStart(2) + ' ' + line);
    }
  }
}

function summary(): void {
  const counts: Record<string, number> = {};
  for (const family of FAMILY_ORDER) counts[family] = (byFamily.get(family) ?? []).length;
  process.stderr.write(`[map:check] ${JSON.stringify(counts)} · trémies=${allTremies.filter((t) => t.legitimate).length} · suspects=${allTremies.filter((t) => !t.legitimate).length}\n`);
}
summary();
