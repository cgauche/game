import { describe, it, expect } from 'vitest';
import { emptyScene, type ArchitectureBody, type ArchitectureRect, type BuildingMass, type Scene, type Terrain } from './scene';
import { METRES_PER_LEVEL } from './relief';
import {
  DEFAULT_ROOF_DEFAULTS,
  ROOF_RANGE_SPAN_MAX_M,
  decomposeIntoRanges,
  deriveArchitectureMasses,
  putLayer,
  rangeSpanMaxTiles,
} from './sceneEdit';
import { perimeterWallSegs } from './sceneEdit.testkit';

/**
 * Toiture DÉRIVÉE du plan (#829) — la dérivation par défaut doit proposer un DÉCOUPAGE raisonnable du
 * bâti, jamais une nappe unique posée sur tout un corps : la montée d'un faîtage vaut
 * `portée / 2 × tan(pente)`, donc une seule masse sur une aile entière monte en pyramide au-dessus du
 * bâtiment qu'elle coiffe. La cible est la planche officielle (`art-ref/page012_img3.png`) : de longs
 * faîtages à deux pentes, des ailes perpendiculaires, des noues à leur rencontre.
 */

// Les murs de pourtour des fixtures viennent du kit partagé `sceneEdit.testkit` (`perimeterWallSegs`,
// canonicalisation N/E par `canonEdge`).

/** Scène d'un corps unique dont le plancher du rez est délimité par des MURS clos (la règle
 *  d'`interiorCells`/`realFloorAt` à `z=0`, #881), sans aucune masse authorée : tout est à dériver.
 *  AUCUNE zone déclarée — les murs seuls suffisent (le point du ticket #881). */
function corpsScene(size: number, pieces: ArchitectureRect[], body: Partial<ArchitectureBody> = {}): Scene {
  const scene = emptyScene(size, size);
  scene.walls = perimeterWallSegs(pieces);
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

/**
 * #881 — LES MURS DÉFINISSENT L'INTÉRIEUR, jamais la seule zone `presentation:'interior'`. Contrat
 * POSITIF (une boucle fermée de murs porte plancher+toiture SANS aucune zone) et son RÉFUTANT
 * (l'enclosure seule ne suffit pas : une cour ceinte de murs et déclarée `exterior` reste à ciel
 * ouvert) — mesuré sur `diligence-projet.json` : au rez, clos 1066 − exterior 472 = 594 cases contre
 * 593 déclarées `interior` (sans le filtre `exterior`, les deux cours, le passage couvert et le
 * potager, 472 cases, recevraient une toiture).
 */
describe('realFloorAt/deriveArchitectureMasses — les MURS définissent l’intérieur (#881)', () => {
  it('boucle fermée de murs, AUCUNE zone déclarée → plancher réel ET masse de toiture', () => {
    const scene = corpsScene(12, [{ x: 2, y: 2, w: 3, h: 3 }]);
    expect(scene.effectZones ?? []).toHaveLength(0); // aucune zone : les murs seuls suffisent
    const masses = massesOf(scene);
    expect(masses.length).toBeGreaterThan(0);
    const covered = cellsOf(masses.flatMap((mass) => mass.footprint));
    expect(covered).toEqual(cellsOf([{ x: 2, y: 2, w: 3, h: 3 }]));
  });

  it('cour ceinte de murs et déclarée EXTERIOR → AUCUNE toiture (l’enclosure seule ne suffit pas)', () => {
    const cour = { x: 2, y: 2, w: 3, h: 3 };
    const scene: Scene = {
      ...emptyScene(12, 12),
      walls: perimeterWallSegs([cour]),
      effectZones: [{ id: 'cour', label: 'Cour', area: { kind: 'rect', ...cour }, presentation: 'exterior' }],
      architecture: [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }],
    };
    const [corps] = deriveArchitectureMasses(scene);
    expect(corps.masses).toHaveLength(0); // close par les murs, mais à ciel ouvert : rien à couvrir
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

/**
 * TRÉMIE de volée (#822 bis) — l'ouverture par laquelle un escalier monte à l'étage est un TROU dans le
 * plancher du dessus, pas la ligne de toit d'un édifice. Mesuré sur La Diligence : ses deux volées
 * fabriquaient quatre masses `z0` posées au milieu du bâti, égout à la cote de la marche — donc des
 * nappes d'ardoise plantées DANS le volume que les murs enferment, ressortant en travers de la façade.
 * La lecture est celle des audits de plan (`stairFlightCells`), la MÊME trémie que `auditStairwells`
 * déclare légitime : cotes de marches franchissables jusqu'au plancher du dessus — aucun seuil de
 * taille, aucun test d'encerclement.
 */
describe('deriveArchitectureMasses — une trémie de volée ne fabrique pas de bâtiment', () => {
  const TREMIE = { x: 2, y: 2 };
  const CLE = `${TREMIE.x},${TREMIE.y}`;
  const MAISON = { x: 1, y: 1, w: 4, h: 4 };

  /** Maison d'emprise `MAISON` dont la case `TREMIE` est OUVERTE au plancher de l'étage. `reliefM` cote
   *  cette case au rez : à `METRES_PER_LEVEL` c'est le palier haut d'une volée (le vide au-dessus est la
   *  trémie par laquelle on monte), à 0 c'est un trou de plancher qu'aucune marche n'explique.
   *  `etage: false` retire la couche du dessus — le vide au-dessus de la case est alors le CIEL. */
  function maison(reliefM: number, opts: { etage: boolean } = { etage: true }): Scene {
    const size = 8;
    const idx = (x: number, y: number) => y * size + x;
    const dedans = (x: number, y: number) =>
      x >= MAISON.x && x < MAISON.x + MAISON.w && y >= MAISON.y && y < MAISON.y + MAISON.h;

    const rez: Terrain[] = new Array(size * size).fill('herbe');
    const cotes = new Array<number>(size * size).fill(0);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) if (dedans(x, y)) rez[idx(x, y)] = 'pierre';
    cotes[idx(TREMIE.x, TREMIE.y)] = reliefM;

    let scene = putLayer(emptyScene(size, size), 0, rez, cotes);
    if (opts.etage) {
      const etage: Terrain[] = new Array(size * size).fill('vide');
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (dedans(x, y) && !(x === TREMIE.x && y === TREMIE.y)) etage[idx(x, y)] = 'pierre';
      scene = putLayer(scene, 1, etage);
    }
    scene.walls = perimeterWallSegs([MAISON]); // #881 : les murs closent la maison, AUCUNE zone déclarée
    scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
    return scene;
  }

  it('le palier d’une volée n’appartient à aucune masse — le bâti voisin le couvre déjà', () => {
    const masses = massesOf(maison(METRES_PER_LEVEL));
    expect(masses.some((mass) => cellsOf(mass.footprint).has(CLE))).toBe(false);
  });

  it('le bâti se coiffe d’un SEUL tenant, à la hauteur de son étage — aucune masse au rez dans le volume', () => {
    for (const mass of massesOf(maison(METRES_PER_LEVEL))) {
      expect(mass.z).toBe(1);
      expect(mass.levels).toBe(2);
    }
  });

  it('la trémie ne coûte AUCUNE couverture : tout le reste du plancher d’étage reste sous une masse', () => {
    const couvert = new Set<string>();
    for (const mass of massesOf(maison(METRES_PER_LEVEL)))
      for (const key of cellsOf(mass.footprint)) couvert.add(key);
    const attendu = new Set<string>();
    for (let y = MAISON.y; y < MAISON.y + MAISON.h; y++)
      for (let x = MAISON.x; x < MAISON.x + MAISON.w; x++) if (`${x},${y}` !== CLE) attendu.add(`${x},${y}`);
    expect([...couvert].sort()).toEqual([...attendu].sort());
  });

  it('un trou de plancher qu’AUCUNE marche n’explique garde sa masse — la règle se cote sur la volée, pas sur la taille', () => {
    const porteuses = massesOf(maison(0)).filter((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuses).toHaveLength(1);
    expect(porteuses[0].z).toBe(0);
  });

  it('au DERNIER étage, le vide au-dessus d’une case cotée est le CIEL : sa masse lui revient', () => {
    const porteuses = massesOf(maison(METRES_PER_LEVEL, { etage: false }))
      .filter((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuses).toHaveLength(1);
    expect(porteuses[0].z).toBe(0);
  });
});
