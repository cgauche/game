// @vitest-environment jsdom
/**
 * BILLBOARDS EN PREMIÈRE PERSONNE (#1176, P3-1b) — l'art des quads suit enfin le regard de l'œil.
 * Trois faits, chacun réfutable seul :
 *
 *  1. la VUE d'une entité se prend au CAP Dir8 du meneur (branche `perspective` de `billboardView`),
 *     et à lui seul : un pivot change la planche de textures, une frame de marche ne la change PAS
 *     (le patron anti-recuisson qu'`artRot` documente pour la vue de plateau) ;
 *  2. le CRAN d'art des PROPS se dérive du même cap (`povArtRot`) — l'atlas de décor n'existe qu'aux
 *     quarts de tour, et sans cette dérivation les props gardent le cran de la dernière vue affine ;
 *  3. la RELATION entre les deux regards est MESURÉE : au cap qu'un cran affine regarde, la branche
 *     perspective rend exactement ce que rend `project(·, cran)` sur les huit orientations — c'est
 *     d'elle que `povYawDeg` tient son décalage de 45°.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { DIR8_ORDER, type Dir8 } from '../../state/dir8';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Rot } from '../../geometry/iso';
import type { PropEl } from '../builders/types';
import type { ActorPose, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { billboardView } from '../backends/webgl/billboardMath';
import { project, type View } from '../rig/facing';
import { dir8Basis } from '../pov/camera';
import * as svgTexture from '../backends/webgl/svgTexture';
import { artRot, GameStage3D, povArtRot, povYawDeg, setStageRendererFactory, type StageFrame, type StageRenderer } from './GameStage3D';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
const CRANS: Rot[] = [0, 1, 2, 3];

/** Le cap que la caméra AFFINE d'un cran regarde (la relation dont `povYawDeg` se dérive). */
const capDuCran = (rot: Rot): Dir8 => DIR8_ORDER[(7 + 2 * rot) % 8];

/** La vue perspective d'une entité vue depuis un cap donné — la branche que le lot branche. */
const vueDepuis = (cap: Dir8, ent: Dir8) => billboardView({ kind: 'perspective', ...dir8Basis(cap) }, ent);

describe('POV — la relation entre les deux regards (parité mesurée)', () => {
  it('au cap qu’un cran regarde, la branche perspective rend ce que rend `project` sur les 8 caps', () => {
    for (const rot of CRANS)
      for (const ent of DIR8_ORDER)
        expect(vueDepuis(capDuCran(rot), ent), `cran ${rot} / entité ${ent}`).toEqual(project(ent, rot));
  });

  it('`povYawDeg` place chaque cran à son lacet, et les huit caps tous les 45°', () => {
    for (const rot of CRANS) expect(povYawDeg(capDuCran(rot)), `cran ${rot}`).toBe(rot * 90);
    expect(DIR8_ORDER.map(povYawDeg)).toEqual([45, 90, 135, 180, 225, 270, 315, 0]);
  });

  it('`povArtRot` PLANCHÉRISE comme `artRot` : le cap d’un cran y reste, un cap cardinal prend le cran du dessous', () => {
    for (const rot of CRANS) expect(povArtRot(capDuCran(rot)), `cap ${capDuCran(rot)}`).toBe(rot);
    // Cardinaux (entre deux crans) : N→0, E→1, S→2, O→3.
    expect((['N', 'E', 'S', 'O'] as Dir8[]).map(povArtRot)).toEqual([0, 1, 2, 3]);
    // …et les huit caps couvrent bien les quatre crans (aucun cran figé).
    expect(new Set(DIR8_ORDER.map(povArtRot))).toEqual(new Set(CRANS));
  });
});

// ————————————————————————————————————————————————————————————————
// BANC DE MONTAGE — le vrai écran, ses clés de texture pour seule trace
// ————————————————————————————————————————————————————————————————

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(): void {}
}

const SCENE: Scene = emptyScene(12, 12);
const MPT = sceneMetresPerTile(SCENE);
const TINT: TintAt = () => 1;
const KEEP = () => true;
const HÉROS = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });

/** Un acteur au cap SUD, et un décor directionnel : l'un juge la vue d'entité, l'autre le cran d'atlas. */
const ACTEURS: ActorPose[] = [{ c: HÉROS, x: 4, y: 4, z: 0, facing: 'S' }];
const TONNEAU: PropEl = {
  kind: 'prop', source: 'entity', key: 'prop:tonneau', ref: 'tonneau', facing: 'S',
  cell: { x: 6, y: 4, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 }, interact: false,
  states: { visible: true },
};
const ELS: SceneBillboardEls = { tokens: [], props: [TONNEAU] };

/** Les clés de texture DEMANDÉES par le montage — la seule trace lisible de ce que l'écran peint. */
let clés: string[] = [];

/** Découpe une clé (`identity|view|mirror|px`) — l'identité d'un acteur porte elle-même des `|`. */
function découper(clé: string): { identity: string; view: View; mirror: boolean } {
  const p = clé.split('|');
  return { identity: p.slice(0, -3).join('|'), view: p[p.length - 3] as View, mirror: p[p.length - 2] === 'm' };
}

const clésDe = (préfixe: string) => clés.filter((k) => k.startsWith(préfixe)).map(découper);

function monter(facing: Dir8, partyPos: { x: number; y: number }): void {
  monterCadre(cadrePov(facing, partyPos));
}

function monterCadre(frame: StageFrame): void {
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(écran(frame)));
}

const cadrePov = (facing: Dir8, partyPos: { x: number; y: number }): StageFrame =>
  ({ mode: 'pov', partyPos, facing, indoor: false, cid: HÉROS.id });

/** Le cadre de PLATEAU au cran `rot` — l'autre branche de l'union, celle que le lot ne doit PAS avoir
 *  fait basculer dans le regard perspective. */
const cadreAffine = (rot: Rot): StageFrame =>
  ({ mode: 'plateau', dims: { ...SCENE.dimensions, rot, view: 'iso' }, cam: { x: 6, y: 6 }, zoom: 1 });

function écran(frame: StageFrame): JSX.Element {
  return (
    <GameStage3D
      scene={SCENE}
      mpt={MPT}
      frame={frame}
      tintAt={TINT}
      keepEl={KEEP}
      els={ELS}
      actors={ACTEURS}
      gameTime={720}
      lightLevel={1}
      lights={[]}
    />
  );
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  clés = [];
  // La rasterisation elle-même n'a rien à dire ici (jsdom ne peint pas) : ce banc mesure les CLÉS
  // demandées, donc la vue et le cran que l'écran a choisis pour chaque sujet.
  vi.spyOn(svgTexture, 'getBillboardTexture').mockImplementation((clé) => {
    clés.push(clé);
    return Promise.resolve(new THREE.CanvasTexture(document.createElement('canvas')));
  });
});
afterEach(() => {
  démonter();
  vi.restoreAllMocks();
});

describe('POV — la VUE d’une entité suit le cap du meneur (#1176 P3-1b)', () => {
  it('les huit caps donnent la vue perspective de leur cap, et pas une planche unique', () => {
    const vues = new Map<Dir8, { view: View; mirror: boolean }>();
    for (const cap of DIR8_ORDER) {
      clés = [];
      monter(cap, { x: 4, y: 6 });
      const acteur = clésDe('acteur:');
      expect(acteur, `cap ${cap} : l’acteur doit être texturé`).toHaveLength(1);
      expect({ view: acteur[0].view, mirror: acteur[0].mirror }, `cap ${cap}`).toEqual(vueDepuis(cap, 'S'));
      vues.set(cap, { view: acteur[0].view, mirror: acteur[0].mirror });
      démonter();
    }
    // Réfutation du cran FIGÉ : une vue prise au cran 0 rendrait la MÊME planche aux huit caps.
    expect(new Set([...vues.values()].map((v) => `${v.view}${v.mirror}`)).size).toBeGreaterThan(1);
  });

  it('le CRAN d’art des props suit le même cap — les quatre crans sont atteints', () => {
    const crans = new Set<string>();
    for (const cap of DIR8_ORDER) {
      clés = [];
      monter(cap, { x: 4, y: 6 });
      const prop = clésDe('prop:');
      expect(prop, `cap ${cap} : le décor doit être texturé`).toHaveLength(1);
      // L'identité d'un décor porte sa SIGNATURE DE DESSIN depuis #1176 P3-3 (`prop:<clé>|<modèle>`,
      // puis le cran d'art) : c'est le CRAN, seul, que cette garde épingle.
      expect(prop[0].identity, `cap ${cap}`).toBe(`prop:prop:tonneau|tonneau|r${povArtRot(cap)}`);
      crans.add(prop[0].identity);
      démonter();
    }
    expect(crans.size, 'un cran figé n’en donnerait qu’un').toBe(4);
  });
});

describe('POV — la planche ne se recuit qu’au PIVOT (patron anti-recuisson d’`artRot`)', () => {
  it('une frame de marche (l’œil glisse, le cap tient) ne redemande AUCUNE texture ; un pivot, si', () => {
    monter('N', { x: 4, y: 6 });
    const auMontage = clés.length;
    expect(auMontage, 'le montage doit avoir texturé acteur + décor').toBe(2);

    // MARCHE : la position de l'œil est CONTINUE (`anim.glide`), donc un nouvel objet `frame` par
    // frame — celui-ci ne doit rien recuire.
    for (const t of [0.1, 0.25, 0.5, 0.75, 1]) {
      act(() => root!.render(écran(cadrePov('N', { x: 4, y: 6 - t }))));
    }
    expect(clés.length, 'cinq frames de marche : aucune texture redemandée').toBe(auMontage);

    // PIVOT : le cap change d'un cran de 45° — la planche entière se redemande, une fois.
    act(() => root!.render(écran(cadrePov('NE', { x: 4, y: 5 }))));
    expect(clés.length).toBe(auMontage + 2);
  });
});

describe('PLATEAU — la vue affine garde son regard ORTHO (l’autre branche de `bbCam`)', () => {
  it('au cran `r`, l’acteur prend `project(·, r)` et le décor le cran d’`artRot` — jamais un cap', () => {
    for (const rot of CRANS) {
      clés = [];
      monterCadre(cadreAffine(rot));
      const acteur = clésDe('acteur:');
      expect(acteur, `cran ${rot} : l’acteur doit être texturé`).toHaveLength(1);
      // Branche ORTHO de `billboardView` : la MÊME planche que la vue de plateau a toujours servie.
      expect({ view: acteur[0].view, mirror: acteur[0].mirror }, `cran ${rot}`).toEqual(project('S', rot));
      const prop = clésDe('prop:');
      expect(prop[0].identity, `cran ${rot}`).toBe(`prop:prop:tonneau|tonneau|r${artRot({ ...SCENE.dimensions, rot, view: 'iso' })}`);
      démonter();
    }
  });

  it('un cap DE SECOURS en vue de plateau (le regard perspective au lieu de l’ortho) se voit', () => {
    // La mutation que ce banc doit mordre : `povFacing` valant un cap au lieu de `null` hors POV
    // ferait passer la vue de plateau par la branche perspective. Elle rend une planche FIXE, là où
    // les quatre crans en donnent quatre — au moins trois désaccords sur les quatre.
    const secours = vueDepuis('N', 'S');
    const désaccords = CRANS.filter((rot) => {
      const attendu = project('S', rot);
      return attendu.view !== secours.view || attendu.mirror !== secours.mirror;
    });
    expect(désaccords.length, 'un cap figé serait indiscernable de l’ortho').toBeGreaterThanOrEqual(3);
  });
});
