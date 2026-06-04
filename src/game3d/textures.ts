/**
 * Textures procédurales (canvas → THREE.CanvasTexture). Provisoires : conçues
 * pour être remplacées par des assets IA/packs sans toucher au reste du rendu.
 */
import * as THREE from 'three';
import { Terrain } from '../state/scene';

const cache = new Map<string, THREE.Texture>();

function noiseTexture(
  base: string,
  speckle: string,
  density = 0.25,
  cells?: { color: string; lines: number },
): THREE.Texture {
  const key = `${base}|${speckle}|${density}|${cells?.color ?? ''}|${cells?.lines ?? 0}`;
  if (cache.has(key)) return cache.get(key)!;
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // Mouchetures pseudo-aléatoires (déterministes).
  let seed = 1337;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = speckle;
  for (let i = 0; i < S * S * density; i++) {
    const x = Math.floor(rnd() * S);
    const y = Math.floor(rnd() * S);
    ctx.globalAlpha = 0.15 + rnd() * 0.35;
    ctx.fillRect(x, y, 1 + Math.floor(rnd() * 2), 1 + Math.floor(rnd() * 2));
  }
  ctx.globalAlpha = 1;
  // Motif de dalles/planches optionnel.
  if (cells) {
    ctx.strokeStyle = cells.color;
    ctx.lineWidth = 1;
    const step = S / cells.lines;
    for (let i = 0; i <= cells.lines; i++) {
      ctx.beginPath();
      ctx.moveTo(i * step, 0);
      ctx.lineTo(i * step, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * step);
      ctx.lineTo(S, i * step);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}

export function terrainTexture(t: Terrain): THREE.Texture {
  switch (t) {
    case 'herbe':
      return noiseTexture('#3f6f30', '#2c5320', 0.4);
    case 'sol':
      return noiseTexture('#6b5d4f', '#574a3e', 0.35);
    case 'route':
      return noiseTexture('#9a8358', '#7d6a45', 0.3);
    case 'plancher':
      return noiseTexture('#7a5a36', '#5e4527', 0.12, { color: '#46331d', lines: 4 });
    case 'mur':
      return noiseTexture('#5a5550', '#48433e', 0.18, { color: '#3a3530', lines: 3 });
    case 'porte':
      return noiseTexture('#6b4a2b', '#523619', 0.12, { color: '#3a2712', lines: 2 });
    case 'eau':
      return noiseTexture('#2f5a8a', '#27507a', 0.2);
    case 'bois':
      return noiseTexture('#244d1f', '#163813', 0.4);
    default:
      return noiseTexture('#555', '#444');
  }
}
