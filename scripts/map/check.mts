#!/usr/bin/env -S npx tsx
/**
 * `npm run map:check -- <clé|chemin/projet.json> [--carte]` — outil de CONTRÔLE DE CARTE : rapporte
 * chaque défaut de plan. Vérité géométrique = la Scène COMPILÉE (registre : `buildScene` ; projet
 * exporté : la Scène du document, relue par `parseProject`). Ne corrige RIEN.
 *
 * Deux façons de désigner une carte, un seul rapport :
 *   npm run map:check -- diligence                 (clé du registre : position FICHIER:LIGNE:COLONNE
 *   npm run map:check -- diligence --carte          dans la grille ASCII source + extrait, curseur `^`)
 *   npm run map:check -- la-diligence-projet.json  (projet exporté par l'éditeur : COORDONNÉES de case,
 *                                                   aucune grille ASCII n'existant derrière)
 */
import { auditFacade, auditStairwells, auditUnsupportedFloor, auditZoneCoverage, floorPairs, type Defect, type ZoneDefect } from './audit';
import { scenesZ, terrainAt } from './geometry';
import { locateGrid, snippet, wallCellPos, wallEdgePos, zoneCellPos, type GridLocation } from './locate';
import { BUILT_TERRAINS, findMaps, GROUND_TERRAINS, MAP_REGISTRY, type MapEntry, type MapSource } from './registry';
import type { Scene } from '../../src/state/scene';

const [, , sceneArg, ...rest] = process.argv;
const withCarte = rest.includes('--carte');

if (!sceneArg) {
  console.error(`Usage : npm run map:check -- <clé|chemin/projet.json> [--carte]`);
  console.error(`Clés du registre : ${MAP_REGISTRY.map((m) => m.key).join(', ')}`);
  console.error(`Projet exporté : passer le CHEMIN du .json (toutes ses scènes sont contrôlées).`);
  process.exit(1);
}

type AnyDefect = Defect | ZoneDefect;

/** Où se corrige un défaut, tel que le rapport l'imprime. `snippet` n'existe que si une grille ASCII
 *  source porte la case ; `sort` ordonne le rapport (ligne/colonne du fichier, ou y/x de la carte). */
interface Site {
  where: string;
  sort: [number, number];
  snippet?: string;
}

interface Sites {
  banner: string;
  /** `null` = défaut non localisable dans les grilles source disponibles (jamais une position devinée). */
  of: (d: AnyDefect) => Site | null;
  cell: (x: number, y: number, z: number) => Site;
  charAt: (x: number, y: number, z: number) => string;
}

function coord(d: AnyDefect): string {
  return 'side' in d && d.side ? `(${d.x},${d.y})${d.side}` : `(${d.x},${d.y})`;
}

function rowColOf(d: AnyDefect): [number, number] {
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

/** Carte CODÉE : la position exacte dans le fichier ASCII source (`locate.ts`), plus l'extrait 3 lignes. */
function codedSites(source: MapSource): Sites {
  const walledLoc = new Map<number, GridLocation>();
  const zoneLoc = new Map<number, GridLocation>();
  const walled = (z: number): GridLocation => {
    let loc = walledLoc.get(z);
    if (!loc) {
      const raw = source.walledGrids[`z${z}`];
      if (raw === undefined) throw new Error(`walledGrids.z${z} absent du registre pour cette carte`);
      loc = locateGrid(source.sourceDir, raw, 'single');
      walledLoc.set(z, loc);
    }
    return loc;
  };
  const zoneGrid = (z: number): GridLocation | null => {
    if (!source.zoneGrids?.[`z${z}`]) return null;
    let loc = zoneLoc.get(z);
    if (!loc) {
      loc = locateGrid(source.sourceDir, source.zoneGrids[`z${z}`], 'multi');
      zoneLoc.set(z, loc);
    }
    return loc;
  };
  const site = (loc: GridLocation, line: number, col: number, row: number, srcCol: number, label: string): Site => ({
    where: `${loc.file}:${line}:${col}  ${label}`,
    sort: [line, col],
    snippet: snippet(loc, row, srcCol),
  });
  return {
    banner: `Positions : fichier:ligne:colonne dans la grille ASCII source.`,
    of: (d) => {
      const [row, col] = rowColOf(d);
      if (d.grid === 'zone') {
        const loc = zoneGrid(d.z);
        if (!loc) return null;
        const pos = zoneCellPos(loc, d.x, d.y);
        return site(loc, pos.line, pos.col, row, col, coord(d));
      }
      const loc = walled(d.z);
      const pos = 'side' in d && d.side ? wallEdgePos(loc, d.x, d.y, d.side) : wallCellPos(loc, d.x, d.y);
      return site(loc, pos.line, pos.col, row, col, coord(d));
    },
    cell: (x, y, z) => {
      const loc = walled(z);
      const pos = wallCellPos(loc, x, y);
      return site(loc, pos.line, pos.col, 2 * y + 1, 2 * x + 1, `(${x},${y})`);
    },
    charAt: (x, y, z) => walled(z).rows[2 * y + 1]?.[2 * x + 1] ?? ' ',
  };
}

/** PROJET exporté : aucune grille ASCII n'existe derrière ces cases — le rapport donne la COORDONNÉE
 *  de case et le dit, plutôt que de fabriquer une ligne de fichier qui n'existe pas. Un trou de
 *  plancher y est toujours SUSPECT : le document ne porte aucune recette d'escalier à opposer. */
function projectSites(entry: MapEntry, scene: Scene): Sites {
  const at = (label: string, x: number, y: number, z: number): Site => ({
    where: `${entry.key}  z${z} ${label}`,
    sort: [y, x],
  });
  return {
    banner: `Positions : COORDONNÉES de case (x,y) — ce projet exporté n'a aucune grille ASCII source,\n           donc aucune ligne:colonne à citer. Les corrections se font dans l'éditeur.`,
    of: (d) => at(coord(d), d.x, d.y, d.z),
    cell: (x, y, z) => at(`(${x},${y})`, x, y, z),
    charAt: (x, y, z) => terrainAt(scene, x, y, z),
  };
}

const FAMILY_TITLES: Record<string, string> = {
  'facade-decalee': "1. Façade décalée entre étages",
  'mur-manquant': '2. Mur manquant sur un périmètre',
  'etage-sur-exterior': "3. Étage au-dessus d'une zone exterior",
  'case-sans-zone': '4. Case sans zone déclarée',
  'etage-sans-appui': '5. Étage sans rien dessous',
};
const FAMILY_ORDER = ['facade-decalee', 'mur-manquant', 'etage-sur-exterior', 'case-sans-zone', 'etage-sans-appui'];

function report(entry: MapEntry): void {
  const scene = entry.build();
  const sites = entry.source ? codedSites(entry.source) : projectSites(entry, scene);
  const stairChars = entry.source?.stairChars;

  const pairs = floorPairs(scene);
  const allDefects: AnyDefect[] = [];
  const allTremies: ReturnType<typeof auditStairwells> = [];
  for (const [aboveZ, belowZ] of pairs) {
    allDefects.push(...auditFacade(scene, aboveZ, belowZ));
    allDefects.push(...auditZoneCoverage(scene, aboveZ, belowZ));
    allDefects.push(...auditUnsupportedFloor(scene, aboveZ, belowZ, GROUND_TERRAINS));
    allTremies.push(...auditStairwells(scene, aboveZ, belowZ, stairChars, (x, y) => sites.charAt(x, y, belowZ)));
  }

  console.log(`=== Contrôle de carte — ${entry.label} (${entry.key}) ===`);
  console.log(sites.banner + '\n');

  // Les cinq familles scannent une dalle d'étage CONTRE l'étage du dessous (`floorPairs`) : sans second
  // étage, aucune n'a de sujet — y compris la 2, dont le seul verdict au rez serait le bord de la grille
  // (mesuré : 180 arêtes sur `arene-hub` = exactement le périmètre 50×40, aucune case `vide` intérieure).
  // Un contrôle qui n'a rien regardé le DIT, il ne totalise pas zéro.
  if (!pairs.length) {
    console.log(`Familles 1-5 — NON APPLICABLES : la scène n'a qu'un seul étage (z${scenesZ(scene).join(', z')}).`);
    console.log(`Aucun total : rien n'a été mesuré ici — ce rapport ne vaut pas quitus.\n`);
    if (withCarte) console.log(`Carte de superposition : rien à superposer.\n`);
    process.stderr.write(`[map:check] ${entry.key} un-seul-etage · familles 1-5 non applicables\n`);
    return;
  }

  const byFamily = new Map<string, AnyDefect[]>();
  for (const d of allDefects) {
    if (!byFamily.has(d.family)) byFamily.set(d.family, []);
    byFamily.get(d.family)!.push(d);
  }

  let total = 0;
  for (const family of FAMILY_ORDER) {
    const located = (byFamily.get(family) ?? [])
      .map((d) => ({ d, site: sites.of(d) }))
      .filter((row): row is { d: AnyDefect; site: Site } => {
        if (row.site) return true;
        console.error(`[map:check] défaut « ${row.d.family} » ${coord(row.d)} z${row.d.z} sans position localisable dans la grille source — omis du rapport`);
        return false;
      });
    total += located.length;
    console.log(`${FAMILY_TITLES[family]} — ${located.length}`);
    if (located.length === 0) { console.log(); continue; }
    located.sort((a, b) => a.site.sort[0] - b.site.sort[0] || a.site.sort[1] - b.site.sort[1]);
    for (const { d, site } of located) {
      console.log(`  ${site.where}  — ${d.detail}`);
      if (site.snippet) console.log(site.snippet);
    }
    console.log();
  }
  console.log(`TOTAL défauts : ${total}\n`);

  if (allTremies.length) {
    console.log(`6. Trémies d'escalier (informatif — LÉGITIME, ne pas corriger) et trous suspects`);
    for (const t of allTremies) {
      const belowZ = pairs.find(([a]) => a === t.z)?.[1] ?? t.z - 1;
      console.log(`  ${t.legitimate ? 'TRÉMIE' : 'SUSPECT'}  ${sites.cell(t.x, t.y, belowZ).where}  ${t.detail}`);
    }
    console.log();
  }

  if (withCarte) {
    const [aboveZ, belowZ] = pairs[0];
    console.log(`=== Carte de superposition (z${aboveZ} sur z${belowZ}) ===`);
    console.log('# bâti aux deux étages · 1 étage seul · 0 rez bâti seul · , sol praticable · . vide\n');
    const built = (t: string) => (entry.floorTerrain ? t === entry.floorTerrain : BUILT_TERRAINS.has(t));
    const pave = (t: string) => (entry.floorTerrain ? t === entry.paveTerrain : t !== 'vide' && !BUILT_TERRAINS.has(t));
    for (let y = 0; y < scene.dimensions.h; y++) {
      let line = '';
      for (let x = 0; x < scene.dimensions.w; x++) {
        const e = terrainAt(scene, x, y, aboveZ) !== 'vide';
        const below = terrainAt(scene, x, y, belowZ);
        line += e && built(below) ? '#' : e ? '1' : built(below) ? '0' : pave(below) ? ',' : '.';
      }
      console.log(String(y).padStart(2) + ' ' + line);
    }
    console.log();
  }

  const counts: Record<string, number> = {};
  for (const family of FAMILY_ORDER) counts[family] = (byFamily.get(family) ?? []).length;
  process.stderr.write(`[map:check] ${entry.key} ${JSON.stringify(counts)} · trémies=${allTremies.filter((t) => t.legitimate).length} · suspects=${allTremies.filter((t) => !t.legitimate).length}\n`);
}

for (const entry of findMaps(sceneArg)) report(entry);
