/**
 * Verrouille le COMPORTEMENT de `auditFacade`/`locateGrid` sur des fixtures SYNTHÉTIQUES (petites
 * scènes construites pour le test), jamais sur les comptes de la scène RÉELLE (#823) — la première
 * correction de plan rendrait un contrat figé sur ces comptes rouge à tort. Les mesures sur les
 * scènes réelles restent en bas, en NON-RÉGRESSION INFORMATIVE seulement (elles bougent légitimement
 * à chaque correction de plan, ce n'est PAS le contrat de ce fichier).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { auditFacade, auditUnsupportedFloor, auditZoneCoverage, floorPairs, groundTerrains, PLAN_DEFECT_FAMILIES, type Defect, type PlanDefectFamilyDef } from '../../src/state/planDefects';
import { locateGrid } from './locate';
import { findMap, findMaps } from './registry';
import type { Scene, SceneEffectZone, WallSeg } from '../../src/state/scene';

/** « La Diligence » — paquet ÉDITEUR (`src/scenes/diligence/diligence-projet.json`) : la Scène y est
 *  déjà compilée, `findMaps` la relit par `parseProject` sans rien rebâtir. */
const diligenceScene = (): Scene =>
  findMaps(fileURLToPath(new URL('../../src/scenes/diligence/diligence-projet.json', import.meta.url)))[0].build();

/** Rubriques TELLES QUE LE CLI LES IMPRIME — dérivées du registre `PLAN_DEFECT_FAMILIES` (source
 *  unique des titres et du sujet de chaque famille) et numérotées comme lui, par le rang dans le
 *  registre (`familyNo`, check.mts). Une famille renommée, ajoutée ou re-scopée suit ici toute seule :
 *  aucune chaîne recopiée ni aucune liste de scopes en dur ne peut plus rendre la garde inopérante. */
const rubriques = (garde: (scope: PlanDefectFamilyDef['scope']) => boolean): string[] =>
  PLAN_DEFECT_FAMILIES.map((f, i) => ({ scope: f.scope, titre: `${i + 1}. ${f.title}` }))
    .filter((r) => garde(r.scope))
    .map((r) => r.titre);

/** Familles qui EXIGENT deux étages (`floorPair`) : sans second étage, elles n'ont aucun sujet. */
const RUBRIQUES_PAIRE = rubriques((scope) => scope === 'floorPair');

/** Toutes les autres — zones déclarées (`zone`) et grille de murs d'un seul étage (`floor`) : leur
 *  sujet existe dès le plain-pied, le rapport doit donc les imprimer même sans second étage. */
const RUBRIQUES_PLAIN_PIED = rubriques((scope) => scope !== 'floorPair');

function makeScene(w: number, h: number, z0: string[], z1: string[], walls: WallSeg[], zones: SceneEffectZone[]): Scene {
  return {
    type: 'scene',
    id: 'fixture',
    label: 'Fixture de test',
    dimensions: { w, h },
    layers: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }],
    walls,
    effectZones: zones,
    entities: [],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

describe('auditFacade — critère GÉOMÉTRIQUE (#823 défauts 1+2)', () => {
  it("une trémie ENCERCLÉE par la dalle (mezzanine/garde-corps sur un vide central) n'est PAS un mur manquant", () => {
    const w = 5, h = 5;
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('plancher');
    z1[2 * w + 2] = 'vide'; // trémie centrale (2,2), encerclée de tous côtés
    const zones: SceneEffectZone[] = [{ id: 'salle', label: 'Salle', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 }];
    const scene = makeScene(w, h, z0, z1, [], zones);
    const nearHole = (d: Defect) =>
      (d.x === 1 && d.y === 2 && d.side === 'E') ||
      (d.x === 3 && d.y === 2 && d.side === 'O') ||
      (d.x === 2 && d.y === 1 && d.side === 'S') ||
      (d.x === 2 && d.y === 3 && d.side === 'N');

    const filtered = auditFacade(scene, 1, 0, true).filter(nearHole);
    expect(filtered).toHaveLength(0);

    // CONTRE-PREUVE : le test ci-dessus vérifie le FILTRE, pas l'absence de trou — sans lui, le même
    // trou remonte bien (garde qu'un test qui « passe toujours » ne masque pas une assertion vide).
    const unfiltered = auditFacade(scene, 1, 0, false).filter(nearHole);
    expect(unfiltered.length).toBeGreaterThan(0);
  });

  it("le vide au-dessus d'une annexe de plain-pied REJOINT le dehors — le mur manquant se dit quelle que soit la présentation de la zone du dessous (#823 défaut 2)", () => {
    const w = 5, h = 3; // corps principal x=0..2 (2 étages), annexe x=3..4 (1 seul étage)
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('vide');
    for (let y = 0; y < h; y++) for (let x = 0; x <= 2; x++) z1[y * w + x] = 'plancher';
    const zones: SceneEffectZone[] = [
      { id: 'corps', label: 'Corps principal', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w: 3, h }, z: 0 },
      { id: 'annexe', label: 'Annexe', presentation: 'interior', area: { kind: 'rect', x: 3, y: 0, w: 2, h }, z: 0 },
    ];
    const scene = makeScene(w, h, z0, z1, [], zones);

    const defects = auditFacade(scene, 1, 0, true);
    const junction = defects.filter((d) => d.side === 'E' && d.x === 2 && [0, 1, 2].includes(d.y));
    expect(junction).toHaveLength(3);
    expect(junction.every((d) => d.family === 'mur-manquant')).toBe(true);
  });

  it("sans AUCUNE zone descriptive déclarée, refuse de rendre un verdict plutôt que de deviner (#823 défaut 1, ceinture — un faux positif est pire qu'un défaut raté)", () => {
    const w = 5, h = 3;
    const z0 = new Array(w * h).fill('plancher');
    const z1 = new Array(w * h).fill('vide');
    for (let y = 0; y < h; y++) for (let x = 0; x <= 2; x++) z1[y * w + x] = 'plancher';
    const scene = makeScene(w, h, z0, z1, [], []); // zéro zoneMap

    expect(auditFacade(scene, 1, 0, true)).toEqual([]);
    expect(auditFacade(scene, 1, 0, false)).toEqual([]);
  });

  it('CONTRE-PREUVE sur La Diligence (scène réelle) : retirer le mur z1 en (18,6)N fait apparaître EXACTEMENT un défaut de plus — le silence structurel du défaut 2 est corrigé', () => {
    const scene = diligenceScene();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    const targetWall = (w: WallSeg) => (w.z ?? 0) === aboveZ && w.side === 'N' && w.x === 18 && w.y === 6;
    expect((scene.walls ?? []).some(targetWall)).toBe(true); // le mur existe bien sur le plan actuel

    const before = auditFacade(scene, aboveZ, belowZ);
    const mutated: Scene = { ...scene, walls: (scene.walls ?? []).filter((w) => !targetWall(w)) }; // EN MÉMOIRE — aucun fichier touché
    const after = auditFacade(mutated, aboveZ, belowZ);
    expect(after.length).toBe(before.length + 1);
  });
});

describe('locateGrid — jamais de position devinée (#823 défaut 3)', () => {
  function withTempDir(fn: (dir: string) => void): void {
    const dir = mkdtempSync(join(tmpdir(), 'map-locate-test-'));
    try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('jette une erreur AMBIGUË (jamais le premier choisi au hasard) quand deux blocs identiques existent', () => {
    withTempDir((dir) => {
      const raw = 'AAA\nBBB';
      writeFileSync(join(dir, 'aile-ouest.ts'), `export const AILE_OUEST = String.raw\`${raw}\`;\n`);
      writeFileSync(join(dir, 'aile-est.ts'), `export const AILE_EST = String.raw\`${raw}\`;\n`);
      expect(() => locateGrid(dir, raw, 'single')).toThrow(/AMBIGU/);
      try {
        locateGrid(dir, raw, 'single');
        expect.unreachable();
      } catch (e) {
        expect(String(e)).toContain('AILE_OUEST');
        expect(String(e)).toContain('AILE_EST');
      }
    });
  });

  it("CONTRE-PREUVE : un seul bloc correspondant se localise normalement (l'ambiguïté ci-dessus n'est pas un fantôme structurel)", () => {
    withTempDir((dir) => {
      const raw = 'CCC\nDDD';
      writeFileSync(join(dir, 'unique.ts'), `export const UNIQUE = String.raw\`${raw}\`;\n`);
      const loc = locateGrid(dir, raw, 'single');
      expect(loc.rows).toEqual(['CCC', 'DDD']);
    });
  });

  it('jette une erreur INTROUVABLE (distincte de AMBIGUË) quand rien ne correspond', () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, 'autre.ts'), 'export const AUTRE = String.raw`XYZ`;\n');
      expect(() => locateGrid(dir, 'introuvable', 'single')).toThrow(/introuvable/);
    });
  });
});

describe('mesures INFORMATIVES sur les scènes réelles (non contractuelles — bougent légitimement à chaque correction de plan)', () => {
  /** PLAFONDS relevés sur le plan de La Diligence au 2026-07-27, jamais des égalités : l'auteur est en
   *  train de rattacher ses cases à des pièces, ces comptes ne doivent que DESCENDRE. Une valeur gravée
   *  passerait au rouge à la première correction ; le contrat de COMPORTEMENT de chaque famille vit sur
   *  fixtures synthétiques (`src/state/planDefects.test.ts`), jamais sur cette carte. */
  const PLAFONDS_DILIGENCE: Record<string, number> = {
    'facade-decalee': 0,
    'mur-manquant': 0,
    'etage-sur-exterior': 4,
    'case-sans-zone': 60,
    'etage-sans-appui': 4,
  };

  it('La Diligence — aucun défaut de plan ne REMONTE (paquet éditeur `diligence-projet.json`)', () => {
    const scene = diligenceScene();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    const defects = [...auditFacade(scene, aboveZ, belowZ), ...auditZoneCoverage(scene, aboveZ, belowZ), ...auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains())];
    for (const [family, plafond] of Object.entries(PLAFONDS_DILIGENCE)) {
      expect(defects.filter((d) => d.family === family).length, `famille « ${family} »`).toBeLessThanOrEqual(plafond);
    }
  });

  it('Théâtre Staatsoper — aucune zone descriptive authorée, `auditFacade` ne rend plus 83 faux positifs mais 0 (#823 défaut 1)', () => {
    const entry = findMap('opera');
    const scene = entry.build();
    const [[aboveZ, belowZ]] = floorPairs(scene);
    expect(auditFacade(scene, aboveZ, belowZ)).toHaveLength(0);
  });
});

describe('mode PROJET — une carte authorée dans l\'éditeur se contrôle sans passer par le registre', () => {
  /** Projet exporté MINIMAL : corps bâti (x=0..1) sur plancher, appentis (le reste de la largeur) posé
   *  sur `route`, aucun mur nulle part. Le document porte la Scène DÉJÀ compilée — l'outil ne rebâtit
   *  rien. `w` élargit l'appentis (donc son débord au-dessus de la cour) ; `detache` le sépare du
   *  corps bâti — sa dalle ne couvre alors QUE la cour, sans le moindre appui. */
  function writeProject(dir: string, { w = 4, detache = false }: { w?: number; detache?: boolean } = {}): string {
    const h = 3;
    const z0 = Array.from({ length: w * h }, (_, i) => (i % w <= 1 ? 'plancher' : 'route'));
    const z1 = Array.from({ length: w * h }, (_, i) => (detache && i % w <= 1 ? 'vide' : 'plancher'));
    const doc = {
      schema: 3,
      // Identité REQUISE depuis #1552 — au format 3 elle vit dans la poche `meta`, que la
      // migration 4→5 aplatit ; aucune migration ne l'invente.
      meta: { id: 'fixture-carte', label: 'Fixture de carte', version: 1 },
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{
        id: 'appentis', nom: 'Appentis sur cour', desc: 'Appentis sur cour — fixture.',
        dimensions: { w, h },
        layers: [{ z: 0, tiles: z0 }, { z: 1, tiles: z1 }],
        walls: [],
        effectZones: [{ id: 'salle', label: 'Salle commune', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 }],
        entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
      }],
    };
    const path = join(dir, 'appentis-projet.json');
    writeFileSync(path, JSON.stringify(doc));
    return path;
  }

  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'map-projet-test-'));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('un CHEMIN de projet exporté rend une carte contrôlable, sans grille ASCII source (positions en coordonnées de case)', () => {
    withTempDir((dir) => {
      const entries = findMaps(writeProject(dir));
      expect(entries).toHaveLength(1);
      expect(entries[0].source).toBeUndefined(); // aucune ASCII derrière un projet : le rapport le dit
      const scene = entries[0].build();
      const [[aboveZ, belowZ]] = floorPairs(scene);
      expect(auditFacade(scene, aboveZ, belowZ).filter((d) => d.family === 'mur-manquant').length).toBeGreaterThan(0);
      expect(auditZoneCoverage(scene, aboveZ, belowZ)).toEqual([]);
    });
  });

  it('CONTRE-PREUVE : une CLÉ du registre reste une carte codée, avec ses grilles ASCII source', () => {
    expect(findMaps('opera')).toHaveLength(1);
    expect(findMaps('opera')[0].source?.walledGrids.z0).toBeTruthy();
  });

  it('un appentis CONTIGU au corps bâti, posé sur la COUR (`route`), reste porté tant que son débord touche le bâti', () => {
    withTempDir((dir) => {
      // Corps bâti x0-x1, appentis x2 : une case de débord au contact du corps — un encorbellement.
      const scene = findMaps(writeProject(dir, { w: 3 }))[0].build();
      const [[aboveZ, belowZ]] = floorPairs(scene);
      expect(auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains())).toEqual([]);
    });
  });

  it('le MÊME appentis contigu, poussé plus loin au-dessus de la cour, devient un porte-à-faux signalé de bout en bout', () => {
    withTempDir((dir) => {
      const scene = findMaps(writeProject(dir, { w: 8 }))[0].build();
      const [[aboveZ, belowZ]] = floorPairs(scene);
      const unsupported = auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains());
      // Appuis en x0-x1, et rien ne reprend la dalle à l'est : x3..x7 pendent derrière x2, qui tombe avec eux.
      expect(unsupported.map((d) => `${d.x},${d.y}`)).toEqual(['2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '2,1', '3,1', '4,1', '5,1', '6,1', '7,1', '2,2', '3,2', '4,2', '5,2', '6,2', '7,2']);
    });
  });

  it('un étage DÉTACHÉ posé sur la COUR (`route`) n’a aucun appui du tout — le sol nu est le complément des terrains bâtis, jamais une liste par carte', () => {
    withTempDir((dir) => {
      const scene = findMaps(writeProject(dir, { detache: true }))[0].build();
      const [[aboveZ, belowZ]] = floorPairs(scene);
      const unsupported = auditUnsupportedFloor(scene, aboveZ, belowZ, groundTerrains());
      expect(unsupported.map((d) => `${d.x},${d.y}`)).toEqual(['2,0', '3,0', '2,1', '3,1', '2,2', '3,2']);
      // CONTRE-PREUVE : une liste de sols restreinte à `herbe`/`terre` ne voit AUCUNE de ces 6 cases —
      // l'assertion ci-dessus mesure bien la couverture du complément, pas un artefact du décor de test.
      expect(auditUnsupportedFloor(scene, aboveZ, belowZ, new Set(['herbe', 'terre']))).toEqual([]);
    });
  });

  it('`GROUND_TERRAINS` = sols naturels et vide, jamais une surface bâtie', () => {
    for (const nu of ['herbe', 'terre', 'route', 'sable', 'vide']) expect(groundTerrains().has(nu)).toBe(true);
    for (const bati of ['plancher', 'planches', 'dalle', 'marbre', 'pierre', 'pave', 'mur', 'porte']) expect(groundTerrains().has(bati)).toBe(false);
  });
});

describe('RAPPORT — ce qui n\'a pas été mesuré ne se totalise pas', () => {
  /** Projet exporté à UN SEUL étage — le cas de 100 % des 26 scènes des paquets bundlés (arène,
   *  barge, loup) : `floorPairs` est vide, donc aucune des familles `floorPair` n'a de sujet. Son mur
   *  N de (0,0) est un cul-de-sac sur le bord (ses deux coins (0,0) et (1,0) sont de degré 1 sur la
   *  ligne y=0) : la famille `mur-arrete-au-bord` y MESURE 2 défauts sans le moindre second étage. */
  function writeSingleFloorProject(dir: string): string {
    const w = 4, h = 3;
    const doc = {
      schema: 3,
      // Identité REQUISE depuis #1552 — au format 3 elle vit dans la poche `meta`, que la
      // migration 4→5 aplatit ; aucune migration ne l'invente.
      meta: { id: 'fixture-carte', label: 'Fixture de carte', version: 1 },
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{
        id: 'quai', nom: 'Quai de plain-pied', desc: 'Quai de plain-pied — fixture.',
        dimensions: { w, h },
        layers: [{ z: 0, tiles: new Array(w * h).fill('plancher') }],
        walls: [{ x: 0, y: 0, side: 'N' }],
        effectZones: [{ id: 'quai-z', label: 'Quai', presentation: 'exterior', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 }],
        entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
      }],
    };
    const path = join(dir, 'quai-projet.json');
    writeFileSync(path, JSON.stringify(doc));
    return path;
  }

  /** Le MÊME projet avec une dalle d'étage : les cinq familles retrouvent leur sujet. */
  function writeTwoFloorProject(dir: string): string {
    const w = 4, h = 3;
    const doc = {
      schema: 3,
      // Identité REQUISE depuis #1552 — au format 3 elle vit dans la poche `meta`, que la
      // migration 4→5 aplatit ; aucune migration ne l'invente.
      meta: { id: 'fixture-carte', label: 'Fixture de carte', version: 1 },
      narratif: { affaires: [], indices: [], presetsPnj: [], objets: [] },
      scenes: [{
        id: 'quai', nom: 'Quai avec étage', desc: 'Quai avec étage — fixture.',
        dimensions: { w, h },
        layers: [
          { z: 0, tiles: new Array(w * h).fill('plancher') },
          { z: 1, tiles: Array.from({ length: w * h }, (_, i) => (i % w <= 1 ? 'plancher' : 'vide')) },
        ],
        walls: [],
        effectZones: [{ id: 'quai-z', label: 'Quai', presentation: 'interior', area: { kind: 'rect', x: 0, y: 0, w, h }, z: 0 }],
        entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
      }],
    };
    const path = join(dir, 'quai-etage-projet.json');
    writeFileSync(path, JSON.stringify(doc));
    return path;
  }

  function runCli(path: string): string {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const res = spawnSync(process.execPath, ['--import', 'tsx', join(root, 'scripts/map/check.mts'), path], { cwd: root, encoding: 'utf8' });
    expect(res.status, res.stderr).toBe(0);
    return res.stdout;
  }

  function withTempDir<T>(fn: (dir: string) => T): T {
    const dir = mkdtempSync(join(tmpdir(), 'map-report-test-'));
    try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  it('scène à un seul étage : SEULES les familles de paire d\'étages sont NON APPLICABLES, et AUCUN total (un zéro y certifierait un audit qui n\'a pas eu lieu)', () => {
    withTempDir((dir) => {
      const out = runCli(writeSingleFloorProject(dir));
      expect(out).toContain('NON APPLICABLES');
      expect(out).not.toContain('TOTAL défauts');
      for (const titre of RUBRIQUES_PAIRE) {
        expect(out, `« ${titre} — 0 » ne doit pas être imprimé sans second étage`).not.toContain(titre);
      }
      for (const titre of RUBRIQUES_PLAIN_PIED) {
        expect(out, `« ${titre} » a son sujet dès le plain-pied : le rapport doit l'imprimer`).toContain(titre);
      }
    });
  });

  it('scène à un seul étage : une famille de GRILLE DE MURS y est réellement MESURÉE, pas seulement titrée', () => {
    withTempDir((dir) => {
      const out = runCli(writeSingleFloorProject(dir));
      const i = PLAN_DEFECT_FAMILIES.findIndex((f) => f.id === 'mur-arrete-au-bord');
      expect(out).toContain(`${i + 1}. ${PLAN_DEFECT_FAMILIES[i].title} — 2`);
      expect(out).toContain('z0 (0,0)N'); // les deux culs-de-sac sont SITUÉS, pas juste comptés
    });
  });

  it('CONTRE-PREUVE : à deux étages, le rapport imprime CHAQUE rubrique du registre — les familles de paire comprises — et son TOTAL', () => {
    withTempDir((dir) => {
      const out = runCli(writeTwoFloorProject(dir));
      for (const titre of [...RUBRIQUES_PAIRE, ...RUBRIQUES_PLAIN_PIED]) {
        expect(out, `« ${titre} » doit être imprimé dès qu'un second étage donne son sujet à la famille`).toContain(titre);
      }
      // Chaque rubrique une SEULE fois : un étage de plus ne redouble pas les familles de grille de murs.
      for (const titre of RUBRIQUES_PLAIN_PIED) {
        expect(out.split(titre).length - 1, `« ${titre} » imprimée en double`).toBe(1);
      }
      expect(out).toMatch(/TOTAL défauts : \d+/);
      expect(out).not.toContain('NON APPLICABLES');
    });
  });
});
