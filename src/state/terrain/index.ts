/**
 * TERRAINS — façade de lecture du dataset `src/data/terrains.json` (#1690). Ajouter un terrain =
 * ajouter une entrée au dataset ; plus aucun module TS ne déclare de sol.
 *
 * C'est le SEAM unique : la walkability, le raccord d'arêtes, la Ligne de Vue, les builders de rendu
 * et l'éditeur passent tous par les accesseurs ci-dessous, jamais par le tableau brut.
 *
 * LECTURE VIVE, index O(1). Le tableau exporté par `src/data/index.ts` est le binding que
 * `setDataset` mute EN PLACE (`data/overrides.ts` : `arr.splice(0, arr.length, …)`) — son IDENTITÉ ne
 * change donc jamais, et `memoByRef` (`state/sceneMemo.ts`, mémo par identité de référence) y serait
 * un cache qui ne s'invalide pas : ce patron-là suppose qu'une mutation rende une NOUVELLE réf, ce
 * que la couche donnée ne fait pas. Le témoin est donc le CONTENU : les 25 références d'entrée,
 * comparées à l'identité, position par position (l'atelier réécrit l'entrée éditée, `CodexEdit.tsx`
 * `arr.map((x, i) => (i === index ? e : x))`). Coût mesuré : 14 ns par lecture indexée contre 71 ns
 * pour un `find` vif sur les 25 entrées, sur les 55 033 faces de terrain du corpus livré — et
 * `tileBlocksSight` en pose une par PAS DE RAYON.
 */
import { terrains } from '../../data/index';
import type { TerrainDef } from '../../data/terrains.types';

export type { TerrainDef } from '../../data/terrains.types';

let cache: { temoin: readonly TerrainDef[]; index: Readonly<Record<string, TerrainDef>> } | null = null;

/** Le dataset indexé par id — reconstruit dès qu'une entrée a changé d'identité (édition à l'atelier). */
export function indexDesTerrains(): Readonly<Record<string, TerrainDef>> {
  const c = cache;
  if (c && c.temoin.length === terrains.length && c.temoin.every((t, i) => t === terrains[i])) return c.index;
  const temoin = [...terrains];
  const index = Object.fromEntries(temoin.map((t) => [t.id, t]));
  cache = { temoin, index };
  return index;
}

/** Les entrées du dataset, dans l'ordre authoré (palette de l'éditeur, audits de plan). */
export function tousLesTerrains(): readonly TerrainDef[] {
  return terrains;
}

/** Ids du dataset, dans l'ordre authoré. */
export function terrainIds(): string[] {
  return terrains.map((t) => t.id);
}

/** L'entrée d'un id, ou `undefined` — le seul accès brut, pour un appelant qui porte son propre repli. */
export function terrainEntree(id: string): TerrainDef | undefined {
  return indexDesTerrains()[id];
}

/** Nom d'auteur du terrain, ou `undefined` — l'appelant AFFICHE l'id brut à défaut. */
export function terrainLabel(id: string): string | undefined {
  return indexDesTerrains()[id]?.label;
}

export function terrainWalkable(id: string): boolean {
  return indexDesTerrains()[id]?.walkable ?? false;
}
export function terrainPriority(id: string): number {
  return indexDesTerrains()[id]?.priority ?? 0;
}
/** Le terrain coupe la Ligne de Vue (`lineOfSightCover`, brouillard de vision). */
export function terrainOpaque(id: string): boolean {
  return indexDesTerrains()[id]?.opaque === true;
}
/** Surface BÂTIE : construction qui PORTE l'étage posé dessus. */
export function terrainBuilt(id: string): boolean {
  return indexDesTerrains()[id]?.built === true;
}
/** Décor billboard posé sur chaque tuile du terrain (id de `props.json`), ou undefined. */
export function terrainOverlayProp(id: string): string | undefined {
  return indexDesTerrains()[id]?.overlayProp;
}
/** Hauteur (m) du BLOC PLEIN d'un terrain (rendu seulement — s'ajoute à `heightAt` pour l'AFFICHAGE), 0 sinon. */
export function terrainSolidHeightM(id: string): number {
  return indexDesTerrains()[id]?.solidHeightM ?? 0;
}
/** Recette de détail d'un terrain, RESTREINTE aux sections d'ACCENT (touffes, mouchetis) — `null`
 *  quand l'entrée n'en porte aucune. Deux consommateurs la lisent : l'affine (`authoring/floorsSvg.ts`)
 *  et le volumique (`groundAccents.ts`) ; le POV lit la recette NON restreinte en direct monde
 *  volumique. Elle vit avec le dataset qu'elle interroge, au même titre que `terrainOverlayProp`.
 *
 *  Type par ACCÈS INDEXÉ sur `TerrainDef` : la garde de pureté state→gameIso (#161) interdit tout
 *  `import … from '../../gameIso/…'` ici, `import type` compris. */
export function terrainDetail(id: string): NonNullable<TerrainDef['detail']> | null {
  const d = indexDesTerrains()[id]?.detail;
  return d && (d.tufts || d.speckle) ? d : null;
}
