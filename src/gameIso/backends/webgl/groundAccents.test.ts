import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  accentCounts,
  accentMatrix,
  buildGroundAccentMeshes,
  groupAccents,
  sceneGroundAccents,
  tileGroundAccents,
  SPECKLE_LIFT_M,
} from './groundAccents';
import { groundAccentsSvg, terrainDetail, PX_PER_M_V, TUFT_LEAN_AMPLITUDE } from '../affineDetail';
import { TUFT_FAN } from '../../detail/expand';
import { projGP } from '../project';
import { worldFaces } from './sceneMeshes';
import { facePoly, coplanarRanks, COPLANAR_BIAS_M } from './worldTris';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { testScenarios } from '../../../scenes/test-scenarios';
import { sceneMetresPerTile } from '../../../state/scene';
import type { Dims } from '../../../geometry/iso';
import type { DetailRecipe } from '../../detail/types';
import { touffesSurNappe } from '../../../../scripts/qc/spike-checks.mjs';

/**
 * ACCENTS DE SOL en instances : la PARITÉ STRUCTURELLE avec le semis de l'affine
 * (`groundAccentsSvg`, `affineDetail.ts`) — même seed monde ⇒ mêmes emplacements. La preuve ne
 * compare pas des pixels : elle REPROJETTE les positions monde des instances par la projection affine
 * (`projGP`) et exige qu'elles tombent EXACTEMENT sur les ancres du chemin SVG.
 */

const dims: Dims = { w: 8, h: 8 };
const MPT = 2;
const HERBE = terrainDetail('herbe')!;
const TERRE = terrainDetail('terre')!;

const n2 = (v: number) => Math.round(v * 100) / 100;

/** Ancres des TOUFFES du SVG : `groundAccentsSvg` émet 3 sous-chemins `M x,y` par touffe, tous au PIED
 *  (`affineDetail.ts:409-411`) — on garde une ancre sur trois. */
function tuftAnchorsOfSvg(svg: string): [number, number][] {
  const path = /stroke-linecap="round"/.test(svg) ? svg.match(/<path d="([^"]*)" fill="none"/)?.[1] ?? '' : '';
  const anchors = [...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
  return anchors.filter((_, i) => i % 3 === 0);
}

/** BRINS du SVG : le 2ᵉ sous-chemin de chaque touffe est `l ${lean·0,4},${−hp·1,15}` (`affineDetail.ts`,
 *  `groundAccentsSvg`) — la SEULE commande `l` du tracé, d'où se redécodent les deux grandeurs que
 *  l'émetteur a tirées du flux `blades` : la hauteur de brin (px) et le penché d'écran. */
function svgBrins(svg: string): { lean: number; hp: number }[] {
  const d = svg.match(/<path d="([^"]*)" fill="none"/)?.[1] ?? '';
  return [...d.matchAll(/l(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ lean: Number(m[1]) / 0.4, hp: -Number(m[2]) / 1.15 }));
}

/** Écarts de parité TOLÉRÉS : exactement le quantum d'arrondi `n2` (2 décimales) du SVG rapporté à
 *  chaque grandeur décodée — au-delà, ce n'est plus de l'arrondi mais un autre tirage.
 *  Hauteur : `n2` sur `−hp·1,15` px ⇒ 0,005/1,15/`PX_PER_M_V` = 1,812e-4 m (mesuré 1,811e-4 sur 1 600 brins).
 *  Lacet : `n2` sur `lean·0,4` ⇒ 0,005/0,4 de `lean`, redéplié sur 2·`TUFT_LEAN_AMPLITUDE` puis étalé
 *  sur 2π = 3,273e-2 rad (mesuré 3,270e-2). Contre-vérifié SENSIBLE : rangs du flux permutés ⇒ 9,9e-2 m
 *  d'écart de hauteur, 550× le seuil. */
const ECART_HAUTEUR_MAX = 2e-4;
const ECART_LACET_MAX = 3.3e-2;

/** Centres des MOUCHETIS du SVG : `dotSub` (`affineDetail.ts:274`) trace `M cx,cy−r L cx+1.2r,cy …` —
 *  le centre se relit donc en (x du 1er point, y du 2ᵉ). */
function speckleCentersOfSvg(svg: string): [number, number][] {
  const path = svg.match(/<path d="([^"]*)" fill="#/)?.[1] ?? '';
  return [...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)L(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[4])]);
}

/** Position monde d'un accent reprojetée par la projection AFFINE (l'inverse exact de `tileGroundAccents`). */
const reproject = (a: { pos: { x: number; y: number; z: number } }): [number, number] => {
  const p = projGP({ x: a.pos.x / MPT, y: a.pos.z / MPT, h: a.pos.y }, dims);
  return [n2(p[0]), n2(p[1])];
};

describe('groundAccents — parité de SEED avec le semis affine', () => {
  it('les TOUFFES tombent sur les ancres de `groundAccentsSvg`, tuile par tuile', () => {
    let vues = 0;
    for (const cell of [{ x: 1, y: 1, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 5, y: 4, z: 1 }]) {
      const h = cell.z * 4;
      const attendu = tuftAnchorsOfSvg(groundAccentsSvg(HERBE, cell, h, dims, MPT));
      const obtenu = tileGroundAccents(HERBE, cell, h, MPT).filter((a) => a.kind === 'tuft').map(reproject);
      expect(obtenu.length).toBe(attendu.length);
      expect(obtenu).toEqual(attendu);
      vues += attendu.length;
    }
    expect(vues).toBeGreaterThan(0); // un semis vide ne prouverait rien
  });

  it('les MOUCHETIS tombent sur les centres des losanges de `groundAccentsSvg`', () => {
    let vues = 0;
    for (const cell of [{ x: 2, y: 1, z: 0 }, { x: 4, y: 6, z: 0 }]) {
      const attendu = speckleCentersOfSvg(groundAccentsSvg(TERRE, cell, 0, dims, MPT));
      const obtenu = tileGroundAccents(TERRE, cell, 0, MPT).filter((a) => a.kind === 'speckle').map(reproject);
      expect(obtenu.length).toBe(attendu.length);
      expect(obtenu).toEqual(attendu);
      vues += attendu.length;
    }
    expect(vues).toBeGreaterThan(0);
  });

  it("la couleur d'un lot est celle que l'affine tire PAR TUILE (palette de la recette)", () => {
    const cell = { x: 7, y: 3, z: 0 };
    const svg = groundAccentsSvg(HERBE, cell, 0, dims, MPT);
    const attendue = svg.match(/stroke="(#[0-9a-f]{6})"/)?.[1];
    expect(HERBE.tufts!.colors).toContain(attendue);
    for (const a of tileGroundAccents(HERBE, cell, 0, MPT)) expect(a.color).toBe(attendue);
  });

  it('un semis est DÉTERMINISTE et distinct de celui de la tuile voisine', () => {
    const a = tileGroundAccents(HERBE, { x: 1, y: 1, z: 0 }, 0, MPT);
    expect(tileGroundAccents(HERBE, { x: 1, y: 1, z: 0 }, 0, MPT)).toEqual(a);
    const voisine = tileGroundAccents(HERBE, { x: 2, y: 1, z: 0 }, 0, MPT);
    expect(voisine.map((t) => t.pos.x - 2 * MPT)).not.toEqual(a.map((t) => t.pos.x - MPT));
  });

  it('la hauteur de brin reste dans les bornes de la DONNÉE, facteur de brin compris', () => {
    const [lo, hi] = HERBE.tufts!.hM;
    for (let x = 0; x < 12; x++)
      for (const t of tileGroundAccents(HERBE, { x, y: 5, z: 0 }, 0, MPT)) {
        expect(t.sizeM).toBeGreaterThanOrEqual(lo * 0.8);
        expect(t.sizeM).toBeLessThanOrEqual(hi * 1.3);
      }
  });

  // Les ANCRES (tests ci-dessus) ne disent rien du FLUX `blades` lui-même : elles viennent d'`expandRecipe`.
  // Ce test-ci confronte les DEUX tirages par touffe, dans leur RANG — une permutation des rangs laisse
  // les ancres intactes et n'y serait pas vue.
  it('la HAUTEUR puis le LACET de chaque brin sont les deux tirages du flux `blades`, dans cet ORDRE', () => {
    let vus = 0;
    let pireHauteur = 0;
    let pireLacet = 0;
    for (let x = 0; x < 20; x++)
      for (let y = 0; y < 20; y++) {
        const cell = { x, y, z: 0 };
        const brins = svgBrins(groundAccentsSvg(HERBE, cell, 0, dims, MPT));
        const touffes = tileGroundAccents(HERBE, cell, 0, MPT).filter((a) => a.kind === 'tuft');
        expect(touffes.length).toBe(brins.length);
        touffes.forEach((a, i) => {
          vus++;
          pireHauteur = Math.max(pireHauteur, Math.abs(brins[i].hp / PX_PER_M_V - a.sizeM));
          // Penché d'écran REDÉPLIÉ en son tirage uniforme [0,1] — celui que le POV et le WebGL
          // étalent, eux, sur un tour complet.
          const tirage = (brins[i].lean / TUFT_LEAN_AMPLITUDE + 1) / 2;
          pireLacet = Math.max(pireLacet, Math.abs(tirage * Math.PI * 2 - a.yaw));
        });
      }
    expect(vus).toBeGreaterThan(1000); // un semis maigre ne prouverait rien
    expect(pireHauteur).toBeLessThanOrEqual(ECART_HAUTEUR_MAX);
    expect(pireLacet).toBeLessThanOrEqual(ECART_LACET_MAX);
  });
});

describe('groundAccents — semis de SCÈNE et montage instancié', () => {
  const scene = buildScene(siegeSpec);
  const mpt = sceneMetresPerTile(scene);

  it('la scène de siège porte un semis MESURABLE', () => {
    const c = accentCounts(sceneGroundAccents(scene, mpt, () => 1));
    expect(c.tufts).toBeGreaterThan(0);
  });

  it('la teinte de visibilité de la case voyage sur la couleur des instances', () => {
    const eteinte = sceneGroundAccents(scene, mpt, () => 0.25);
    expect(eteinte.length).toBeGreaterThan(0);
    for (const a of eteinte) expect(a.tint).toBe(0.25);
    const meshes = buildGroundAccentMeshes(eteinte.slice(0, 200), { lit: false });
    const mesh = meshes[0];
    const attendue = new THREE.Color().set(eteinte.find((a) => `${a.kind}|${a.color}` === mesh.name)!.color).multiplyScalar(0.25);
    const lue = new THREE.Color();
    mesh.getColorAt(0, lue);
    expect(lue.r).toBeCloseTo(attendue.r, 6);
    expect(lue.g).toBeCloseTo(attendue.g, 6);
    expect(lue.b).toBeCloseTo(attendue.b, 6);
  });

  it('un lot par (type × couleur), chaque instance à sa pose monde', () => {
    const accents = sceneGroundAccents(scene, mpt, () => 1);
    const lots = groupAccents(accents);
    expect(lots.size).toBeGreaterThan(1);
    const meshes = buildGroundAccentMeshes(accents, { lit: false });
    expect(meshes.map((m) => m.count).reduce((a, b) => a + b, 0)).toBe(accents.length);
    // CULLING : rien n'est calculé d'avance — three résout la sphère à la première frame
    // (`Frustum.intersectsObject`) et `InstancedMesh` la surcharge pour couvrir SES instances, pas le
    // gabarit unité posé à l'origine. C'est cette couverture qu'on exige, pas l'appel.
    for (const m of meshes) expect(m.boundingSphere).toBeNull();
    const m0 = meshes[0];
    m0.computeBoundingSphere();
    const sphere = m0.boundingSphere!;
    expect(sphere.radius).toBeGreaterThan(0);
    for (const a of lots.get(m0.name)!)
      expect(sphere.center.distanceTo(new THREE.Vector3(a.pos.x, a.pos.y, a.pos.z))).toBeLessThanOrEqual(sphere.radius + 1e-6);
    const tuft = accents.find((a) => a.kind === 'tuft')!;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    accentMatrix(tuft).decompose(pos, quat, scale);
    expect(pos.x).toBeCloseTo(tuft.pos.x, 9);
    expect(pos.y).toBeCloseTo(tuft.pos.y, 9);
    expect(scale.y).toBeCloseTo(tuft.sizeM, 9);
    expect(scale.x).toBeCloseTo(2 * TUFT_FAN * tuft.sizeM, 9);
  });

  it('un mouchetis se DÉCOLLE de la nappe qui le porte (jamais coplanaire)', () => {
    const dot = tileGroundAccents(TERRE, { x: 2, y: 2, z: 0 }, 3.5, MPT).find((a) => a.kind === 'speckle')!;
    const pos = new THREE.Vector3();
    accentMatrix(dot).decompose(pos, new THREE.Quaternion(), new THREE.Vector3());
    expect(pos.y - dot.pos.y).toBeCloseTo(SPECKLE_LIFT_M, 9);
    expect(SPECKLE_LIFT_M).toBeGreaterThan(0.0015 * 2); // > 2 crans de COPLANAR_BIAS_M
  });

  it('un terrain SANS recette d\'accent ne sème rien', () => {
    const nu: DetailRecipe = { seedScope: 'tile' };
    expect(tileGroundAccents(nu, { x: 1, y: 1, z: 0 }, 0, MPT)).toEqual([]);
  });
});

/** Toutes les nappes SEMÉES du registre : chaque face de terrain nu porteuse d'une recette d'accent,
 *  avec le rang coplanaire que le monde fusionné lui donne et les accents qu'elle sème. */
function nappesSemees() {
  const out: {
    id: string;
    mpt: number;
    cell: { x: number; y: number; z: number };
    hs: number[];
    rank: number;
    accents: ReturnType<typeof tileGroundAccents>;
  }[] = [];
  for (const sc of testScenarios)
    for (const scene of [sc.scene, ...(sc.extraScenes ?? [])]) {
      const m2t = sceneMetresPerTile(scene);
      const wfs = worldFaces(scene);
      const rangs = coplanarRanks(wfs.map((w) => facePoly(w.face, m2t)));
      wfs.forEach((wf, i) => {
        const mat = wf.face.material;
        if (mat.domain !== 'terrain' || mat.part) return;
        const recette = terrainDetail(mat.id);
        if (!recette) return;
        out.push({
          id: `${sc.id}/${scene.id}/${mat.id}@${wf.cellKey}`,
          mpt: m2t,
          cell: wf.cell,
          hs: wf.face.poly.map((p) => p.h),
          rank: rangs[i],
          accents: tileGroundAccents(recette, wf.cell, wf.face.poly[0].h, m2t),
        });
      });
    }
  return out;
}

/** Plafond de densité de semis : le DOUBLE de la pire mesure du registre (1,0000 accent/m²). */
const DENSITE_MAX_M2 = 2;

describe('groundAccents — contrat des NAPPES SEMÉES, sur TOUT le registre de scènes', () => {
  const nappes = nappesSemees();

  it('le registre offre un échantillon de nappes semées qui vaille une mesure', () => {
    expect(nappes.length).toBeGreaterThan(20_000); // mesuré 28 739 faces sur 44 scènes
  });

  it("aucun accent ne déborde l'EMPRISE monde de sa case", () => {
    // `tileGroundAccents` mappe l'UV de tuile en `(cell ± 0,5) · mpt` : le MÊME repère que `gpToWorld`.
    // Un décalage de ce mapping poserait le semis d'une case sur sa voisine — invisible sur une nappe
    // unie, visible ici.
    const hors = nappes.filter((n) =>
      n.accents.some(
        (a) =>
          a.pos.x < (n.cell.x - 0.5) * n.mpt - 1e-9 ||
          a.pos.x > (n.cell.x + 0.5) * n.mpt + 1e-9 ||
          a.pos.z < (n.cell.y - 0.5) * n.mpt - 1e-9 ||
          a.pos.z > (n.cell.y + 0.5) * n.mpt + 1e-9,
      ),
    );
    expect(hors.map((n) => n.id)).toEqual([]);
  });

  it('toute nappe à recette est PLANE — le semis lit une seule hauteur pour la tuile entière', () => {
    // `sceneGroundAccents` passe `poly[0].h` pour toute la face : le jour où un terrain à recette
    // devient une rampe, les accents flotteraient ou s'enterreraient. Ce test le dira ce jour-là.
    const pentues = nappes.filter((n) => Math.max(...n.hs) - Math.min(...n.hs) > 1e-9);
    expect(pentues.map((n) => n.id)).toEqual([]);
  });

  it('toute nappe à recette est au rang coplanaire 0 — le décollement du mouchetis reste lisible', () => {
    // Un rang > 0 déplace la face de `rank × COPLANAR_BIAS_M` le long de sa normale (`biasPoly`) alors
    // que l'accent, lui, n'est pas dans la géométrie fusionnée : au 4ᵉ cran, le biais avale
    // `SPECKLE_LIFT_M` et le losange z-fighte de nouveau.
    const empiles = nappes.filter((n) => n.rank > 0);
    expect(empiles.map((n) => n.id)).toEqual([]);
    expect(SPECKLE_LIFT_M / COPLANAR_BIAS_M).toBeGreaterThan(3);
  });

  it("la DENSITÉ de semis au m² reste sous le double de la pire mesure du registre", () => {
    // Un emballement de semis se mesure au MÈTRE CARRÉ, jamais en absolu ni par tuile : la recette
    // déclare un `perM2` (1,1 pour l'herbe, ≤ 0,6 pour les mouchetis) et une tuile vaut `mpt²` m².
    // Mesures du 2026-08-10 sur les 44 scènes du registre : plafond 1,0000 accent/m² (galerie-modeles,
    // 50 112 instances sur 12 528 tuiles de 2 m ; poursuite-terrestre ; voyage/*), 0,9646 au siège.
    // Une borne PAR TUILE serait fausse — elle croît en `mpt²` : duel-naval sort à 25,0 accents/tuile
    // pour 0,2500/m² (mpt = 10). Une borne ABSOLUE ne dirait rien non plus : galerie-modeles pèse
    // 50 112 instances sans le moindre emballement, juste 6× plus de sol.
    const parScene = new Map<string, { n: number; m2: number }>();
    for (const n of nappes) {
      const cle = n.id.slice(0, n.id.indexOf('/', n.id.indexOf('/') + 1));
      const e = parScene.get(cle) ?? { n: 0, m2: 0 };
      e.n += n.accents.length;
      e.m2 += n.mpt * n.mpt;
      parScene.set(cle, e);
    }
    expect(parScene.size).toBeGreaterThan(30); // 44 scènes semées mesurées
    const debordent = [...parScene]
      .filter(([, e]) => e.n / e.m2 > DENSITE_MAX_M2)
      .map(([cle, e]) => `${cle} à ${(e.n / e.m2).toFixed(4)}/m²`);
    expect(debordent).toEqual([]);
  });
});

describe('spike-checks — attribution des touffes sur la nappe (garde de planche h)', () => {
  // La garde (h) de `scripts/qc/spike-checks.mjs` juge la présence des accents à la TEINTE EXACTE.
  // Un instrument qui ne trouve jamais rien passerait pour un instrument sévère : on le confronte à
  // une planche synthétique dont on connaît la réponse. Vitest héberge ce test faute de runner de
  // tests unitaires dans `scripts/qc/` ; l'import src → scripts suit le patron déjà en place
  // (`src/audio/no-phantom-sound.test.ts`, `src/comment-poison-guard.test.ts`).
  const NAPPE = '#3D6630'; // `swatch` de `src/state/terrain/defs/herbe.ts`
  const ACCENT = '#5C8A40'; // 1re couleur de `detail.tufts.colors` du même terrain

  /** Planche synthétique : un aplat de nappe de `cote`×`cote`, `pixels` peints à la teinte d'accent. */
  function planche(cote: number, hexNappe: string, hexAccent: string, pixels: [number, number][]) {
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [nr, ng, nb] = rgb(hexNappe);
    const [ar, ag, ab] = rgb(hexAccent);
    const data = new Uint8Array(cote * cote * 4);
    for (let i = 0; i < cote * cote; i++) data.set([nr, ng, nb, 255], i * 4);
    for (const [x, y] of pixels) data.set([ar, ag, ab, 255], (y * cote + x) * 4);
    return { w: cote, h: cote, data };
  }

  const PIXELS: [number, number][] = [[4, 4], [5, 4], [6, 5], [4, 7], [7, 7], [8, 6]];

  it("attribue les pixels d'accent quand la palette est celle de la DONNÉE", () => {
    const r = touffesSurNappe(planche(48, NAPPE, ACCENT, PIXELS), NAPPE, [ACCENT]);
    expect(r.fenetres).toBeGreaterThan(0);
    expect(r.partAvecTouffe).toBeGreaterThan(0);
    expect(r.partPixels).toBeGreaterThan(0);
  });

  it("n'attribue RIEN à une palette absente de la planche — la mesure n'est pas un tampon", () => {
    const r = touffesSurNappe(planche(48, NAPPE, ACCENT, PIXELS), NAPPE, ['#FF00FF']);
    expect(r.fenetres).toBeGreaterThan(0); // la nappe reste trouvée : c'est bien l'accent qui manque
    expect(r.partAvecTouffe).toBe(0);
    expect(r.partPixels).toBe(0);
  });

  it("ne trouve AUCUNE fenêtre de nappe quand l'albédo n'est pas celui de la planche", () => {
    const r = touffesSurNappe(planche(48, NAPPE, ACCENT, PIXELS), '#FF00FF', [ACCENT]);
    expect(r.fenetres).toBe(0);
  });
});
