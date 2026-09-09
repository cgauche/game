/**
 * BÂTIMENTS — façade de lecture du dataset `src/data/buildings.json` (#1715). Ajouter un bâtiment =
 * ajouter une entrée au dataset ; plus aucun module TS ne déclare de type de bâtiment.
 *
 * C'est le SEAM unique : la palette de l'éditeur et les ornements du rendu passent par les
 * accesseurs ci-dessous, jamais par le tableau brut.
 *
 * LECTURE VIVE, index O(1). Le tableau exporté par `src/data/index.ts` est le binding que
 * `setDataset` mute EN PLACE (`data/overrides.ts`) : son IDENTITÉ ne change jamais, et le témoin est
 * la VERSION du dataset posée par le seam d'écriture (`memoParVersion`, `data/versionDataset.ts`,
 * #1692). Des accesseurs, jamais une const de module : une entrée éditée au Codex se voit dans
 * l'éditeur et au rendu sans rechargement.
 */
import { buildings } from '../../../data/index';
import { memoParVersion } from '../../../data/versionDataset';
import type { BuildingDef, BuildingFeature } from '../../../data/buildings.types';

/** Ce qu'un porteur de type de bâtiment NOMME à l'écran : l'id qu'il référence et son libellé FR. */
export type BuildingMeta = Pick<BuildingDef, 'id' | 'label'>;

const indexVif = memoParVersion('buildings', () =>
  Object.fromEntries(buildings.map((b) => [b.id, b])) as Readonly<Record<string, BuildingDef>>,
);

const metaVive = memoParVersion('buildings', () =>
  Object.fromEntries(
    buildings.map((b) => [b.id, { id: b.id, label: b.label }]),
  ) as Readonly<Record<string, BuildingMeta>>,
);

/** Les métas indexées par id — reconstruites à la première lecture qui suit une écriture. */
export function buildingsMeta(): Readonly<Record<string, BuildingMeta>> {
  return metaVive();
}

/** Ornements d'identité d'un type de bâtiment (clocheton/cheminée/enseigne/étal), repli `[]` — lus par
 *  `builders/props` pour émettre un billboard par ornement. SÉPARÉ des métas d'éditeur.
 *  Un corps SANS type de bâtiment (`ArchitectureBody.style` absent : bourg, hameau) n'en porte aucun. */
export function buildingFeatures(style: string | undefined): BuildingFeature[] {
  return style === undefined ? [] : indexVif()[style]?.features ?? [];
}
