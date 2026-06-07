/**
 * Helper de galerie : rig ANIMÉ en SVG + CSS pur (pas de GIF). On échantillonne un clip
 * DENSÉMENT, on résout les os à chaque échantillon (FK réelle), puis on émet UN seul rig +
 * des @keyframes CSS pour chaque os qui bouge — interpolation linéaire de la matrice MONDE
 * entre échantillons denses → suit l'arc FK. Vectoriel, net, léger (1 rig + un peu de CSS,
 * pas K images empilées). Chaque tuile a un `uid` qui scope son CSS.
 *
 * Pré-requis DOM : la tuile est un <svg viewBox="0 0 W H"> SANS transform sur le wrapper —
 * `transform-box:view-box; transform-origin:0 0` aligne alors la matrice CSS sur la matrice
 * d'attribut SVG (mêmes coordonnées que le rendu statique).
 */
import type { ResolvedBone } from '../src/gameIso/rig/composeRig';
import type { Matrix } from '../src/gameIso/rig/kinematics';

const EPS = 0.02;
const matEq = (a: Matrix, b: Matrix) => a.every((v, i) => Math.abs(v - b[i]) < EPS);
const mat = (m: Matrix) => `matrix(${m.map((v) => +v.toFixed(3)).join(',')})`;

/** Markup statique d'un os (parts + échelle interne), SANS le transform monde (piloté par CSS/attr). */
function boneInner(b: ResolvedBone): string {
  const inner = b.parts.map((p) => (p.mirror ? `<g transform="scale(-1,1)">${p.svg}</g>` : p.svg)).join('');
  return `<g transform="scale(${b.scale[0].toFixed(4)},${b.scale[1].toFixed(4)})">${inner}</g>`;
}

export interface AnimRig {
  /** Règles CSS (à concaténer dans un <style> global). */
  css: string;
  /** Markup SVG du rig (à placer dans un <svg><g class="<uid>-root">…). */
  svg: string;
}

/**
 * @param samples os résolus à chaque échantillon temporel (MÊME ensemble d'os à chaque pas).
 * @param durationMs durée totale du cycle (boucle).
 * @param uid identifiant unique de tuile (scope CSS).
 */
export function animatedRig(samples: ResolvedBone[][], durationMs: number, uid: string): AnimRig {
  const base = samples[0];
  const N = samples.length;
  const matsById = new Map<string, Matrix[]>();
  for (const b of base) {
    matsById.set(b.id, samples.map((s) => (s.find((x) => x.id === b.id)?.matrix ?? b.matrix)));
  }
  const styleParts: string[] = [];
  const bodyParts: string[] = [];
  for (const b of [...base].sort((a, z) => a.z - z.z)) {
    const mats = matsById.get(b.id)!;
    const cls = `${uid}_${b.id}`;
    if (mats.some((m) => !matEq(m, mats[0]))) {
      const kf = mats.map((m, i) => `${((i / (N - 1)) * 100).toFixed(2)}%{transform:${mat(m)}}`).join('');
      styleParts.push(`@keyframes ${cls}{${kf}}`);
      styleParts.push(`.${cls}{animation:${cls} ${Math.round(durationMs)}ms linear infinite;transform-box:view-box;transform-origin:0 0}`);
      bodyParts.push(`<g class="${cls}" style="transform:${mat(mats[0])}">${boneInner(b)}</g>`);
    } else {
      bodyParts.push(`<g transform="${mat(mats[0])}">${boneInner(b)}</g>`);
    }
  }
  return { css: styleParts.join(''), svg: bodyParts.join('') };
}

/** Échantillonne uniformément [0, durationMs] en N points (inclus les bornes). */
export function sampleTimes(durationMs: number, n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i / (n - 1)) * durationMs);
}
