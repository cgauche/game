import { describe, expect, it } from 'vitest';
import { clearedSpace, isSheltered, massCovers, massFootprintCells, shelterField } from './roofs';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { emptyScene, type BuildingMass, type Scene } from '../../state/scene';
import { diligenceCampaign } from '../../scenes/campaign';

/**
 * SOUS COUVERT (#1176 P2-6) — « cette case est-elle sous un toit ? » n'a qu'UNE réponse dans le
 * dépôt. Le DÉGAGEMENT d'architecture (`clearedSpace`, qui décide ce qui s'efface au-dessus du
 * groupe) et la MÉTÉO volumique (`shelterField`, qui décide où la pluie tombe) lisent le MÊME
 * prédicat `massCovers`. Ce fichier mesure leur ACCORD sur une scène réelle : deux vérités, ce serait
 * une pluie qui tombe dans la taverne pendant que le stage en lève le toit.
 */

const masse = (patch: Partial<BuildingMass> = {}): BuildingMass => ({
  id: 'nef', z: 0, footprint: [{ x: 2, y: 2, w: 4, h: 2 }], levels: 1,
  profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile', ...patch,
});

const sceneAvec = (masses: BuildingMass[], w = 12): Scene => {
  const scene = emptyScene(w, w);
  scene.architecture = [{ id: 'corps', label: 'Corps', style: 'maison', storeys: [], facades: [], masses }];
  return scene;
};

/** Le couvert par BALAYAGE : la définition brute, masse par masse, telle que `clearedSpace` la lit. */
function couvertBalaye(scene: Scene): Map<string, number> {
  const out = new Map<string, number>();
  for (const body of effectiveArchitecture(scene))
    for (const mass of body.masses) {
      const cells = massFootprintCells(mass.footprint);
      for (let y = 0; y < scene.dimensions.h; y++)
        for (let x = 0; x < scene.dimensions.w; x++)
          if (massCovers(mass, cells, x, y, mass.z))
            out.set(`${x},${y}`, Math.max(out.get(`${x},${y}`) ?? -Infinity, mass.z));
    }
  return out;
}

describe('Couvert bâti — UNE vérité pour le dégagement et pour la météo (#1176 P2-6)', () => {
  it.each([
    ['scène-témoin (toit simple)', sceneAvec([masse()])],
    ['deux masses à étages différents', sceneAvec([masse(), masse({ id: 'tour', z: 1, levels: 2, footprint: [{ x: 8, y: 8, w: 2, h: 2 }] })])],
    ['La Diligence (2 niveaux)', diligenceCampaign.scenes[0]],
  ])('%s : `shelterField` couvre EXACTEMENT les colonnes que `massCovers` couvre', (_cas, scene) => {
    const balaye = couvertBalaye(scene);
    const champ = shelterField(scene);
    expect([...champ.keys()].sort()).toEqual([...balaye.keys()].sort());
    for (const [key, topZ] of balaye) expect(champ.get(key)!.topZ).toBe(topZ);
  });

  it('un allié que le DÉGAGEMENT tient pour abrité est sous couvert pour la MÉTÉO — jamais l’inverse', () => {
    const scene = sceneAvec([masse()]);
    for (let y = 0; y < scene.dimensions.h; y++)
      for (let x = 0; x < scene.dimensions.w; x++) {
        const cleared = clearedSpace(scene, [{ x, y, z: 0 }]);
        const abriteParLeDegagement = cleared.roomlessCells.size > 0 || cleared.zoneIds.size > 0;
        const plafond = shelterField(scene).get(`${x},${y}`)?.ceilingM ?? -Infinity;
        if (abriteParLeDegagement) expect(isSheltered(shelterField(scene), x, y, plafond - 0.01)).toBe(true);
      }
  });

  it('un toit LEVÉ par le cutaway reste un toit : le couvert ignore la vue', () => {
    const scene = sceneAvec([masse()]);
    // L'allié est SOUS la nappe : le dégagement la lève…
    const cleared = clearedSpace(scene, [{ x: 3, y: 2, z: 0 }]);
    expect(cleared.roomlessCells.size).toBeGreaterThan(0);
    // …et le couvert, lui, n'a pas bougé d'un pouce (aucun paramètre de vue n'y entre).
    const champ = shelterField(scene);
    expect(isSheltered(champ, 3, 2, champ.get('3,2')!.ceilingM - 0.01)).toBe(true);
  });

  it('une masse ABATTUE rouvre le ciel — la seule façon dont le couvert disparaît', () => {
    const debout = shelterField(sceneAvec([masse()]));
    const abattue = shelterField(sceneAvec([]));
    expect(debout.has('3,2')).toBe(true);
    expect(abattue.has('3,2')).toBe(false);
  });
});
