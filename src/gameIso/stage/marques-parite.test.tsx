// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { setStageBackend } from '../../state/stage3d';
import type { Combatant } from '../../engine/types';
import { IsoStage } from '../IsoStage';
import { setStageRendererFactory, type StageRenderer } from './GameStage3D';
import { HIGHLIGHT_SLOTS, SLOT_OPACITY, type HighlightSlot } from '../backends/webgl/highlightMeshes';
import { tileTint } from '../teamColors';
import {
  RANGE_BAND_TINT,
  RING_ALLY_TINT,
  RING_CROWD_TINT,
  RING_TARGET_TINT,
  RUN_TINT,
  WALK_TINT,
  ZONE_FIRE_TINT,
  ZONE_SMOKE_TINT,
} from '../highlightTints';

/**
 * PARITÉ DES MARQUES DE CASES (#1176, P3-0c) : la MÊME scène et le MÊME combat, montés une fois par
 * voie. Ce que le SVG affine peint en losanges, le monde volumique doit le poser en quads au sol —
 * même population, nature par nature. Les deux voies partent du même builder pur
 * (`builders/highlights`) sur la même vue assemblée (`stage/highlightLayer.combatHighlightsView`) : ce
 * que cette sonde mesure, c'est que la voie volumique le CONSOMME bien, et jusqu'au bout (pools montés,
 * instances écrites, comptes dessinés).
 *
 * La mesure affine se lit dans le DOM (un `<path>` par élément, sa nature déduite de son couple
 * teinte × opacité — `backends/affineHighlights.tsx`) ; la mesure volumique se lit dans la scène three
 * réellement rendue, sur le `count` des pools d'instances.
 *
 * DEUX combats témoins, parce que les NEUF natures ne coexistent pas : les anneaux de cible demandent
 * un tour disponible SANS attaque en cours, tandis que l'anneau « tirer dans le tas » demande un
 * `pendingAttack.intoCrowd` — lequel éteint justement les anneaux de cible (`combatHighlightsView`).
 * Leur RÉUNION couvre les neuf slots, et la sonde le vérifie.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

/** Arc de Portée 4 m : bandes de Bout Portant à Extrême sur 6 cases (1 case = 2 m). */
const ARC = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 8 }, range: 4, qualities: [] };

function hero(id: string, pos: { x: number; y: number }, weapons: unknown[] = []): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons,
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

function ennemi(id: string, pos: { x: number; y: number }): Combatant {
  return { ...hero(id, pos), kind: 'enemy' } as unknown as Combatant;
}

/**
 * Le combat témoin : un actif héros ARCHER (teinte active, bandes de portée au survol, anneau sur sa
 * cible), deux ennemis dont un COLLÉ au premier (le voisinage qu'éclaire « tirer dans le tas »), une
 * zone de fumée et une zone de feu, et un tour ENTIER devant soi (`acted: false`, `reachable` vide) :
 * la Marche et la Course se dérivent alors du Mouvement (`computeMoveReach` / `computeRunReach`).
 */
function combatTémoin(over: Partial<BattleState> = {}): BattleState {
  return {
    combatants: [hero('h1', { x: 3, y: 3 }, [ARC]), ennemi('e1', { x: 5, y: 3 }), ennemi('e2', { x: 5, y: 4 })],
    order: ['h1', 'e1', 'e2'],
    turn: 0,
    round: 1,
    over: false,
    action: null,
    acted: false,
    movementUsed: 0,
    preview: null,
    reachable: new Map<string, number>(),
    zones: [
      { id: 'z1', blocksLoS: true, tiles: [{ x: 1, y: 1 }, { x: 1, y: 2 }] },
      { id: 'z2', blocksLoS: false, tiles: [{ x: 8, y: 8 }] },
    ],
    log: [],
    ...over,
  } as unknown as BattleState;
}

/** L'état de store qui arme « tirer dans le tas » : l'anneau de foule remplace les anneaux de cible. */
const TIR_DANS_LE_TAS = { pendingAttack: { attackerId: 'h1', targetId: 'e1', intoCrowd: true } };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;
let scènes: THREE.Scene[] = [];

class BancRenderer implements StageRenderer {
  shadowMap = { enabled: false, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap };
  capabilities = { getMaxAnisotropy: () => 1 };
  setPixelRatio(): void {}
  setClearColor(): void {}
  setSize(): void {}
  dispose(): void {}
  render(scene: THREE.Scene): void { scènes.push(scene); }
}

function monter(backend: 'affine' | 'webgl', extra: Record<string, unknown> = {}): HTMLDivElement {
  setStageBackend(backend);
  useGame.setState({
    scene: emptyScene(10, 10),
    mode: 'battle',
    partyPos: { x: 3, y: 3 },
    party: [hero('h1', { x: 3, y: 3 }, [ARC])],
    battle: combatTémoin(),
    dialogue: null,
    flags: {},
    hovered: 'h1', // tireur SURVOLÉ → bandes de portée
    pendingAttack: null,
    ...extra,
  } as never);
  scènes = [];
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<IsoStage />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Nature d'un `<path>` du SVG, par le couple (teinte, opacité) que le backend affine lui donne. */
function slotDuPath(p: Element): HighlightSlot | null {
  const op = p.getAttribute('opacity');
  const fill = p.getAttribute('fill');
  const stroke = p.getAttribute('stroke');
  if (op === String(SLOT_OPACITY.walk) && fill === WALK_TINT) return 'walk';
  if (op === String(SLOT_OPACITY.run) && fill === RUN_TINT) return 'run';
  if (op === String(SLOT_OPACITY.rangeBand) && Object.values(RANGE_BAND_TINT).includes(fill ?? '')) return 'rangeBand';
  if (op === String(SLOT_OPACITY.teamActive) && (fill === tileTint(true, true) || fill === tileTint(false, true))) return 'teamActive';
  if (op === String(SLOT_OPACITY.team) && (fill === tileTint(true, false) || fill === tileTint(false, false))) return 'team';
  if (op === String(SLOT_OPACITY.zoneSmoke) && fill === ZONE_SMOKE_TINT) return 'zoneSmoke';
  if (op === String(SLOT_OPACITY.zoneFire) && fill === ZONE_FIRE_TINT) return 'zoneFire';
  if (op === String(SLOT_OPACITY.ringCrowd) && fill === RING_CROWD_TINT) return 'ringCrowd';
  if (op === String(SLOT_OPACITY.ringContour) && fill === 'none' && (stroke === RING_ALLY_TINT || stroke === RING_TARGET_TINT)) return 'ringContour';
  return null;
}

/** Comptes AFFINES par nature — mesurés dans le SVG réellement monté. */
function comptesAffines(el: HTMLElement): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of el.querySelectorAll('svg.iso-stage path')) {
    const slot = slotDuPath(p);
    if (slot) out[slot] = (out[slot] ?? 0) + 1;
  }
  return out;
}

/** Comptes VOLUMIQUES par nature — mesurés sur les pools de la dernière scène three rendue. */
function comptesVolumiques(): Record<string, number> {
  const scene = scènes[scènes.length - 1];
  const out: Record<string, number> = {};
  scene.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh || !m.name.startsWith('marques:')) return;
    const slot = m.name.slice('marques:'.length);
    if (m.count > 0) out[slot] = (out[slot] ?? 0) + m.count;
  });
  return out;
}

/** Le MÊME état monté sur les deux voies, l'une après l'autre. */
function lesDeuxVoies(extra: Record<string, unknown> = {}): { affine: Record<string, number>; volumique: Record<string, number> } {
  const affine = comptesAffines(monter('affine', extra));
  démonter();
  monter('webgl', extra);
  return { affine, volumique: comptesVolumiques() };
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  démonter();
  setStageBackend('affine');
});

describe('Marques de cases — les deux voies peignent la même population (#1176 P3-0c)', () => {
  it('les deux combats témoins portent bien les NEUF natures (sinon la sonde ne pèse rien)', () => {
    const neutre = comptesAffines(monter('affine'));
    for (const slot of ['walk', 'run', 'rangeBand', 'team', 'teamActive', 'zoneSmoke', 'zoneFire', 'ringContour'] as const)
      expect(neutre[slot], `nature ${slot} jamais peinte par le témoin neutre`).toBeGreaterThan(0);
    expect(neutre.ringCrowd, 'un tour neutre n’arme PAS le tir dans le tas').toBeUndefined();
    démonter();
    const foule = comptesAffines(monter('affine', TIR_DANS_LE_TAS));
    expect(foule.ringCrowd, 'nature ringCrowd jamais peinte par le témoin « tirer dans le tas »').toBeGreaterThan(0);
    expect(foule.ringContour, 'un tir dans le tas éteint les anneaux de cible').toBeUndefined();
    // Réunion des deux témoins = les neuf natures du montage volumique.
    expect(new Set([...Object.keys(neutre), ...Object.keys(foule)])).toEqual(new Set(HIGHLIGHT_SLOTS));
  });

  it('nature par nature, le volumique compte exactement ce que l’affine peint (tour neutre)', () => {
    const { affine, volumique } = lesDeuxVoies();
    expect(volumique).toEqual(affine);
    expect(Object.keys(volumique).length).toBe(HIGHLIGHT_SLOTS.length - 1); // tout sauf `ringCrowd`
  });

  it('nature par nature, le volumique compte exactement ce que l’affine peint (tirer dans le tas)', () => {
    const { affine, volumique } = lesDeuxVoies(TIR_DANS_LE_TAS);
    expect(volumique).toEqual(affine);
    expect(volumique.ringCrowd).toBeGreaterThan(0);
  });

  it('en volumique, chaque pool monté porte l’opacité de sa nature et un `count` borné par sa capacité', () => {
    monter('webgl');
    const scene = scènes[scènes.length - 1];
    let pools = 0;
    scene.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith('marques:')) return;
      pools++;
      const slot = m.name.slice('marques:'.length) as HighlightSlot;
      expect(HIGHLIGHT_SLOTS).toContain(slot);
      expect((m.material as THREE.MeshBasicMaterial).opacity).toBe(SLOT_OPACITY[slot]);
      expect(m.count).toBeLessThanOrEqual(m.instanceMatrix.count);
    });
    expect(pools).toBeGreaterThan(0);
  });
});
