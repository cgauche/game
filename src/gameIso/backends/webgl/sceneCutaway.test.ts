/**
 * SCISSION cuisson ⇄ DÉGAGEMENT (#1176, lot P2-2b) : le monde cuit ne se rejoue PAS quand le groupe se
 * déplace sous une masse. Le dégagement d'architecture est un MASQUE D'INDEX posé en place sur le bake,
 * jumeau de `applyVisibilityTint` — ce fichier tient ses cinq clauses : invariance du bake, PARITÉ de
 * rendu avec le bake filtré qu'il remplace, budget, idempotence, et accents de sol emportés par la
 * nappe qui les porte.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import {
  applyCutawayMask,
  applyVisibilityTint,
  bakeWorldGeometry,
  surfaceGrouping,
  worldFaces,
  type BakedWorld,
  type KeepEl,
} from './sceneMeshes';
import { facesGeometry } from './worldTris';
import { faceDepthOf } from './faceRelief';
import { mountGroundAccentLots, reposeGroundAccents, sceneGroundAccents } from './groundAccents';
import type { SceneEl } from '../../builders/types';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';

const scene = arene.scene;
const mpt = sceneMetresPerTile(scene);

/** Trois lois de dégagement DÉTERMINISTES — elles ne singent pas `cutawayForSection`, elles la
 *  remplacent par des verdicts reproductibles portant sur les trois natures d'élément à faces. */
const LOIS: Record<string, KeepEl> = {
  'sans-toits': (el) => el.kind !== 'roof',
  'damier-murs': (el) => !(el.kind === 'wall' && (el.cell.x + el.cell.y) % 2 === 0),
  z0: (el) => el.cell.z === 0,
};

const tint = (x: number, y: number): number => {
  const k = (Math.round(x) + Math.round(y)) % 3;
  return k === 0 ? 1 : k === 1 ? 0.42 : 0.15;
};

const copie = (g: THREE.BufferGeometry, nom: string): Float32Array =>
  (g.getAttribute(nom).array as Float32Array).slice();

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Les faces RÉELLEMENT DESSINÉES, relues dans l'INDEX (jamais dans les `spans` : ce serait relire
 *  l'intention au lieu du rendu) — par groupe de surface, dans l'ordre de dessin. Vérifie au passage
 *  que chaque face gardée y est CONTIGUË et complète : un index compacté à moitié lèverait ici. */
function facesRendues(baked: BakedWorld): Map<string, string[]> {
  const parDébut = new Map(baked.spans.map((s) => [s.start, s] as const));
  const idx = baked.geometry.getIndex()!.array as Uint32Array;
  const groupes = baked.geometry.userData.surfaceGroups;
  const out = new Map<string, string[]>();
  for (const g of baked.geometry.groups) {
    const liste: string[] = [];
    let p = g.start;
    while (p < g.start + g.count) {
      const s = parDébut.get(idx[p]);
      expect(s, `index ${p} : aucun début de face`).toBeDefined();
      for (let k = 0; k < s!.count; k++) expect(idx[p + k]).toBe(s!.start + k);
      liste.push(`${s!.cell.x},${s!.cell.y},${s!.cell.z}#${s!.count}`);
      p += s!.count;
    }
    if (liste.length) out.set(groupes[g.materialIndex!].key, liste);
  }
  return out;
}

/** Empreinte d'un rendu : nombre de groupes non vides, nombre de faces, et hachage de la liste ordonnée
 *  des faces par groupe. Elle ignore les POSITIONS — le rang coplanaire se calcule désormais sur la
 *  scène ENTIÈRE (contrat de `coplanarRanks`, cf. `builtFacesBox`), donc une face gardée peut sortir à
 *  un biais de 1,5 mm différent de celui qu'elle avait dans un bake amputé. C'est l'ENSEMBLE des
 *  triangles rendus que la parité juge. */
function empreinteDe(parGroupe: Map<string, string[]>): { groupes: number; faces: number; digest: string } {
  const clefs = [...parGroupe.keys()].sort();
  let faces = 0;
  for (const k of clefs) faces += parGroupe.get(k)!.length;
  const s = clefs.map((k) => `${k}=${parGroupe.get(k)!.length}:${fnv(parGroupe.get(k)!.join(','))}`).join(';');
  return { groupes: clefs.length, faces, digest: fnv(s) };
}

const empreinte = (baked: BakedWorld) => empreinteDe(facesRendues(baked));

/** RECONSTRUCTION INDÉPENDANTE de l'implémentation d'AVANT (lot P2-2 : le filtre s'appliquait à la
 *  CUISSON, `bakeWorldGeometry(scene, mpt, keepEl)`) — les faces sont écartées AVANT triangulation et
 *  groupement, et l'empreinte se lit sur ce bake amputé. Le témoin de parité n'est donc PAS une
 *  constante capturée à croire : il se recalcule à chaque run depuis les mêmes briques publiques
 *  (`worldFaces` → `facesGeometry` → `surfaceGrouping`), sans passer par le masque qu'il juge. */
function empreinteBakeFiltré(scn: Scene, keepEl: KeepEl): { groupes: number; faces: number; digest: string } {
  const m = sceneMetresPerTile(scn);
  const listées = worldFaces(scn).filter((wf) => keepEl(wf.el));
  const geoms = facesGeometry(listées.map((f) => f.face), m, faceDepthOf());
  const { groups, faceIndices } = surfaceGrouping(listées, m);
  const parGroupe = new Map<string, string[]>();
  faceIndices.forEach((idx, k) => {
    if (!idx.length) return;
    // Sommets d'une face = 3 par triangle (aucun sommet partagé : index IDENTITÉ au bake).
    parGroupe.set(groups[k].key, idx.map((i) => `${listées[i].cellKey}#${geoms[i].tris.length * 3}`));
  });
  return empreinteDe(parGroupe);
}

function masqué(scn: Scene, keepEl: KeepEl): BakedWorld {
  const baked = bakeWorldGeometry(scn, sceneMetresPerTile(scn));
  applyCutawayMask(baked, keepEl);
  return baked;
}

describe('INVARIANCE — deux dégagements, UN seul bake', () => {
  it('le masque n’écrit QUE l’index : même géométrie, mêmes sommets, mêmes couleurs', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    applyVisibilityTint(baked, tint);
    const gA = applyCutawayMask(baked, LOIS['sans-toits']).geometry;
    const attrPos = gA.getAttribute('position');
    const attrCol = gA.getAttribute('color');
    const posA = copie(gA, 'position');
    const colA = copie(gA, 'color');
    const comptesA = gA.groups.map((g) => g.count);
    const versionDe = (g: THREE.BufferGeometry) => (g.getIndex() as THREE.BufferAttribute).version;
    const versionA = versionDe(gA);
    const gB = applyCutawayMask(baked, LOIS['damier-murs']).geometry;
    // La géométrie rendue EST le bake — contrat de propriété de `BakedWorld`.
    expect(gB).toBe(gA);
    expect(gB.getAttribute('position')).toBe(attrPos);
    expect(gB.getAttribute('color')).toBe(attrCol);
    expect(copie(gB, 'position')).toEqual(posA);
    expect(copie(gB, 'color')).toEqual(colA);
    // Seuls l'index et les plages de dessin bougent — et ils bougent VRAIMENT (la sonde mord).
    expect(gB.groups.map((g) => g.count)).not.toEqual(comptesA);
    expect(versionDe(gB)).toBeGreaterThan(versionA);
    // Le tampon d'index n'est jamais retaillé : il porte tous les sommets, les gardés en tête.
    expect(gB.getIndex()!.count).toBe(attrPos.count);
  });

  it('AUCUNE face masquée n’est dessinée, et toutes les gardées le sont', () => {
    const baked = masqué(scene, LOIS['sans-toits']);
    const rendues = [...facesRendues(baked).values()].reduce((n, l) => n + l.length, 0);
    expect(rendues).toBe(baked.spans.filter((s) => LOIS['sans-toits'](s.el)).length);
    expect(rendues).toBeLessThan(baked.spans.length); // la loi retire vraiment quelque chose
  });
});

describe('PARITÉ — le masque rend EXACTEMENT les triangles du bake filtré qu’il remplace', () => {
  const SCENES: [string, () => Scene][] = [['arene', () => scene], ['vitrine', () => buildVitrineScene()]];

  for (const [sid, faire] of SCENES)
    it(`${sid} : les lois retirent vraiment des faces (sinon la parité ne pèserait rien)`, () => {
      const scn = faire();
      const plein = empreinteBakeFiltré(scn, () => true).faces;
      const restants = Object.keys(LOIS).map((lid) => empreinteBakeFiltré(scn, LOIS[lid]).faces);
      expect(plein).toBeGreaterThan(0);
      // `z0` est NEUTRE sur ces deux scènes (un seul étage) — elle reste un cas de parité valable ;
      // les deux autres amputent.
      expect(restants.filter((n) => n < plein).length).toBeGreaterThanOrEqual(2);
    });

  for (const [sid, faire] of SCENES)
    for (const lid of Object.keys(LOIS))
      it(`${sid} × ${lid} : mêmes groupes, mêmes faces, même ordre que le bake filtré`, () => {
        const scn = faire();
        const attendu = empreinteBakeFiltré(scn, LOIS[lid]);
        expect(attendu.faces).toBeGreaterThan(0);
        expect(empreinte(masqué(scn, LOIS[lid]))).toEqual(attendu);
      });

  for (const [sid, faire] of SCENES)
    for (const lid of Object.keys(LOIS))
      it(`${sid} × ${lid} : les plages de dessin ne se chevauchent pas et ne s’inversent pas`, () => {
        const baked = masqué(faire(), LOIS[lid]);
        const idx = baked.geometry.getIndex()!.array as Uint32Array;
        let fin = 0;
        for (const g of baked.geometry.groups) {
          // CONTIGUÏTÉ : chaque groupe reprend là où le précédent s'est arrêté — zéro chevauchement,
          // zéro trou (le masque compacte en UNE passe linéaire).
          expect(g.start).toBe(fin);
          fin = g.start + g.count;
          // ORDRE DE CUISSON conservé À L'INTÉRIEUR du groupe : les sommets référencés montent.
          for (let p = g.start + 1; p < fin; p++) expect(idx[p]).toBeGreaterThan(idx[p - 1]);
        }
      });
});

describe('BUDGET — masquer coûte une passe d’index, pas un re-bake', () => {
  it('le masque de l’arène tient sous le vingtième du bake', () => {
    // Mesures FONDATRICES (#1176) : bake plein 437 ms sur l'arène, 1 601 ms sur l'opéra, quand
    // `cleared` change à CHAQUE pas (identités `visualAllies`/`exploredSet`) ET à chaque cran de
    // caméra (`dims` → `frontFacadeCutaway`) — le re-bake par pas coûtait +700 ms mesurés au
    // navigateur. La borne porte sur le RAPPORT des deux mesures du MÊME run, jamais sur une horloge
    // murale : une machine chargée ralentit les deux à la fois, une régression vers le re-bake ramène
    // le rapport vers 1.
    const t0 = performance.now();
    const baked = bakeWorldGeometry(scene, mpt);
    const msBake = performance.now() - t0;
    applyCutawayMask(baked, LOIS['sans-toits']); // chauffe
    const t1 = performance.now();
    applyCutawayMask(baked, LOIS['damier-murs']);
    const msMasque = performance.now() - t1;
    expect(msMasque).toBeLessThanOrEqual(msBake / 20);
  });
});

describe('IDEMPOTENCE — le masque se relit du bake, jamais de l’état précédent', () => {
  it('A → B → A rend les mêmes triangles que le premier A', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    applyCutawayMask(baked, LOIS['sans-toits']);
    const premier = empreinte(baked);
    const plages = baked.geometry.groups.map((g) => [g.start, g.count]);
    applyCutawayMask(baked, LOIS['damier-murs']);
    applyCutawayMask(baked, LOIS['sans-toits']);
    expect(empreinte(baked)).toEqual(premier);
    expect(baked.geometry.groups.map((g) => [g.start, g.count])).toEqual(plages);
  });
});

describe('ACCENTS DE SOL — une nappe dégagée n’emporte pas que ses faces', () => {
  it('les touffes de la nappe retirée disparaissent, celles des autres restent', () => {
    const accents = sceneGroundAccents(scene, mpt);
    expect(accents.length).toBeGreaterThan(100);
    // La nappe la plus SEMÉE de l'arène : la retirer doit se voir.
    const parEl = new Map<SceneEl, number>();
    for (const a of accents) parEl.set(a.el, (parEl.get(a.el) ?? 0) + 1);
    const [cible, semés] = [...parEl.entries()].sort((a, b) => b[1] - a[1])[0];
    expect(semés).toBeGreaterThan(0);
    // La loi s'applique par REPOSE du semis instancié : les retenus sont compactés en tête, `count`
    // les borne (les instances de la nappe retirée ne sont plus dessinées).
    const lots = mountGroundAccentLots(accents, { lit: false });
    reposeGroundAccents(lots, (el) => el !== cible, () => 1);
    expect(lots.map((l) => l.mesh.count).reduce((a, b) => a + b, 0)).toBe(accents.length - semés);
    for (const lot of lots)
      expect(lot.retenus.some((r) => lot.accents[r].el === cible)).toBe(false);
    // Le semis lui-même n'a pas bougé : c'est l'APPLICATION qui filtre (le bake reste invariant).
    expect(accents.length).toBe(sceneGroundAccents(scene, mpt).length);
  });
});
