/**
 * SCISSION bake ⇄ teinte, et CHAMP CONTINU DE VISIBILITÉ (#1176, C6). Deux affaires, un seul canal :
 *  - la géométrie du monde ne se rejoue PAS quand la visibilité change (identité du bake, pureté de la
 *    passe, budget) ;
 *  - la teinte s'échantillonne AU SOMMET, à sa position monde, dans le champ que
 *    `visibilityTint.visibilityField` interpole entre centres de case. La grille est du système de jeu :
 *    une masse qui couvre 17 cases ne se teinte plus d'un bloc par sa case d'ancrage, et la frontière
 *    du brouillard traverse les faces au lieu de se décalquer sur le quadrillage.
 *
 * La loi n'est pas relue depuis l'implémentation : les attendus se RE-DÉRIVENT ici, de la couleur nue
 * du span × sa variance × le champ échantillonné à la position du sommet × la porte du modelé.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyVisibilityTint,
  bakeWorldGeometry,
  buildWorldGeometry,
  shadeSousSoleil,
  type BakedWorld,
  type TintAt,
} from './sceneMeshes';
import { tintOf, visibilityField } from './visibilityTint';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';

const scene = arene.scene;
const mpt = sceneMetresPerTile(scene);

/** Teinte de VISIBILITÉ non triviale : les trois états de la politique se répartissent sur la carte —
 *  une teinte constante ne prouverait rien d'un index sommet → monde. */
const tintA: TintAt = (x, y) => {
  const k = (Math.round(x) + Math.round(y)) % 3;
  return k === 0 ? 1 : k === 1 ? 0.42 : 0.15;
};
const tintB: TintAt = (x, y, z) => 1 - tintA(x, y, z) * 0.5;
/** Champ UNIFORME — le neutre de l'échantillonnage : quelle que soit la position du sommet, une seule
 *  valeur. C'est le régime où la loi d'AVANT (une teinte par span) et celle-ci coïncident. */
const uniforme = (v: number): TintAt => () => v;

const couleurs = (g: { getAttribute(n: string): { array: ArrayLike<number> } }): Float32Array =>
  (g.getAttribute('color').array as Float32Array).slice();

describe('BAKE ⇄ TEINTE — la visibilité ne retriangule rien', () => {
  it('la teinte écrit EN PLACE : un bake = UN consommateur, même géométrie, même attribut, seules les couleurs bougent', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const g1 = applyVisibilityTint(baked, tintA).geometry;
    const posA = (g1.getAttribute('position').array as Float32Array).slice();
    const colA = couleurs(g1);
    const versionDe = (g: typeof g1) => (g.getAttribute('color') as THREE.BufferAttribute).version;
    const versionA = versionDe(g1);
    const attrA = g1.getAttribute('color');
    const g2 = applyVisibilityTint(baked, tintB).geometry;
    // La géométrie RENDUE est celle du bake, et son attribut `color` est le même objet : c'est le contrat
    // de propriété de `BakedWorld` — la seconde teinte remplace la première à l'écran, elle ne coexiste
    // pas avec elle. Un second consommateur de teinte cuit SON bake.
    expect(g2).toBe(g1); // la MÊME BufferGeometry, jamais une reconstruction
    expect(g2.getAttribute('position').array as Float32Array).toEqual(posA);
    expect(g2.getAttribute('color')).toBe(attrA); // ré-écrit EN PLACE, pas un attribut neuf
    expect(couleurs(g2)).not.toEqual(colA);
    // `needsUpdate = true` incrémente la `version` de l'attribut (three : accesseur en écriture seule) —
    // sans ça le GPU garderait les couleurs de la frame précédente.
    expect(versionDe(g2)).toBeGreaterThan(versionA);
  });

  it('la teinte se re-multiplie sur la couleur NUE, jamais sur la précédente (A → B → A)', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const premier = couleurs(applyVisibilityTint(baked, tintA).geometry);
    applyVisibilityTint(baked, tintB);
    const retour = couleurs(applyVisibilityTint(baked, tintA).geometry);
    expect(retour.length).toBe(premier.length);
    let ecart = 0;
    for (let i = 0; i < retour.length; i++) ecart = Math.max(ecart, Math.abs(retour[i] - premier[i]));
    expect(ecart).toBeLessThan(1e-9);
  });

  it('BUDGET : repeindre la visibilité de l’arène coûte une passe de teinte, pas un re-bake', () => {
    // La borne porte sur le RAPPORT des deux mesures du MÊME run, jamais sur une horloge murale : une
    // machine chargée ralentit les deux à la fois, alors qu'une régression vers le re-bake ramène le
    // rapport vers 1. L'échantillonnage par sommet a un coût — c'est CE rapport qui le tient.
    const t0 = performance.now();
    const baked = bakeWorldGeometry(scene, mpt);
    const msBake = performance.now() - t0;
    applyVisibilityTint(baked, tintA); // chauffe
    const t1 = performance.now();
    applyVisibilityTint(baked, tintB);
    const msTeinte = performance.now() - t1;
    expect(msTeinte).toBeLessThanOrEqual(msBake / 20);
  });

  it('`buildWorldGeometry` reste la composition des deux (mêmes couleurs, même compte)', () => {
    const compose = couleurs(buildWorldGeometry(scene, mpt, tintA));
    const enDeuxTemps = couleurs(applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintA).geometry);
    expect(compose).toEqual(enDeuxTemps);
  });
});

/** Teinte RE-DÉRIVÉE de la loi pour le sommet `v` : couleur nue du span × sa variance × le champ
 *  échantillonné À LA POSITION MONDE du sommet (ramenée en cases) × la porte du modelé. Aucun terme
 *  n'est relu de l'implémentation jugée. */
function attenduAuSommet(baked: BakedWorld, spanIdx: number, v: number, tintAt: TintAt, fade = 1): THREE.Color {
  const span = baked.spans[spanIdx];
  const pos = baked.geometry.getAttribute('position').array as Float32Array;
  const champ = tintAt(pos[v * 3] / baked.mpt, pos[v * 3 + 2] / baked.mpt, span.cell.z);
  const k = shadeSousSoleil(baked.shades[v], fade) * champ;
  return new THREE.Color().set(span.color).multiplyScalar(span.varFactor * k);
}

describe('CHAMP CONTINU — la teinte s’échantillonne AU SOMMET, pas à la case d’ancrage', () => {
  it('chaque sommet porte la valeur du champ À SA POSITION (loi re-dérivée, arène entière)', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const arr = couleurs(applyVisibilityTint(baked, tintA).geometry);
    let vus = 0;
    // Tous les spans, un sommet sur sept : la couverture est la SCÈNE, pas un échantillon choisi.
    baked.spans.forEach((span, s) => {
      for (let v = span.start; v < span.start + span.count; v += 7) {
        const c = attenduAuSommet(baked, s, v, tintA);
        expect(arr[v * 3]).toBeCloseTo(c.r, 6);
        expect(arr[v * 3 + 1]).toBeCloseTo(c.g, 6);
        expect(arr[v * 3 + 2]).toBeCloseTo(c.b, 6);
        vus++;
      }
    });
    expect(vus).toBeGreaterThan(1000);
  });

  it('champ UNIFORME ⇒ teinte UNIFORME : aucune variation fantôme dans un span', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const arr = couleurs(applyVisibilityTint(baked, uniforme(0.5)).geometry);
    for (const span of baked.spans) {
      const r0 = arr[span.start * 3];
      const g0 = arr[span.start * 3 + 1];
      const b0 = arr[span.start * 3 + 2];
      for (let v = span.start; v < span.start + span.count; v++) {
        expect(arr[v * 3]).toBe(r0);
        expect(arr[v * 3 + 1]).toBe(g0);
        expect(arr[v * 3 + 2]).toBe(b0);
      }
    }
  });

  it('champ uniforme : la teinte reste un SCALAIRE exact sur la couleur pleine', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const plein = couleurs(applyVisibilityTint(baked, uniforme(1)).geometry);
    const demi = couleurs(applyVisibilityTint(baked, uniforme(0.5)).geometry);
    for (let i = 0; i < plein.length; i += 331) expect(demi[i]).toBeCloseTo(plein[i] * 0.5, 6);
  });
});

/**
 * LA SONDE DE L'AUDIT, PROMUE EN CONTRAT. Sur une scène à masses multi-cases (vitrine des bâtiments),
 * une frontière de visibilité qui traverse une masse doit se lire DANS la masse. Sous la loi d'avant
 * (`tintAt(span.cellKey)`), tout l'élément prenait la teinte de sa seule case d'ancrage — jusqu'à 17
 * cases teintées d'un bloc.
 */
describe('FRONTIÈRE — une masse à cheval sur le brouillard n’est plus teintée d’un bloc', () => {
  const vitrine: Scene = buildVitrineScene();
  const mv = sceneMetresPerTile(vitrine);
  const { w, h } = vitrine.dimensions;
  /** Demi-carte VUE : la frontière tombe entre les colonnes `mi-1` et `mi`, en plein dans les masses. */
  const mi = Math.floor(w / 2);
  const vues = new Set<string>();
  for (const l of vitrine.layers) for (let y = 0; y < h; y++) for (let x = 0; x < mi; x++) vues.add(`${x},${y},${l.z}`);
  const champ = visibilityField(vues, new Set<string>(), vitrine.dimensions);

  it('des spans portent des teintes DIFFÉRENTES d’un sommet à l’autre (fin du bloc uniforme)', () => {
    const baked = bakeWorldGeometry(vitrine, mv);
    const arr = couleurs(applyVisibilityTint(baked, champ).geometry);
    let panachés = 0;
    let ecartMax = 0;
    for (const span of baked.spans) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = span.start; v < span.start + span.count; v++) {
        lo = Math.min(lo, arr[v * 3]);
        hi = Math.max(hi, arr[v * 3]);
      }
      if (hi - lo > 1e-6) panachés++;
      ecartMax = Math.max(ecartMax, hi - lo);
    }
    expect(panachés).toBeGreaterThan(20);
    expect(ecartMax).toBeGreaterThan(0.05);
  });

  /**
   * LE FONDU LUI-MÊME, lu SUR LE RENDU. Le contrat ci-dessus (« des teintes différentes dans un span »)
   * ne suffit pas : un échantillonnage au PLUS PROCHE VOISIN le satisferait aussi — deux sommets d'une
   * même face tombant dans deux cases voisines y prendraient déjà deux valeurs, franches. Ce qui
   * distingue le champ CONTINU, c'est qu'il produit des valeurs INTERMÉDIAIRES, que la politique par
   * case ne contient pas. La teinte rendue se récupère sans rien savoir de l'implémentation : le même
   * bake peint une fois à champ PLEIN, une fois au champ — le rapport des deux EST le facteur appliqué.
   */
  it('des sommets portent des teintes INTERMÉDIAIRES, absentes de la politique par case (le FONDU)', () => {
    const baked = bakeWorldGeometry(vitrine, mv);
    const plein = couleurs(applyVisibilityTint(baked, uniforme(1)).geometry);
    const rendu = couleurs(applyVisibilityTint(baked, champ).geometry);
    const paliers = [tintOf('visible'), tintOf('unknown')]; // les deux seules valeurs de la politique
    const MARGE = 0.02;
    let intermédiaires = 0;
    for (let i = 0; i < plein.length; i += 3) {
      if (plein[i] < 1e-3) continue; // canal éteint : le rapport n'y est pas mesurable
      const t = rendu[i] / plein[i];
      if (paliers.every((p) => Math.abs(t - p) > MARGE) && t > Math.min(...paliers) && t < Math.max(...paliers))
        intermédiaires++;
    }
    // Mesuré à l'arbre C6 sur `vitrine-batiments` : des milliers de sommets tombent entre les paliers.
    // Au plus proche voisin il y en aurait EXACTEMENT zéro — c'est ce zéro que cette clause interdit.
    expect(intermédiaires).toBeGreaterThan(200);
  });

  it('un ÉLÉMENT multi-cases reçoit plusieurs teintes, et pas celle de sa seule case d’ancrage', () => {
    const baked = bakeWorldGeometry(vitrine, mv);
    const pos = baked.geometry.getAttribute('position').array as Float32Array;
    // Un span dont les sommets traversent la frontière : c'est là que la loi d'ancrage mentait.
    const traversant = baked.spans.find((span) => {
      let lo = Infinity;
      let hi = -Infinity;
      for (let v = span.start; v < span.start + span.count; v++) {
        const t = champ(pos[v * 3] / mv, pos[v * 3 + 2] / mv, span.cell.z);
        lo = Math.min(lo, t);
        hi = Math.max(hi, t);
      }
      return hi - lo > 0.1;
    });
    expect(traversant, 'la vitrine doit porter une masse à cheval sur la frontière').toBeDefined();
    // Ce que la loi d'ANCRAGE aurait peint sur TOUT l'élément : une seule couleur, celle de sa case.
    const arr = couleurs(applyVisibilityTint(baked, champ).geometry);
    const s = baked.spans.indexOf(traversant!);
    const ancrage = champ(traversant!.cell.x, traversant!.cell.y, traversant!.cell.z);
    let écarts = 0;
    const rendus = new Set<number>();
    for (let v = traversant!.start; v < traversant!.start + traversant!.count; v++) {
      rendus.add(arr[v * 3]);
      const bloc = new THREE.Color()
        .set(traversant!.color)
        .multiplyScalar(traversant!.varFactor * shadeSousSoleil(baked.shades[v], 1) * ancrage);
      if (Math.abs(arr[v * 3] - bloc.r) > 1e-3) écarts++;
      // …et le sommet porte bien, LUI, la valeur du champ à sa position.
      const c = attenduAuSommet(baked, s, v, champ);
      expect(arr[v * 3]).toBeCloseTo(c.r, 6);
    }
    expect(rendus.size).toBeGreaterThan(1); // plusieurs teintes RENDUES dans le même élément
    expect(écarts).toBeGreaterThan(0); // …dont certaines s'écartent franchement du bloc d'ancrage
  });

  it('les CORPS, eux, restent posés sur leur case : le champ y rend la valeur discrète', () => {
    // Un billboard n'a qu'une couleur pour tout son quad ; le champ, aux coordonnées entières de sa
    // case, rend exactement la teinte de cette case — l'échantillonnage continu ne les bouge pas.
    expect(champ(0, 0, 0)).toBe(tintOf('visible'));
    expect(champ(w - 1, 0, 0)).toBe(tintOf('unknown'));
  });
});
