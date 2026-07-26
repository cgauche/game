import { describe, it, expect } from 'vitest';
import { emptyScene, type ArchitectureBody, type ArchitectureRect, type BuildingMass, type Scene } from './scene';
import {
  DEFAULT_ROOF_DEFAULTS,
  ROOF_RANGE_SPAN_MAX_M,
  decomposeIntoRanges,
  deriveArchitectureMasses,
  rangeSpanMaxTiles,
} from './sceneEdit';

/**
 * Toiture DÉRIVÉE du plan (#829) — la dérivation par défaut doit proposer un DÉCOUPAGE raisonnable du
 * bâti, jamais une nappe unique posée sur tout un corps : la montée d'un faîtage vaut
 * `portée / 2 × tan(pente)`, donc une seule masse sur une aile entière monte en pyramide au-dessus du
 * bâtiment qu'elle coiffe. La cible est la planche officielle (`art-ref/page012_img3.png`) : de longs
 * faîtages à deux pentes, des ailes perpendiculaires, des noues à leur rencontre.
 */

/** Scène d'un corps unique dont le plancher du rez est décrit par des PIÈCES (zones intérieures — la
 *  règle de `realFloorAt` à `z=0`), sans aucune masse authorée : tout est à dériver. */
function corpsScene(size: number, pieces: ArchitectureRect[], body: Partial<ArchitectureBody> = {}): Scene {
  const scene = emptyScene(size, size);
  scene.effectZones = pieces.map((rect, i) => ({
    id: `piece-${i}`,
    label: `Pièce ${i}`,
    area: { kind: 'rect' as const, ...rect },
    presentation: 'interior' as const,
  }));
  scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [], ...body }];
  return scene;
}

const cellsOf = (footprint: readonly ArchitectureRect[]): Set<string> => {
  const out = new Set<string>();
  for (const rect of footprint)
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) out.add(`${x},${y}`);
  return out;
};

/** Portée d'une travée = son PETIT côté (d'égout à égout), en cases. */
const spanOf = (mass: BuildingMass): number => Math.min(mass.footprint[0].w, mass.footprint[0].h);
const massesOf = (scene: Scene): BuildingMass[] => deriveArchitectureMasses(scene)[0].masses;

describe('deriveArchitectureMasses — découpage du bâti en TRAVÉES (#829)', () => {
  // 14 × 18 cases à 2 m = un corps de 28 m sur 36 m : l'emprise mesurée sur l'étage de La Diligence.
  const profond = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);

  it('un corps PROFOND rend PLUSIEURS travées, chacune dans la portée maximale — jamais une nappe unique', () => {
    const masses = massesOf(profond);
    const spanMax = rangeSpanMaxTiles(profond);
    expect(spanMax).toBe(4); // 8 m de portée à 2 m la case
    expect(masses.length).toBeGreaterThanOrEqual(Math.ceil(14 / spanMax));
    for (const mass of masses) expect(spanOf(mass)).toBeLessThanOrEqual(spanMax);
    const plusGrande = Math.max(...masses.map((mass) => cellsOf(mass.footprint).size));
    expect(plusGrande).toBeLessThan(14 * 18);
  });

  it('les travées PARTITIONNENT le plancher : chacune est un rectangle plein, sans trou ni recouvrement', () => {
    const masses = massesOf(profond);
    const vues = new Set<string>();
    for (const mass of masses) {
      expect(mass.footprint).toHaveLength(1); // une travée = UN rectangle
      const cells = cellsOf(mass.footprint);
      expect(cells.size).toBe(mass.footprint[0].w * mass.footprint[0].h);
      for (const key of cells) {
        expect(vues.has(key)).toBe(false);
        vues.add(key);
      }
    }
    expect(vues.size).toBe(14 * 18);
    for (let y = 2; y < 20; y++) for (let x = 2; x < 16; x++) expect(vues.has(`${x},${y}`)).toBe(true);
  });

  it('chaque travée porte un faîtage EXPLICITE le long de son GRAND axe', () => {
    for (const mass of massesOf(profond)) {
      const { w, h } = mass.footprint[0];
      expect(mass.ridge).toBe(w >= h ? 'x' : 'y');
      expect(mass.profile).toBe('gable'); // deux pentes : le profil de la planche
    }
  });

  it('un corps en L rend des ailes PERPENDICULAIRES — les faîtages croisés et la noue de la planche', () => {
    const enL = corpsScene(24, [{ x: 2, y: 2, w: 16, h: 3 }, { x: 2, y: 5, w: 3, h: 13 }]);
    const masses = massesOf(enL);
    expect(masses.some((mass) => mass.ridge === 'x')).toBe(true);
    expect(masses.some((mass) => mass.ridge === 'y')).toBe(true);
    const longue = masses.find((mass) => mass.ridge === 'x')!;
    expect(Math.max(longue.footprint[0].w, longue.footprint[0].h)).toBe(16); // l'aile sort ENTIÈRE
  });

  it('la portée maximale est MÉTRIQUE : une scène à grosses cases compte moins de cases par travée', () => {
    const grosses = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);
    grosses.metresPerTile = 4;
    expect(rangeSpanMaxTiles(grosses)).toBe(2); // 8 m ⇒ 2 cases de 4 m
    for (const mass of massesOf(grosses)) expect(spanOf(mass)).toBeLessThanOrEqual(2);
    const enorme = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);
    enorme.metresPerTile = 20; // case plus large que la portée : une travée d'UNE case, jamais zéro
    expect(rangeSpanMaxTiles(enorme)).toBe(1);
  });

  it('DÉTERMINISTE : deux dérivations de la même scène rendent le MÊME découpage', () => {
    expect(massesOf(profond)).toEqual(massesOf(profond));
    expect(decomposeIntoRanges(cellsOf([{ x: 0, y: 0, w: 9, h: 11 }]), 4))
      .toEqual(decomposeIntoRanges(cellsOf([{ x: 0, y: 0, w: 9, h: 11 }]), 4));
  });

  it('les masses AUTHORÉES traversent intactes, et leur emprise n’est jamais re-dérivée', () => {
    const authoree: BuildingMass = {
      id: 'grande-nef', z: 0, footprint: [{ x: 2, y: 2, w: 14, h: 9 }], levels: 1,
      profile: 'hip', ridge: 'x', pitchDeg: 22, material: 'chaume',
    };
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], { masses: [authoree] });
    const masses = massesOf(scene);
    expect(masses.filter((mass) => !mass.derived)).toEqual([authoree]); // intention de l'auteur, mot pour mot
    const derivees = masses.filter((mass) => mass.derived);
    expect(derivees.length).toBeGreaterThan(0);
    for (const mass of derivees) for (const key of cellsOf(mass.footprint)) {
      const [, y] = key.split(',').map(Number);
      expect(y).toBeGreaterThan(10); // le reste du plancher SEUL, jamais l'emprise déjà surchargée
    }
  });

  it('profil, pente et matériau restent l’intention de l’auteur — croupe comprise, sur CHAQUE travée', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'hip', pitchDeg: 32, material: 'chaume' },
    });
    const masses = massesOf(scene);
    expect(masses.length).toBeGreaterThan(1); // la croupe reste bornée par le découpage
    for (const mass of masses) {
      expect(mass.profile).toBe('hip');
      expect(mass.pitchDeg).toBe(32);
      expect(mass.material).toBe('chaume');
      expect(spanOf(mass)).toBeLessThanOrEqual(rangeSpanMaxTiles(scene));
    }
  });

  it('un appentis dérivé recopie le côté d’égout DÉCLARÉ par l’auteur, sur chaque travée', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'shed', pitchDeg: 20, material: 'ardoise', eaveSide: 'S' },
    });
    for (const mass of massesOf(scene)) expect(mass.eaveSide).toBe('S');
  });

  it('l’intention par défaut suit la planche : deux pentes, pente raide, ardoise', () => {
    expect(DEFAULT_ROOF_DEFAULTS).toEqual({ profile: 'gable', pitchDeg: 45, material: 'ardoise' });
    expect(ROOF_RANGE_SPAN_MAX_M).toBe(8);
  });
});

describe('decomposeIntoRanges — corps puis travées', () => {
  it('un rectangle qui tient dans la portée sort ENTIER, faîtage sur toute sa longueur', () => {
    expect(decomposeIntoRanges(cellsOf([{ x: 3, y: 1, w: 12, h: 4 }]), 4)).toEqual([{ x: 3, y: 1, w: 12, h: 4 }]);
  });

  it('un rectangle trop profond se tranche en bandes parallèles à son grand axe, aussi égales que possible', () => {
    expect(decomposeIntoRanges(cellsOf([{ x: 0, y: 0, w: 12, h: 10 }]), 4)).toEqual([
      { x: 0, y: 0, w: 12, h: 4 },
      { x: 0, y: 4, w: 12, h: 3 },
      { x: 0, y: 7, w: 12, h: 3 },
    ]);
  });

  it('une case isolée reste une travée d’une case — la récurrence termine sur toute emprise', () => {
    expect(decomposeIntoRanges(new Set(['5,7']), 4)).toEqual([{ x: 5, y: 7, w: 1, h: 1 }]);
  });

  it('un anneau autour d’une cour rend QUATRE ailes, chacune orientée par sa propre longueur', () => {
    const anneau = cellsOf([
      { x: 0, y: 0, w: 10, h: 2 }, { x: 0, y: 8, w: 10, h: 2 },
      { x: 0, y: 2, w: 2, h: 6 }, { x: 8, y: 2, w: 2, h: 6 },
    ]);
    const ranges = decomposeIntoRanges(anneau, 4);
    expect(ranges).toHaveLength(4);
    const couvert = new Set<string>();
    for (const rect of ranges) for (const key of cellsOf([rect])) couvert.add(key);
    expect(couvert).toEqual(anneau);
    expect(ranges.filter((rect) => rect.w > rect.h)).toHaveLength(2); // deux ailes en x
    expect(ranges.filter((rect) => rect.h > rect.w)).toHaveLength(2); // deux ailes en y
  });
});
