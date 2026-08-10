/**
 * SPIKE WebGL — SCISSION bake ⇄ teinte : la géométrie du monde ne se rejoue PAS quand la visibilité
 * change. Ce fichier tient les quatre clauses de la scission : identité du bake, pureté de la teinte,
 * budget de la passe de teinte, et PARITÉ des couleurs avec la fusion d'un seul tenant.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { applyVisibilityTint, bakeWorldGeometry, buildWorldGeometry } from './sceneMeshes';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { sceneMetresPerTile } from '../../../state/scene';

const scene = arene.scene;
const mpt = sceneMetresPerTile(scene);

/** Teinte de VISIBILITÉ non triviale : les trois états de la politique se répartissent sur la carte —
 *  une teinte constante ne prouverait rien d'un index sommet → case. */
const tintA = (key: string): number => {
  const [x, y] = key.split(',').map(Number);
  const k = (x + y) % 3;
  return k === 0 ? 1 : k === 1 ? 0.42 : 0.15;
};
const tintB = (key: string): number => 1 - tintA(key) * 0.5;

const couleurs = (g: { getAttribute(n: string): { array: ArrayLike<number> } }): Float32Array =>
  (g.getAttribute('color').array as Float32Array).slice();

describe('BAKE ⇄ TEINTE — la visibilité ne retriangule rien', () => {
  it('la teinte écrit EN PLACE : un bake = UN consommateur, même géométrie, même attribut, seules les couleurs bougent', () => {
    const baked = bakeWorldGeometry(scene, mpt);
    const g1 = applyVisibilityTint(baked, tintA);
    const posA = (g1.getAttribute('position').array as Float32Array).slice();
    const colA = couleurs(g1);
    const versionDe = (g: typeof g1) => (g.getAttribute('color') as THREE.BufferAttribute).version;
    const versionA = versionDe(g1);
    const attrA = g1.getAttribute('color');
    const g2 = applyVisibilityTint(baked, tintB);
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
    const premier = couleurs(applyVisibilityTint(baked, tintA));
    applyVisibilityTint(baked, tintB);
    const retour = couleurs(applyVisibilityTint(baked, tintA));
    expect(retour.length).toBe(premier.length);
    let ecart = 0;
    for (let i = 0; i < retour.length; i++) ecart = Math.max(ecart, Math.abs(retour[i] - premier[i]));
    expect(ecart).toBeLessThan(1e-9);
  });

  it('BUDGET : repeindre la visibilité de l’arène coûte une passe de teinte, pas un re-bake', () => {
    // Deux mesures fondatrices (#1176, arène = la scène la plus lourde du spike) : bake 492 ms,
    // réécriture des seules couleurs 1,3 ms — un rapport de ~×378. La borne porte sur le RAPPORT des
    // deux mesures du MÊME run, jamais sur une horloge murale : une machine chargée ralentit les deux à
    // la fois, alors qu'une régression vers le re-bake ramène le rapport vers 1.
    const t0 = performance.now();
    const baked = bakeWorldGeometry(scene, mpt);
    const msBake = performance.now() - t0;
    applyVisibilityTint(baked, tintA); // chauffe
    const t1 = performance.now();
    applyVisibilityTint(baked, tintB);
    const msTeinte = performance.now() - t1;
    expect(msTeinte).toBeLessThanOrEqual(msBake / 20);
  });
});

describe('PARITÉ — la composition rend EXACTEMENT les couleurs de la fusion d’un seul tenant', () => {
  /** Relevé de l'implémentation d'AVANT la scission (`buildWorldGeometry` fusionnant géométrie et
   *  teinte en une passe), sur l'arène à `tintA` : longueur de l'attribut, somme de tous les canaux,
   *  et huit sommets échantillonnés. Les valeurs sont le TÉMOIN — elles ne se régénèrent pas depuis
   *  le code qu'elles jugent. */
  const TEMOIN = {
    count: 174222,
    somme: 10716.469067239144,
    ech: [
      [0, 0.3277781009674072],
      [1, 0.27049779891967773],
      [2, 0.16826939582824707],
      [999, 0.3277781009674072],
      [5000, 0.00412317831069231],
      [20001, 0.0074897464364767075],
      [60000, 0.08465362340211868],
      [120000, 0.041957464069128036],
    ] as [number, number][],
  };

  /** Ce que dit une rupture de ce témoin, et quoi en faire — la valeur REÇUE affichée par l'échec EST le
   *  témoin courant, il n'y a rien d'autre à exécuter pour le re-capturer. */
  const GUIDE =
    'témoin de parité bake+tint vs implémentation pré-scission (capturé 2026-08-10) — si l’ARÈNE ' +
    '(`src/scenes/test-scenarios/arene`) ou une PALETTE de surface a changé VOLONTAIREMENT, recopie la ' +
    'valeur REÇUE ci-dessus dans `TEMOIN` et justifie-le dans le commit ; si rien n’a changé ' +
    'volontairement, c’est une VRAIE régression de parité — bake+tint ne rend plus les couleurs de la ' +
    'fusion d’un seul tenant.';

  it('bake + teinte reproduisent le témoin d’avant la scission, au bit près', () => {
    const c = couleurs(applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintA));
    expect(c.length, `count — ${GUIDE}`).toBe(TEMOIN.count);
    let somme = 0;
    for (let i = 0; i < c.length; i++) somme += c[i];
    expect(somme, `somme — ${GUIDE}`).toBe(TEMOIN.somme);
    for (const [i, v] of TEMOIN.ech) expect(c[i], `ech[${i}] — ${GUIDE}`).toBe(v);
  });

  it('`buildWorldGeometry` reste la composition des deux (mêmes couleurs, même compte)', () => {
    const compose = couleurs(buildWorldGeometry(scene, mpt, tintA));
    const enDeuxTemps = couleurs(applyVisibilityTint(bakeWorldGeometry(scene, mpt), tintA));
    expect(compose).toEqual(enDeuxTemps);
  });
});
