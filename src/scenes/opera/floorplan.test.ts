import { describe, it, expect } from 'vitest';
import { buildOperaFloorplan, ZONES_REZ, ZONES_ETAGE } from './floorplan';
import { tileAt, heightAt, isWalkable, wallBetween } from '../../state/scene';
import { reachable, type Pt } from '../../state/path';
import { effectiveArchitecture } from '../../state/sceneEdit';
import { unreachableDescriptiveZones, reachedFloors } from '../../state/mapQC';
import { METRES_PER_LEVEL } from '../../state/relief';
import { buildWalls } from '../../gameIso/builders/walls';
import { buildRoofs, clearedSpace } from '../../gameIso/builders/roofs';

/**
 * Le plan de l'Opéra (Théâtre Staatsoper) est COMPILÉ par `buildScene(MapSpec)` depuis l'ASCII box-drawing
 * (`floorplan.ascii.ts`) via `MapSpec.walled` (2 grilles = rez z0 + étage z1) + `MapSpec.relief` (l'ÉLÉVATION
 * MÉTRIQUE, seule donnée non portée par l'ASCII) : deux COUCHES (`layers`), scène surélevée (+1 m) et fosse
 * en contrebas (−1 m) portées par `Layer.height`, parterre en ÉVENTAIL bloquant, salles latérales desservies
 * par des portes, puits central OVALE vide à l'étage, loges en anneau + loge royale dans l'axe. L'étage (loges
 * assises à `ETAGE_M`) se rejoint par DEUX RAMPES d'angle (cases de hauteur croissante, puits TROUÉ dans l'ASCII même) —
 * AUCUN escalier explicite : la connectivité verticale s'auto-dérive du dénivelé (`surfaceLink`).
 */
describe('plan de l’Opéra — géométrie (relief unifié)', () => {
  const s = buildOperaFloorplan();
  const W = s.dimensions.w, H = s.dimensions.h;
  const AX = Math.round((W - 1) / 2); // axe de symétrie (22)
  const tilesOf = (z: number) => s.layers.find((l) => l.z === z)!.tiles;

  it('grille DÉRIVÉE du plan : 44×60, nettement plus haute que large', () => {
    expect(W).toBe(44);
    expect(H).toBe(60);
    expect(H).toBeGreaterThan(W);
  });

  it('deux COUCHES (rez z0 + étage z1) partageant les dimensions', () => {
    expect(s.layers.map((l) => l.z)).toEqual([0, 1]);
    expect(tilesOf(0)).toHaveLength(W * H);
    expect(tilesOf(1)).toHaveLength(W * H);
  });

  it('SCÈNE surélevée (hauteur > 0) et FOSSE en contrebas (< 0), portées par Layer.height', () => {
    expect(tileAt(s, AX, 8, 0)).toBe('planches'); // scène
    expect(heightAt(s, AX, 8, 0)).toBeGreaterThan(0);
    expect(tileAt(s, AX, 17, 0)).toBe('planches'); // fosse d'orchestre
    expect(heightAt(s, AX, 17, 0)).toBeLessThan(0);
  });

  it('l’ÉTAGE (galerie de loges) se pose un PLEIN NIVEAU au-dessus du point HAUT du rez (la scène)', () => {
    const scene = heightAt(s, AX, 8, 0); // planches de la scène, le plancher le plus haut du rez
    expect(heightAt(s, AX, 2, 1)).toBe(scene + METRES_PER_LEVEL); // loge royale, z1
  });

  it('PARTERRE en ÉVENTAIL : plus étroit près de la scène que vers le fond', () => {
    const widthAt = (y: number) => tilesOf(0).filter((t, i) => Math.floor(i / W) === y && t === 'plancher').length;
    expect(widthAt(42)).toBeGreaterThan(widthAt(18)); // le fond est plus large que l'avant
  });

  it('éventail : la cloison parterre↔salles latérales BLOQUE (pas de mur fantôme à traverser)', () => {
    const doorRow = Math.floor((20 + 43) / 2); // porte parterre↔côtés à mi-hauteur
    for (let y = 21; y <= 42; y++) {
      if (y === doorRow) continue;
      const row = tilesOf(0).slice(y * W, y * W + W);
      const lp = row.indexOf('plancher');
      const rp = row.lastIndexOf('plancher');
      expect(wallBetween(s, lp, y, lp - 1, y)).toBe(true); // on ne sort pas à gauche
      expect(wallBetween(s, rp, y, rp + 1, y)).toBe(true); // ni à droite
    }
  });

  it('PUITS CENTRAL OVALE : le cœur du parterre est VIDE au premier étage (ouvert sur le rez)', () => {
    expect(tileAt(s, AX, 28, 1)).toBe('vide');     // centre du puits ovale
    expect(tileAt(s, AX, 28, 0)).toBe('plancher'); // parterre en dessous
  });

  it('LOGE ROYALE (marbre) à l’étage, dans l’axe de la scène', () => {
    expect(tileAt(s, AX, 2, 1)).toBe('marbre');
  });

  it('ENTRÉES : portes d’honneur (façade) + entrée des artistes, débouchant à l’intérieur', () => {
    expect(s.entryPoints?.['entree-principale']).toBeDefined();
    expect(s.entryPoints?.['entree-artistes']).toBeDefined();
    const dx = 17, dy = 58; // Porte des Dames (façade sud)
    expect(wallBetween(s, dx, dy, dx, dy + 1)).toBe(false); // arête sud = porte (franchissable)
    expect(isWalkable(s, dx, dy, 0)).toBe(true);            // le seuil est marchable
  });

  it('CONNEXE par RAMPE : depuis le foyer on gagne la GALERIE (z1) — toute loge est atteignable, sans escalier', () => {
    // Départ : le seuil d'honneur (foyer, z0). `reachable` traverse portes ET rampes (surfaceLink), donc
    // change de couche là où une rampe rejoint la galerie à hauteur ÉGALE — plus aucun escalier explicite.
    const start: Pt = { ...s.entryPoints!['entree-principale'], z: 0 };
    expect(isWalkable(s, start.x, start.y, 0), 'le seuil de départ est marchable').toBe(true);
    const R = reachable(s, start, 99999, { blocked: new Set<string>() });
    const key = (x: number, y: number, z: number) => (z ? `${x},${y},${z}` : `${x},${y}`);
    // témoins z0 : scène (surélevée +1 m, rejointe par rampe douce) et parterre (sol).
    expect(R.has(key(AX, 8, 0)), 'scène atteignable').toBe(true);
    expect(R.has(key(AX, 28, 0)), 'parterre atteignable').toBe(true);
    // LOGES : la galerie (z1) est jointe DEPUIS LE REZ par les rampes — aucune loge scellée.
    let sealedUpper = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (isWalkable(s, x, y, 1) && !R.has(key(x, y, 1))) sealedUpper++;
    expect(sealedUpper, 'toute case de l’étage (loges) est atteignable depuis le foyer par la rampe').toBe(0);
  });
});

/**
 * Le théâtre est un CORPS architectural (`MapSpec.architecture`) : sans lui, `buildScene` ne dérive
 * AUCUNE masse (`deriveArchitectureMasses` n'itère que `scene.architecture`) et la loi de dégagement
 * (`clearedSpace`, `gameIso/builders/roofs.ts`) ne trouve, autour d'un allié posé au rez, ni pièce ni
 * emprise : elle le déclare à ciel ouvert et ne lève rien — le groupe reste en silhouette sous une
 * couche d'étage qui le coiffe (#1771).
 */
describe('plan de l’Opéra — corps architectural et loi de dégagement', () => {
  const s = buildOperaFloorplan();
  // La carte n'a pas de `heroStart` (`startOf` rend `null`) : les scénarios posent le groupe. Le départ
  // de QC est donc le seuil d'honneur, l'entrée par laquelle un joueur entre.
  const start = { ...s.entryPoints!['entree-principale'], z: 0 };

  it('CONSTRUCTION : un corps unique NON BORNÉ ne déclenche aucun résiduel (`validateArchitectureResiduals`)', () => {
    expect(() => buildOperaFloorplan()).not.toThrow();
    expect(s.architecture?.map((b) => b.id)).toEqual(['opera-staatsoper']);
    expect(s.architecture?.[0].storeys.map((st) => st.z)).toEqual([0, 1]);
  });

  it('QC de plan : aucune zone descriptive inatteignable, les deux étages habités sont atteints', () => {
    expect(unreachableDescriptiveZones(s, start)).toEqual([]);
    expect([...reachedFloors(s, start)].sort()).toEqual(expect.arrayContaining([0, 1]));
  });

  it('TOITURE DÉRIVÉE : le corps porte ses masses, toutes dérivées (aucune authorée)', () => {
    const masses = effectiveArchitecture(s).flatMap((b) => b.masses);
    const cases = (m: (typeof masses)[number]) => m.footprint.reduce((n, r) => n + r.w * r.h, 0);
    // FORME MESURÉE, pas un plancher : deux composantes 4-connexes du plancher réel — le corps principal
    // (les deux niveaux, dont la masse du z1 fait le COUVERCLE au-dessus d'un allié du rez) et le foyer,
    // qui n'a pas d'étage. Croupe (`hip`) des deux côtés : la portée dépasse `ROOF_GABLE_SPAN_MAX_M`.
    expect(masses.map((m) => [m.z, m.levels, m.profile, cases(m), !!m.derived])).toEqual([
      [1, 2, 'hip', 2100, true],
      [0, 1, 'hip', 336, true],
    ]);
  });

  it('LÉGENDES de zone : les chars du rez et de l’étage sont DISJOINTS', () => {
    // `zoneLegend` est indexé par le SEUL char (`mapSpec.ts` : `zoneLegend[b.char].id`) : un char partagé
    // donnerait la pièce d'un niveau à l'autre, en silence, à la fusion `{ ...ZONES_REZ, ...ZONES_ETAGE }`.
    const communs = Object.keys(ZONES_REZ).filter((ch) => ch in ZONES_ETAGE);
    expect(communs, `char(s) de zone partagé(s) entre les deux niveaux : ${communs.join(' ')}`).toEqual([]);
  });

  it('DÉGAGEMENT en salle verte (3,4,z0) : la PIÈCE se dégage, le couvercle se lève', () => {
    const cleared = clearedSpace(s, [{ x: 3, y: 4, z: 0 }]);
    // L'allié occupe une PIÈCE déclarée : la loi dégage son aire ENTIÈRE, pas l'emprise du bâtiment.
    expect([...cleared.zoneIds]).toContain('salle-verte');
    expect(cleared.roomlessCells.size, 'aucun repli sur l’emprise : la pièce a tranché').toBe(0);
    // COUVERCLE : la case (3,4) au niveau STRICTEMENT au-dessus du sien.
    expect(cleared.overheadCells.has('3,4,1'), 'la couche d’étage qui le surplombe se lève').toBe(true);
  });

  it('chaque PIÈCE est d’UN SEUL TENANT : aucun pas de son aire ne traverse un mur', () => {
    // Le calque de zones est LIBRE, l'ASCII porte les murs : rien ne les tient ensemble sinon ce test.
    // Une pièce morcelée est une pièce fausse — la loi de dégagement dégage l'aire ENTIÈRE de la zone
    // occupée (`clearedSpace` → `interiorZoneTilesById`), donc un allié enfermé dans l'îlot A ouvrirait
    // aussi l'îlot B, de l'autre côté d'un mur qu'il n'a pas franchi.
    const morcelees: string[] = [];
    for (const zone of s.effectZones ?? []) {
      const z = zone.z ?? 0;
      const cells = new Set((zone.tiles ?? []).map((t) => `${t.x},${t.y}`));
      if (!cells.size) continue;
      const [x0, y0] = [...cells][0].split(',').map(Number);
      const vus = new Set([`${x0},${y0}`]);
      const q = [[x0, y0] as [number, number]];
      while (q.length) {
        const [cx, cy] = q.pop()!;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const k = `${cx + dx},${cy + dy}`;
          if (!cells.has(k) || vus.has(k) || wallBetween(s, cx, cy, cx + dx, cy + dy, z)) continue;
          vus.add(k);
          q.push([cx + dx, cy + dy]);
        }
      }
      if (vus.size !== cells.size)
        morcelees.push(`« ${zone.id} » (z${z}) : ${vus.size}/${cells.size} cases jointes — îlot(s) séparé(s) par un mur : ${[...cells].filter((k) => !vus.has(k)).join(' ')}`);
    }
    expect(morcelees, `pièce(s) morcelée(s) par un mur de l’ASCII :\n${morcelees.join('\n')}`).toEqual([]);
  });

  it('les `roomZoneIds` d’un étage COUVRENT exactement les pièces de son niveau', () => {
    // ÉGALITÉ, pas inclusion : une pièce oubliée au corps n'est plus coiffée par sa nappe
    // (`massRoomZoneIds`/`cutawayForSection`) alors que la loi de dégagement, elle, la connaît encore par
    // `effectZones` — un trou qu'une simple vérification d'existence laisse passer en silence.
    for (const storey of s.architecture![0].storeys) {
      const declarees = (s.effectZones ?? []).filter((zone) => (zone.z ?? 0) === storey.z).map((zone) => zone.id);
      expect(declarees.length, `l’étage ${storey.id} porte des pièces`).toBeGreaterThan(0);
      expect([...storey.roomZoneIds].sort(), `pièces de ${storey.id}`).toEqual([...declarees].sort());
    }
  });
});

/**
 * #1180 — l'apparence d'un mur est une DONNÉE de la carte, la hauteur est de la géométrie. L'opéra
 * n'authore AUCUNE structure ni apparence d'arête (`walled` sans `wallStructures`) : tout son bâti
 * doit donc rendre le mur nu `plain`, y compris les arêtes de l'étage assises en hauteur.
 *
 * La garde porte sur les ÉLÉMENTS RENDUS, jamais sur `scene.walls`, et sa population est TOUT ce dont
 * la matière sort de la loi d'apparence d'arête (`edgeAppearance`, `gameIso/builders/roofs.ts`) :
 *  - `buildWalls` — les ARÊTES `wall:` (`wallGeometry`) et les COUTURES de nappes `seam:`
 *    (`roofSeamGeometry` → `closureAppearance`), matière lue sur `el.appearance` ;
 *  - `buildRoofs` — les PIGNONS de comble, `kind:'roof'` (`gableEnds` → `closureAppearance`), dont la
 *    matière de mur ne vit PAS dans `el.appearance` mais dans la face `material.domain === 'structure'`.
 * L'opéra ne coiffe aujourd'hui que des CROUPES (`profile: 'hip'`, cf. « TOITURE DÉRIVÉE » ci-dessus),
 * qui n'ont aucune fermeture de comble : la famille des pignons est lue, son compte va au message.
 */
describe('plan de l’Opéra — apparence des murs (#1180)', () => {
  const s = buildOperaFloorplan();
  const murs = buildWalls(s);
  const aretes = murs.filter((el) => el.key.startsWith('wall:'));
  const coutures = murs.filter((el) => el.key.startsWith('seam:'));
  const pignons = buildRoofs(s).flatMap((el) =>
    el.faces.filter((f) => f.material.domain === 'structure').map((f) => ({ key: el.key, appearance: f.material.id })));
  const rendus = [...aretes, ...coutures].map((el) => ({ key: el.key, appearance: el.appearance })).concat(pignons);
  const diag = `${aretes.length} arêtes, ${coutures.length} coutures, ${pignons.length} pignons`;

  it('la garde VOIT toute la population rendue : arêtes, coutures de nappes, pignons', () => {
    // Un élément de mur d'une AUTRE famille de clé échapperait au contrat sans que rien ne bronche.
    expect(murs.filter((el) => !el.key.startsWith('wall:') && !el.key.startsWith('seam:')).map((el) => el.key),
      `famille de clé non couverte (${diag})`).toEqual([]);
    // TÉMOINS NOMMÉS, un par famille peuplée : la garde ne peut pas devenir vide en silence.
    const arete = rendus.find((el) => el.key === 'wall:0,1,E,1'); // z1, assise en hauteur, nue
    // La clé d'une couture porte des ids de masse DÉRIVÉS (`sceneEdit.ts` : `-auto-z…-l…-…`) — une masse
    // de plus les renomme : la garde nomme la FAMILLE, pas un id que la dérivation peut rebaptiser.
    const couture = rendus.find((el) => el.key.startsWith('seam:'));
    expect(arete, `arête témoin de l’étage absente du rendu (${diag})`).toBeDefined();
    expect(couture, `aucune couture de nappe rendue (${diag})`).toBeDefined();
    expect(arete!.appearance).toBe('plain');
    expect(couture!.appearance).toBe('plain');
  });

  it('les arêtes NUES assises en hauteur rendent le mur nu — la cote ne fortifie plus', () => {
    const nuesHautes = new Set((s.walls ?? [])
      .filter((w) => !w.structure && !w.appearance && heightAt(s, w.x, w.y, w.z ?? 0) > 1)
      .map((w) => `wall:${w.x},${w.y},${w.side},${w.z ?? 0}`));
    expect(nuesHautes.has('wall:0,1,E,1'), 'l’arête témoin est bien nue ET assise en hauteur').toBe(true);
    const offenseurs = rendus.filter((el) => nuesHautes.has(el.key) && el.appearance !== 'plain');
    expect(offenseurs.map((el) => el.key),
      `arête(s) nue(s) en hauteur fortifiée(s) par leur cote — ${nuesHautes.size} arêtes nues en hauteur`).toEqual([]);
  });

  it('AUCUN élément rendu ne rend `mur-en-pierre` : l’étage est du mur nu, pas un rempart', () => {
    const offenseurs = rendus.filter((el) => el.appearance !== 'plain');
    expect(offenseurs.map((el) => `${el.key} → ${el.appearance}`),
      `élément(s) rendu(s) hors du mur nu alors qu’aucune arête n’authore d’apparence (${diag})`).toEqual([]);
  });
});
