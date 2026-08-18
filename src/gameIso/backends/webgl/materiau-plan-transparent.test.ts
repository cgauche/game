/**
 * CONVENTION — aucun matériau `transparent + DoubleSide` construit à la main dans `src/`.
 *
 * `WebGLRenderer.renderObject` scinde en DEUX rendus (avec deux résolutions de programme) tout
 * matériau dont `transparent === true && side === DoubleSide && forceSinglePass === false` ; la seule
 * porte du dépôt est `materiauPlanTransparent` (`worldMaterials.ts`), qui pose le drapeau.
 *
 * PÉRIMÈTRE ET ANGLE MORT, énoncés. PÉRIMÈTRE : `src/**` en entier (sources `.ts`/`.tsx`, tests
 * exclus) — pas seulement `src/gameIso` : un futur peintre three posé ailleurs sous `src/` tomberait
 * dans la même trappe. ANGLE MORT : le scan est TEXTUEL et ne voit que le LITTÉRAL d'un
 * `new MeshBasicMaterial({ … })` dont l'objet porte à la fois `transparent: true` et `DoubleSide`. Un
 * matériau construit EN DEUX TEMPS (`mat.side = THREE.DoubleSide` après coup), un paramètre calculé,
 * ou une autre classe de matériau lui échappent — c'est assumé : ce cliquet garde le motif COURANT du
 * dépôt, pas la propriété sémantique. Le SENS, lui, se mesure sur la scène réellement montée
 * (`stage/scene-rendue-invariants.test.tsx`).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url)); // …/backends/webgl/ → racine du dépôt
const SCAN_DIR = join(ROOT, 'src');

/** Le FOYER — le seul littéral légitime du dépôt, celui que la primitive construit. Son exemption est
 *  vérifiée plus bas : le fichier doit porter le motif ET le drapeau. */
const FOYER = 'src/gameIso/backends/webgl/worldMaterials.ts';

/** Les littéraux `new MeshBasicMaterial({ … })` d'une source qui portent le motif à deux passes. */
export function scanPlansDeuxPasses(src: string): string[] {
  const trouvés: string[] = [];
  const ouverture = /new\s+(?:THREE\.)?MeshBasicMaterial\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = ouverture.exec(src))) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    for (; i < src.length && profondeur > 0; i++) {
      if (src[i] === '{') profondeur++;
      else if (src[i] === '}') profondeur--;
    }
    const corps = src.slice(m.index, i);
    if (/transparent\s*:\s*true/.test(corps) && /DoubleSide/.test(corps)) trouvés.push(corps.split('\n')[0]);
  }
  return trouvés;
}

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p);
    }
  };
  walk(SCAN_DIR);
  return out;
}

describe('convention « plan transparent » — une seule passe, une seule source', () => {
  it('aucun `MeshBasicMaterial` littéral transparent+DoubleSide hors materiauPlanTransparent', () => {
    const fautifs: string[] = [];
    for (const f of sources()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (rel === FOYER) continue;
      for (const site of scanPlansDeuxPasses(readFileSync(f, 'utf8'))) fautifs.push(`${rel} : ${site}`);
    }
    expect(
      fautifs,
      `Router par materiauPlanTransparent (${FOYER}) :\n${fautifs.join('\n')}`,
    ).toEqual([]);
  });

  it('le FOYER porte bien le motif ET le drapeau — sinon l’exemption ne vaut plus rien', () => {
    const src = readFileSync(join(ROOT, FOYER), 'utf8');
    const sites = scanPlansDeuxPasses(src);
    expect(sites).toHaveLength(1);
    expect(sites[0]).toMatch(/forceSinglePass:\s*true/);
  });

  it('fail-closed : le scanner voit une écriture SYNTHÉTIQUE du motif', () => {
    const régressé = `const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xffffff),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });`;
    expect(scanPlansDeuxPasses(régressé)).toHaveLength(1);
    expect(scanPlansDeuxPasses('new MeshBasicMaterial({ transparent: true, side: DoubleSide })')).toHaveLength(1);
  });

  it('il ne crie PAS sur un littéral opaque ni sur un transparent à une face', () => {
    expect(scanPlansDeuxPasses('new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })')).toEqual([]);
    expect(scanPlansDeuxPasses('new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3 })')).toEqual([]);
  });
});
