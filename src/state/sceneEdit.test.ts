import { describe, it, expect } from 'vitest';
import { emptyScene, type ArchitectureBody, type ArchitectureRect, type BuildingMass, type Scene, type Terrain } from './scene';
import { METRES_PER_LEVEL } from './relief';
import {
  addArchitectureBody,
  bodyFootCells,
  DEFAULT_ROOF_DEFAULTS,
  ROOF_GABLE_SPAN_MAX_M,
  deriveArchitectureMasses,
  fittedPitchDeg,
  gableSpanMaxTiles,
  localCrossSpans,
  maxCrossSpan,
  putLayer,
  rectCoverOf,
  ridgeAxisOf,
} from './sceneEdit';
import { perimeterWallSegs } from './sceneEdit.testkit';
import { stairFlightCells } from './planDefects';
import { parseProject } from './worldMap';
import diligenceProjet from '../scenes/diligence/diligence-projet.json';

/**
 * Toiture DÉRIVÉE du plan (#829, #930) — UN corps de bâtiment reçoit UN toit. La portée de charpente
 * est une contrainte de FORME, jamais de nombre : au-delà d'elle la nappe s'abat en CROUPE au lieu de
 * dresser deux grands pignons, et rien ne se découpe. La cible est la planche officielle
 * (`art-ref/page012_img3.png`) : un long faîtage unique courant sur toute la longueur, des ailes
 * perpendiculaires, des noues à leur rencontre — pas un peigne de faîtages parallèles.
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

/** Portée d'une masse : la plus large de ses tranches perpendiculaires au faîtage, en cases. */
const spanOf = (mass: BuildingMass): number => maxCrossSpan(cellsOf(mass.footprint), mass.ridge!);
const massesOf = (scene: Scene): BuildingMass[] => deriveArchitectureMasses(scene)[0].masses;
/** Largeur de la tranche la plus ÉTROITE possible du corps : 1 ⇒ une bande d'une case de large. */
const minSpanOf = (mass: BuildingMass): number => {
  const cells = cellsOf(mass.footprint);
  return Math.min(maxCrossSpan(cells, 'x'), maxCrossSpan(cells, 'y'));
};

describe('deriveArchitectureMasses — un corps, UN toit (#930)', () => {
  // 14 × 18 cases à 2 m = un corps de 28 m sur 36 m : l'emprise mesurée sur l'étage de La Diligence.
  const profond = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);

  it('un corps PROFOND rend UNE seule masse — jamais un peigne de travées parallèles', () => {
    const masses = massesOf(profond);
    expect(masses).toHaveLength(1);
    expect(cellsOf(masses[0].footprint).size).toBe(14 * 18);
  });

  it('la masse PARTITIONNE le plancher : ses rectangles ne se recouvrent pas, aucune case perdue', () => {
    const vues = new Set<string>();
    for (const mass of massesOf(profond))
      for (const rect of mass.footprint) {
        for (const key of cellsOf([rect])) {
          expect(vues.has(key)).toBe(false);
          vues.add(key);
        }
      }
    expect(vues.size).toBe(14 * 18);
    for (let y = 2; y < 20; y++) for (let x = 2; x < 16; x++) expect(vues.has(`${x},${y}`)).toBe(true);
  });

  it('au-delà de la portée de pignon, la nappe s’abat en CROUPE — elle ne se découpe pas', () => {
    const [masse] = massesOf(profond);
    expect(spanOf(masse)).toBeGreaterThan(gableSpanMaxTiles(profond));
    expect(masse.profile).toBe('hip');
    expect(masse.ridge).toBe(ridgeAxisOf(cellsOf(masse.footprint)));
  });

  it('en deçà de la portée, deux pentes et un faîtage sur toute la longueur', () => {
    const etroit = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }]);
    const [masse] = massesOf(etroit);
    expect(spanOf(masse)).toBeLessThanOrEqual(gableSpanMaxTiles(etroit));
    expect(masse.profile).toBe('gable');
    expect(masse.ridge).toBe('y'); // le faîtage court sur les 16 cases, pas sur les 3
  });

  it('un corps en L reste UN corps : une masse, une emprise en plusieurs rectangles', () => {
    const enL = corpsScene(24, [{ x: 2, y: 2, w: 16, h: 3 }, { x: 2, y: 5, w: 3, h: 13 }]);
    const masses = massesOf(enL);
    expect(masses).toHaveLength(1);
    expect(masses[0].footprint.length).toBeGreaterThan(1);
    expect(cellsOf(masses[0].footprint)).toEqual(cellsOf([{ x: 2, y: 2, w: 16, h: 3 }, { x: 2, y: 5, w: 3, h: 13 }]));
  });

  it('une aile d’UNE case de large accolée au corps reste DANS sa masse — aucune bande à pignons dans le vide', () => {
    const galerie = corpsScene(24, [{ x: 2, y: 2, w: 8, h: 6 }, { x: 10, y: 4, w: 7, h: 1 }]);
    const masses = massesOf(galerie);
    expect(masses).toHaveLength(1);
    for (const mass of masses) expect(minSpanOf(mass)).toBeGreaterThan(1);
  });

  it('la portée maximale est MÉTRIQUE : une scène à grosses cases passe en croupe plus tôt', () => {
    const grosses = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }]);
    grosses.metresPerTile = 4;
    expect(gableSpanMaxTiles(grosses)).toBe(2); // 8 m ⇒ 2 cases de 4 m
    expect(massesOf(grosses)[0].profile).toBe('hip'); // 3 cases de portée = 12 m
    const enorme = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }]);
    enorme.metresPerTile = 20; // case plus large que la portée : une case de pignon, jamais zéro
    expect(gableSpanMaxTiles(enorme)).toBe(1);
  });

  it('DÉTERMINISTE : deux dérivations de la même scène rendent la MÊME emprise', () => {
    expect(massesOf(profond)).toEqual(massesOf(profond));
    const enU = cellsOf([{ x: 0, y: 0, w: 10, h: 2 }, { x: 0, y: 2, w: 2, h: 6 }, { x: 8, y: 2, w: 2, h: 6 }]);
    expect(rectCoverOf(enU)).toEqual(rectCoverOf(enU));
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

  it('profil, pente et matériau restent l’intention de l’auteur — un pignon DEMANDÉ tient la grande portée', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'gable', pitchDeg: 32, material: 'chaume' },
    });
    const masses = massesOf(scene);
    expect(masses).toHaveLength(1);
    for (const mass of masses) {
      expect(spanOf(mass)).toBeGreaterThan(gableSpanMaxTiles(scene)); // la portée dirait « croupe »…
      expect(mass.profile).toBe('gable'); // … l'auteur dit « pignon », et il tranche
      expect(mass.pitchDeg).toBe(32);
      expect(mass.material).toBe('chaume');
    }
  });

  it('une croupe DEMANDÉE s’applique aussi sous la portée de pignon', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 3, h: 16 }], {
      roofDefaults: { profile: 'hip', pitchDeg: 40, material: 'ardoise' },
    });
    const [masse] = massesOf(scene);
    expect(spanOf(masse)).toBeLessThanOrEqual(gableSpanMaxTiles(scene));
    expect(masse.profile).toBe('hip');
  });

  it('un appentis dérivé recopie le côté d’égout DÉCLARÉ par l’auteur', () => {
    const scene = corpsScene(24, [{ x: 2, y: 2, w: 14, h: 18 }], {
      roofDefaults: { profile: 'shed', pitchDeg: 20, material: 'ardoise', eaveSide: 'S' },
    });
    for (const mass of massesOf(scene)) expect(mass.eaveSide).toBe('S');
  });

  it('l’intention par défaut suit la planche : deux pentes, pente raide, ardoise, un étage de comble', () => {
    expect(DEFAULT_ROOF_DEFAULTS).toEqual({ profile: 'gable', pitchDeg: 45, material: 'ardoise', riseMaxStoreys: 1 });
    expect(ROOF_GABLE_SPAN_MAX_M).toBe(8);
  });
});

/**
 * #947 — LA HAUTEUR DU COMBLE SE BORNE AU BÂTI, et c'est la PENTE qui s'adapte à la portée. La
 * couverture, elle, ne se redécoupe jamais (le peigne de travées de #930 ne revient pas) : un corps
 * profond porte UN toit, plus PLAT. Contrat POSITIF (le comble tient sous la borne, à toute portée)
 * et son RÉFUTANT (une pente POSÉE par l'auteur monte en pyramide si l'auteur le veut — elle ne
 * s'adapte jamais).
 */
describe('deriveArchitectureMasses — borne de comble (#947)', () => {
  /** Montée au faîte, en mètres : `portée / 2 × tan(pente)` — LA formule des nappes (`riseAt`). */
  const monteeM = (mass: BuildingMass, metresPerTile = 2): number =>
    ((spanOf(mass) * metresPerTile) / 2) * Math.tan((mass.pitchDeg * Math.PI) / 180);
  const borneM = DEFAULT_ROOF_DEFAULTS.riseMaxStoreys * METRES_PER_LEVEL;

  it('quelle que soit la portée, le comble tient sous la borne — et reste UNE seule masse', () => {
    for (const profondeur of [3, 5, 8, 12, 17, 24]) {
      const scene = corpsScene(32, [{ x: 2, y: 2, w: profondeur, h: 26 }]);
      const masses = massesOf(scene);
      expect(masses).toHaveLength(1); // jamais un redécoupage en travées
      expect(monteeM(masses[0])).toBeLessThanOrEqual(borneM + 1e-9);
    }
  });

  it('plus le corps est PROFOND, plus son toit est PLAT — jamais l’inverse', () => {
    const pentes = [8, 12, 17, 24].map((profondeur) =>
      massesOf(corpsScene(32, [{ x: 2, y: 2, w: profondeur, h: 26 }]))[0].pitchDeg);
    for (let i = 1; i < pentes.length; i++) expect(pentes[i]).toBeLessThan(pentes[i - 1]);
  });

  it('sur les portées que MONTRE la planche, la pente de référence reste intacte', () => {
    // 8 m de portée (l'aile la plus profonde de la planche) à 45° : 4 m de comble, soit exactement un
    // étage — la borne ne rabat rien de ce que la référence donne à voir.
    const scene = corpsScene(24, [{ x: 2, y: 2, w: ROOF_GABLE_SPAN_MAX_M / 2, h: 16 }]);
    const [masse] = massesOf(scene);
    expect(masse.pitchDeg).toBe(DEFAULT_ROOF_DEFAULTS.pitchDeg);
    expect(monteeM(masse)).toBeCloseTo(METRES_PER_LEVEL, 9);
  });

  it('une pente POSÉE par l’auteur ne s’adapte JAMAIS, même là où elle monte en pyramide', () => {
    const scene = corpsScene(32, [{ x: 2, y: 2, w: 20, h: 26 }], {
      roofDefaults: { profile: 'hip', pitchDeg: 45, material: 'ardoise' },
    });
    const [masse] = massesOf(scene);
    expect(masse.pitchDeg).toBe(45);
    expect(monteeM(masse)).toBeGreaterThan(borneM); // l'auteur a demandé sa charpente : il l'a
  });

  it('la borne est une DONNÉE de corps : un comble de deux étages laisse remonter la charpente', () => {
    const emprise = [{ x: 2, y: 2, w: 20, h: 26 }];
    const defaut = massesOf(corpsScene(32, emprise))[0];
    const haut = massesOf(corpsScene(32, emprise, {
      roofDefaults: { profile: 'hip', material: 'ardoise', riseMaxStoreys: 2 },
    }))[0];
    expect(haut.pitchDeg).toBeGreaterThan(defaut.pitchDeg);
    expect(monteeM(haut)).toBeGreaterThan(borneM);
    expect(monteeM(haut)).toBeLessThanOrEqual(2 * METRES_PER_LEVEL + 1e-9);
  });

  it('la borne est MÉTRIQUE : à grosses cases, la même portée en CASES rabat davantage', () => {
    const grosses = corpsScene(24, [{ x: 2, y: 2, w: 6, h: 16 }]);
    grosses.metresPerTile = 4;
    const [masse] = massesOf(grosses);
    expect(monteeM(masse, 4)).toBeLessThanOrEqual(borneM + 1e-9);
    expect(masse.pitchDeg).toBeLessThan(massesOf(corpsScene(24, [{ x: 2, y: 2, w: 6, h: 16 }]))[0].pitchDeg);
  });

  it('fittedPitchDeg : la pente de référence PLAFONNE, la borne rabat, l’arrondi ne la dépasse jamais', () => {
    expect(fittedPitchDeg(1, 2, 45, 1)).toBe(45); // une case de portée : rien à rabattre
    for (const spanTiles of [1, 2, 3, 4, 5, 7, 9, 13, 21, 40]) {
      const pente = fittedPitchDeg(spanTiles, 2, 45, 1);
      expect(pente).toBeLessThanOrEqual(45);
      expect((spanTiles * 2 / 2) * Math.tan((pente * Math.PI) / 180)).toBeLessThanOrEqual(METRES_PER_LEVEL + 1e-9);
    }
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

describe('rectCoverOf / ridgeAxisOf — DÉCRIRE un corps, jamais le découper', () => {
  it('un rectangle sort ENTIER, d’une seule pièce', () => {
    expect(rectCoverOf(cellsOf([{ x: 3, y: 1, w: 12, h: 4 }]))).toEqual([{ x: 3, y: 1, w: 12, h: 4 }]);
  });

  it('un corps trop profond n’est PAS tranché : sa couverture reste le rectangle entier', () => {
    expect(rectCoverOf(cellsOf([{ x: 0, y: 0, w: 12, h: 10 }]))).toEqual([{ x: 0, y: 0, w: 12, h: 10 }]);
  });

  it('une case isolée reste un rectangle d’une case — la récurrence termine sur toute emprise', () => {
    expect(rectCoverOf(new Set(['5,7']))).toEqual([{ x: 5, y: 7, w: 1, h: 1 }]);
  });

  it('un anneau autour d’une cour se DÉCRIT en rectangles qui PARTITIONNENT l’emprise', () => {
    const anneau = cellsOf([
      { x: 0, y: 0, w: 10, h: 2 }, { x: 0, y: 8, w: 10, h: 2 },
      { x: 0, y: 2, w: 2, h: 6 }, { x: 8, y: 2, w: 2, h: 6 },
    ]);
    const rects = rectCoverOf(anneau);
    const couvert = new Set<string>();
    for (const rect of rects) for (const key of cellsOf([rect])) {
      expect(couvert.has(key)).toBe(false); // aucun recouvrement
      couvert.add(key);
    }
    expect(couvert).toEqual(anneau); // aucune case perdue, aucune case de la cour couverte
  });

  it('le faîtage court le long de la LONGUEUR, et la portée se lit tranche par tranche, jamais sur la boîte englobante', () => {
    const enT = cellsOf([{ x: 0, y: 0, w: 12, h: 2 }, { x: 0, y: 2, w: 2, h: 4 }]);
    expect(ridgeAxisOf(enT)).toBe('x'); // 6 cases de portée en y contre 12 en x
    const escalier = new Set(['0,0', '1,1', '2,2']); // boîte englobante 3×3, portée locale d'UNE case
    expect(maxCrossSpan(escalier, 'x')).toBe(1);
    expect(localCrossSpans(escalier, 'x').get(1)).toEqual({ lo: 1, hi: 2 });
  });
});

/**
 * TRÉMIE de volée (#822 bis, #1181) — l'ouverture par laquelle un escalier monte à l'étage est un TROU
 * dans le plancher du dessus, pas la ligne de toit d'un édifice : elle ne fonde aucune masse à la cote
 * de ses marches (des nappes d'ardoise plantées DANS le volume que les murs enferment, #822 bis), et
 * elle ne coûte AUCUN trou de couverture (#1181) — le toit passe CONTINU au-dessus d'elle, à la
 * hauteur de la nappe qui l'entoure. La colonne ouverte au sommet ADOPTE le groupe de ses voisines ;
 * le ciel ouvert, lui, se DÉCLARE (`roofExclusions`).
 */
describe('deriveArchitectureMasses — une colonne OUVERTE au sommet adopte la nappe qui l’entoure', () => {
  const TREMIE = { x: 2, y: 2 };
  const CLE = `${TREMIE.x},${TREMIE.y}`;
  const MAISON = { x: 1, y: 1, w: 4, h: 4 };

  /** Maison d'emprise `MAISON` dont la case `TREMIE` est OUVERTE au plancher de l'étage. `reliefM` cote
   *  cette case au rez : à `METRES_PER_LEVEL` c'est le palier haut d'une volée (le vide au-dessus est la
   *  trémie par laquelle on monte), à 0 c'est un trou de plancher qu'aucune marche n'explique.
   *  `etage: false` retire la couche du dessus — le vide au-dessus de la case est alors le CIEL. */
  function maison(reliefM: number, opts: { etage?: boolean; roofExclusions?: ArchitectureBody['roofExclusions'] } = {}): Scene {
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
    if (opts.etage !== false) {
      const etage: Terrain[] = new Array(size * size).fill('vide');
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (dedans(x, y) && !(x === TREMIE.x && y === TREMIE.y)) etage[idx(x, y)] = 'pierre';
      scene = putLayer(scene, 1, etage);
    }
    scene.walls = perimeterWallSegs([MAISON]); // #881 : les murs closent la maison, AUCUNE zone déclarée
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [], masses: [],
      ...(opts.roofExclusions ? { roofExclusions: opts.roofExclusions } : {}),
    }];
    return scene;
  }

  it('le palier d’une volée est COUVERT par la MÊME masse que ses voisines — le toit passe au-dessus de la trémie', () => {
    const masses = massesOf(maison(METRES_PER_LEVEL));
    const porteuse = masses.find((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuse).toBeDefined();
    // …et c'est la nappe des voisines, pas une masse à elle : même id des quatre côtés.
    for (const voisine of [`${TREMIE.x - 1},${TREMIE.y}`, `${TREMIE.x + 1},${TREMIE.y}`, `${TREMIE.x},${TREMIE.y - 1}`, `${TREMIE.x},${TREMIE.y + 1}`])
      expect(masses.find((mass) => cellsOf(mass.footprint).has(voisine))?.id).toBe(porteuse!.id);
  });

  it('le bâti se coiffe d’un SEUL tenant, à la hauteur de son étage — aucune masse au rez dans le volume', () => {
    for (const mass of massesOf(maison(METRES_PER_LEVEL))) {
      expect(mass.z).toBe(1);
      expect(mass.levels).toBe(2);
    }
  });

  it('la trémie ne coûte AUCUN trou de couverture : tout le plancher de l’emprise est sous une masse', () => {
    const couvert = new Set<string>();
    for (const mass of massesOf(maison(METRES_PER_LEVEL)))
      for (const key of cellsOf(mass.footprint)) couvert.add(key);
    const attendu = new Set<string>();
    for (let y = MAISON.y; y < MAISON.y + MAISON.h; y++)
      for (let x = MAISON.x; x < MAISON.x + MAISON.w; x++) attendu.add(`${x},${y}`);
    expect([...couvert].sort()).toEqual([...attendu].sort());
  });

  it('un trou de plancher qu’AUCUNE marche n’explique est TOITÉ lui aussi — l’ENCLOSURE suffit, la volée n’est qu’un cas', () => {
    const masses = massesOf(maison(0));
    const porteuse = masses.find((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuse?.z).toBe(1); // la nappe de l'étage, jamais une masse au rez plantée dans le volume
    expect(masses.find((mass) => cellsOf(mass.footprint).has(`${TREMIE.x + 1},${TREMIE.y}`))?.id).toBe(porteuse!.id);
  });

  it('le CIEL OUVERT se DÉCLARE : `roofExclusions` tient la case hors de TOUTE masse, à n’importe quel z', () => {
    const rect = { x: TREMIE.x, y: TREMIE.y, w: 1, h: 1 };
    const voisine = `${TREMIE.x + 1},${TREMIE.y}`;
    // Déclarée au niveau de la NAPPE comme au niveau du PLANCHER : AUCUNE masse, d'AUCUN étage, ne
    // coiffe la case. Ne l'exclure que de la nappe laissait la colonne se rabattre d'un cran et poser
    // une masse au rez DANS le volume, sous le ciel que l'auteur venait d'ouvrir.
    for (const z of [0, 1]) {
      const masses = massesOf(maison(0, { roofExclusions: [{ z, rect }] }));
      expect(masses.some((mass) => cellsOf(mass.footprint).has(CLE)), `exclusion z=${z}`).toBe(false);
      expect(masses.find((mass) => cellsOf(mass.footprint).has(voisine))?.z, `exclusion z=${z}`).toBe(1);
    }
  });

  it('au DERNIER étage, le vide au-dessus d’une case cotée est le CIEL : sa masse lui revient', () => {
    const porteuses = massesOf(maison(METRES_PER_LEVEL, { etage: false }))
      .filter((mass) => cellsOf(mass.footprint).has(CLE));
    expect(porteuses).toHaveLength(1);
    expect(porteuses[0].z).toBe(0);
  });
});

/**
 * ADOPTION au DÉBOUCHÉ (#1181) — une volée n'ouvre QUE vers l'étage où elle monte. Élire le voisin le
 * plus HAUT donnait la trémie à la TOUR qui la borde : une masse de trois niveaux posée sur une case
 * qui n'en porte qu'un, nappe passée par-dessus le corps au lieu de le coiffer.
 */
describe('deriveArchitectureMasses — la colonne ouverte est adoptée au DÉBOUCHÉ, jamais par le voisin le plus haut', () => {
  const S = 10;
  const dans = (rect: ArchitectureRect, x: number, y: number) =>
    x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

  /** Bâti à N couches : chaque couche pose `pierre` sur ses rectangles, moins ses `trous`. `cotes`
   *  cote le rez (palier haut d'une volée à `METRES_PER_LEVEL`). */
  function bati(
    couches: { z: number; rects: ArchitectureRect[]; trous?: string[] }[],
    cotes: Record<string, number>,
    emprise: ArchitectureRect[],
  ): Scene {
    let scene = emptyScene(S, S);
    for (const couche of couches) {
      const tiles: Terrain[] = new Array(S * S).fill(couche.z === 0 ? 'herbe' : 'vide');
      const height = new Array<number>(S * S).fill(0);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++)
          if (couche.rects.some((r) => dans(r, x, y)) && !(couche.trous ?? []).includes(`${x},${y}`))
            tiles[y * S + x] = 'pierre';
      if (couche.z === 0)
        for (const [key, m] of Object.entries(cotes)) {
          const [x, y] = key.split(',').map(Number);
          height[y * S + x] = m;
        }
      scene = putLayer(scene, couche.z, tiles, couche.z === 0 ? height : undefined);
    }
    scene.walls = perimeterWallSegs(emprise);
    scene.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses: [] }];
    return scene;
  }
  const porteuse = (scene: Scene, key: string) => massesOf(scene).find((mass) => cellsOf(mass.footprint).has(key));

  it('une TOUR accolée ne vole pas la trémie : la volée qui débouche sur l’étage prend la nappe de l’ÉTAGE', () => {
    // Tour de 3 niveaux (x1..2) contre un corps de 2 (x3..6) ; volée en (3,2), contre la tour, qui
    // débouche sur le plancher z1 du corps.
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 4 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 6, h: 4 }], trous: ['3,2'] },
        { z: 2, rects: [{ x: 1, y: 1, w: 2, h: 4 }] },
      ],
      { '3,2': METRES_PER_LEVEL },
      [{ x: 1, y: 1, w: 6, h: 4 }],
    );
    expect([...stairFlightCells(scene, 0, 1)]).toEqual(['3,2']);
    const tremie = porteuse(scene, '3,2');
    expect(tremie?.z).toBe(1);
    expect(tremie?.levels).toBe(2);
    expect(tremie?.id).toBe(porteuse(scene, '4,2')?.id); // la nappe du corps, celle du débouché
    expect(porteuse(scene, '2,2')?.z).toBe(2); // la tour garde SA hauteur, sans avoir rien adopté
  });

  it('un PUITS de deux étages reste adopté par la nappe qui l’enclôt — l’enclosure ne compte pas les crans', () => {
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 6 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 6, h: 6 }], trous: ['3,3'] },
        { z: 2, rects: [{ x: 1, y: 1, w: 6, h: 6 }], trous: ['3,3'] },
      ],
      {},
      [{ x: 1, y: 1, w: 6, h: 6 }],
    );
    const puits = porteuse(scene, '3,3');
    expect(puits?.z).toBe(2);
    expect(puits?.levels).toBe(3);
    expect(puits?.id).toBe(porteuse(scene, '4,3')?.id);
  });

  it('une AILE BASSE accolée n’est PAS avalée : elle n’est ni enclose, ni débouchante', () => {
    const scene = bati(
      [
        { z: 0, rects: [{ x: 1, y: 1, w: 6, h: 4 }] },
        { z: 1, rects: [{ x: 1, y: 1, w: 3, h: 4 }] },
      ],
      {},
      [{ x: 1, y: 1, w: 6, h: 4 }],
    );
    expect(porteuse(scene, '5,2')?.z).toBe(0);
    expect(porteuse(scene, '5,2')?.levels).toBe(1);
    expect(porteuse(scene, '2,2')?.z).toBe(1);
  });
});

/**
 * LA DILIGENCE RÉELLE (#1181) — le plan livré, pas une maquette : ses deux volées ouvrent huit trémies
 * dans le plancher de l'étage, et chacune faisait un TROU dans la nappe d'ardoise (diagnostic
 * utilisateur : « il ne genere pas de toit au dessus d'une case vide, mais en dessous c'est
 * l'escalier »). Le toit doit passer au-dessus, à la hauteur de la nappe qui l'entoure.
 */
describe('deriveArchitectureMasses — les trémies de La Diligence sont TOITÉES', () => {
  const scene = parseProject(diligenceProjet).scenes[0];
  const tremies = [...stairFlightCells(scene, 0, 1)].sort();
  const masses = deriveArchitectureMasses(scene).flatMap((body) => body.masses);
  const porteuse = (key: string) => masses.find((mass) => cellsOf(mass.footprint).has(key));

  it('les huit cases de volée sont bien les trémies du plan', () => {
    expect(tremies).toEqual(['13,25', '14,23', '14,24', '14,25', '19,20', '19,21', '19,22', '20,22']);
  });

  it('chaque trémie est couverte, à la hauteur de l’étage (z1, deux niveaux) — jamais à la cote de la marche', () => {
    for (const key of tremies) {
      expect(porteuse(key), key).toBeDefined();
      expect(porteuse(key)!.z, key).toBe(1);
      expect(porteuse(key)!.levels, key).toBe(2);
    }
  });

  it('la nappe est CONTINUE : la trémie porte la MÊME masse que le plancher d’étage voisin', () => {
    expect(porteuse('13,25')!.id).toBe(porteuse('12,25')!.id); // volée ouest, débouché sur l'étage
    expect(porteuse('20,22')!.id).toBe(porteuse('21,22')!.id); // volée est
  });
});

/**
 * L'ATTRIBUTION du plancher résiduel ne doit rien devoir à l'ORDRE du tableau `architecture` (#1172).
 * La Diligence portait DEUX corps non bornés (`diligence` et un `architecture-0` vide) : la dérivation
 * donnait ses 654 cases et ses 5 masses au PREMIER du tableau, et tout basculait sur l'autre à l'ordre
 * inversé. Le corps mort purgé, le résultat est le MÊME dans les deux sens.
 */
describe('deriveArchitectureMasses — La Diligence purgée dérive la MÊME toiture quel que soit l’ordre', () => {
  const scene = parseProject(diligenceProjet).scenes[0];
  const bilan = (s: Scene) => deriveArchitectureMasses(s)
    .map((body) => `${body.id}:${body.masses.length}:${cellsOf(body.masses.flatMap((mass) => mass.footprint)).size}`);

  it('un seul corps NON BORNÉ subsiste : le résiduel légitime', () => {
    const nonBornes = (scene.architecture ?? []).filter((body) => bodyFootCells(body).size === 0);
    expect(nonBornes.map((body) => body.id)).toEqual(['diligence']);
  });

  it('5 masses sur 654 cases, à l’endroit comme à l’envers', () => {
    expect(bilan(scene)).toEqual(['diligence:5:654']);
    expect(bilan({ ...scene, architecture: [...(scene.architecture ?? [])].reverse() })).toEqual(['diligence:5:654']);
  });
});

/**
 * Un corps CRÉÉ à l'éditeur naît BORNÉ (#1172) : sans emprise, chaque nouvelle maison posée serait un
 * second résiduel qui se disputerait le plancher avec le premier.
 */
describe('addArchitectureBody — le corps naît BORNÉ à l’emprise du geste', () => {
  it('l’étage z0 porte d’emblée un volume à l’emprise demandée', () => {
    const { scene, id } = addArchitectureBody(emptyScene(10, 10), 'maison', { x: 3, y: 4, w: 2, h: 2 });
    const body = scene.architecture!.find((candidate) => candidate.id === id)!;
    expect(body.storeys[0].parts).toEqual([{ id: 'part-0', foot: { x: 3, y: 4, w: 2, h: 2 } }]);
    expect([...bodyFootCells(body)].sort()).toEqual(['3,4', '3,5', '4,4', '4,5']);
  });

  it('l’emprise est bornée à la scène, et le corps n’est JAMAIS non borné', () => {
    const { scene, id } = addArchitectureBody(emptyScene(10, 10), 'maison', { x: 9, y: 9, w: 4, h: 4 });
    const body = scene.architecture!.find((candidate) => candidate.id === id)!;
    expect(body.storeys[0].parts[0].foot).toEqual({ x: 6, y: 6, w: 4, h: 4 });
    expect(bodyFootCells(body).size).toBeGreaterThan(0);
  });
});
