import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { findPropById } from '../data';
import { empriseLocaleM } from '../data/props.types';
import { heightAt, tileAt, sceneMetresPerTile, type Scene, type SceneEntity } from '../state/scene';
import { propFootTiles } from '../state/footprint';
import { effectiveArchitecture } from '../state/sceneEdit';
import { parseProject } from '../state/worldMap';
import { WALL_H_M } from '../gameIso/iso';
import { SCENARIOS } from './test-scenarios/_registry.generated';

/**
 * AUCUN DÉCOR VOLUMIQUE NE TRAVERSE UNE DALLE NI UN TOIT (#1343). Le corps d'un décor posé au niveau
 * `z` monte depuis le sol de sa case (`heightAt`, le `solM` de `gameIso/builders/props.ts`) jusqu'au
 * `haut` de sa primitive la plus haute (`empriseLocaleM`). Son PLAFOND, case par case de son empreinte :
 * - le sol du premier niveau supérieur dont la case n'est pas `vide` — un volume à double hauteur
 *   (étage `vide` au-dessus) prend le plafond du niveau d'après ;
 * - sinon l'ÉGOUT de la masse de toiture qui coiffe la case à ce niveau : la cote la plus haute sous
 *   son emprise à l'étage `z` de la masse, plus `WALL_H_M` (`buildingMassSchema`,
 *   `data/schemas/defs-scenes/scene.ts`). L'égout est le point BAS du toit : la borne est prudente.
 * - sinon rien : une case à ciel ouvert n'a pas de plafond.
 */

const SCENES_DIR = __dirname;
const projets = listerArbre(SCENES_DIR, { filtre: (rel: string) => rel.endsWith('-projet.json') }) as string[];
const scenesDeProjet: Scene[] = projets.flatMap((f) => parseProject(JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'))).scenes);
const scenesDeScenario: Scene[] = (SCENARIOS as { scene?: Scene }[]).flatMap((sc) => (sc.scene?.entities ? [sc.scene] : []));
const SCENES: Scene[] = [...scenesDeScenario, ...scenesDeProjet];

const dans = (r: { x: number; y: number; w: number; h: number }, x: number, y: number) =>
  x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

function plafondM(scene: Scene, x: number, y: number, z: number): number | undefined {
  const dessus = scene.layers.map((l) => l.z).filter((zz) => zz > z).sort((a, b) => a - b);
  for (const zz of dessus) if (tileAt(scene, x, y, zz) !== 'vide') return heightAt(scene, x, y, zz);
  let toit: number | undefined;
  for (const corps of effectiveArchitecture(scene))
    for (const m of corps.masses) {
      if (z > m.z || z < m.z - m.levels + 1 || !m.footprint.some((r) => dans(r, x, y))) continue;
      let cote = -Infinity;
      for (const r of m.footprint)
        for (let cy = r.y; cy < r.y + r.h; cy++)
          for (let cx = r.x; cx < r.x + r.w; cx++) cote = Math.max(cote, heightAt(scene, cx, cy, m.z));
      toit = Math.min(toit ?? Infinity, cote + WALL_H_M);
    }
  return toit;
}

/** Les décors volumiques d'une scène qui dépassent le plafond d'une case de leur empreinte. */
function decorsQuiTraversent(scene: Scene): string[] {
  const mpt = sceneMetresPerTile(scene);
  const out: string[] = [];
  for (const e of scene.entities as SceneEntity[]) {
    const prop = e.kind === 'prop' ? findPropById(e.ref) : undefined;
    if (!prop?.volume) continue;
    const z = e.z ?? 0;
    const hautM = Math.max(...prop.volume.primitives.map((p) => empriseLocaleM(p).haut));
    const sommet = heightAt(scene, e.pos.x, e.pos.y, z) + hautM;
    for (const t of propFootTiles(e.ref, e.pos, e.facing, mpt)) {
      const plafond = plafondM(scene, t.x, t.y, z);
      if (plafond !== undefined && sommet > plafond + 1e-6) {
        out.push(`${scene.id} ${e.id} (${e.ref}) z${z} : sommet ${sommet.toFixed(2)} m > plafond ${plafond.toFixed(2)} m en (${t.x},${t.y})`);
        break;
      }
    }
  }
  return out;
}

describe('aucun décor volumique ne traverse une dalle ni un toit (#1343)', () => {
  it('le corpus porte des scènes à étage ET des scènes coiffées de toits', () => {
    expect(SCENES.some((s) => s.layers.length > 1), 'une scène à étage au moins').toBe(true);
    expect(SCENES.some((s) => effectiveArchitecture(s).some((c) => c.masses.length > 0)), 'une masse de toiture au moins').toBe(true);
  });

  it('dans toutes les scènes (scénarios de test et projets), chaque corps reste sous le plafond de ses cases', () => {
    const fautes = SCENES.flatMap(decorsQuiTraversent);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });
});
