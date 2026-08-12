import { describe, expect, it } from 'vitest';
import {
  NO_DYNAMIC_MARKS,
  TETHER_DASH_K,
  TETHER_DASH_PX,
  TETHER_GAP_K,
  TETHER_GAP_PX,
  TETHER_STROKE_PX,
  TETHER_WIDTH_K,
  dynamicMarks,
  type EngageTether,
} from './dynamicMarks';
import { TH, TW } from '../../geometry/iso';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';

/**
 * DÉRIVATION des marques dynamiques (#1176, P3-0d) — la source UNIQUE que les deux voies consomment
 * (`stage/tokens.dynamicHighlightObjs` en affine, `stage/dynamicMarkPose` en volumique). Mesurée ici
 * hors de tout écran : ce qui est dérivé, ce sont des cases LOGIQUES et des identités.
 */
function combattant(id: string, over: Partial<Combatant> = {}): Combatant {
  return {
    id,
    label: id,
    kind: 'hero',
    pos: { x: 0, y: 0 },
    size: 'moyenne',
    wounds: { current: 10, max: 10 },
    conditions: [],
    engagedWith: [],
    weapons: [],
    skills: [],
    talents: [],
    ...over,
  } as unknown as Combatant;
}

function combat(combatants: Combatant[], turn = 0): BattleState {
  return { combatants, order: combatants.map((c) => c.id), turn, round: 1, over: false, log: [] } as unknown as BattleState;
}

describe('dynamicMarks — le LIEN d’engagement (#1176 P3-0d)', () => {
  it('un Engagement MUTUEL ne donne qu’UN lien (l’ordre des ids tranche l’émission)', () => {
    const a = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['b'] });
    const b = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'] });
    const m = dynamicMarks(combat([a, b]), null);
    expect(m.tethers).toHaveLength(1);
    expect([m.tethers[0].a.id, m.tethers[0].b.id]).toEqual(['a', 'b']);
    expect(m.tethers[0].b.cell).toEqual({ x: 2, y: 1, z: 0 });
  });

  it('un id RÉPÉTÉ dans `engagedWith` donne autant de liens — la donnée d’un combat réel n’en porte pas', () => {
    // `engage()` n'ajoute un id qu'absent de la liste (`src/engine/engagement.ts:69`) : le doublon est
    // inatteignable en jeu. Ce que la dérivation rend ici est EXACTEMENT ce que la voie affine rendait
    // avant l'extraction (même double boucle, même garde d'ordre) — aucune des deux ne déduplique.
    const a = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['b', 'z', 'b'] });
    const b = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'] });
    const z = combattant('z', { pos: { x: 1, y: 2 }, engagedWith: ['a'] });
    const m = dynamicMarks(combat([a, b, z]), null);
    expect(m.tethers.map((t) => `${t.a.id}-${t.b.id}`)).toEqual(['a-b', 'a-z', 'a-b']);
  });

  it('un combattant HORS D’ACTION ou SANS POS ne porte aucun lien, des deux côtés de la paire', () => {
    const a = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['b', 'c', 'd'] });
    const mort = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'], dead: true } as Partial<Combatant>);
    const sansPos = combattant('c', { pos: undefined, engagedWith: ['a'] } as Partial<Combatant>);
    const vivant = combattant('d', { pos: { x: 1, y: 2 }, engagedWith: ['a'] });
    expect(dynamicMarks(combat([a, mort, sansPos, vivant]), null).tethers.map((t) => t.b.id)).toEqual(['d']);
    // et le porteur du lien lui-même : mort, il n'émet plus rien
    const aMort = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['d'], dead: true } as Partial<Combatant>);
    expect(dynamicMarks(combat([aMort, vivant]), null).tethers).toHaveLength(0);
  });

  it('l’étage de CHAQUE extrémité est celui de SON combattant', () => {
    const a = combattant('a', { pos: { x: 1, y: 1, z: 2 }, engagedWith: ['b'] });
    const b = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'] });
    const [lien] = dynamicMarks(combat([a, b]), null).tethers;
    expect([lien.a.cell.z, lien.b.cell.z]).toEqual([2, 0]);
  });
});

describe('dynamicMarks — l’unité ACTIVE (#1176 P3-0d)', () => {
  it('un CAVALIER est représenté par sa MONTURE : identité, case et empreinte de la monture', () => {
    const cavalier = combattant('cav', { pos: { x: 9, y: 9 }, mountId: 'mnt' } as Partial<Combatant>);
    const monture = combattant('mnt', { pos: { x: 4, y: 5 }, footprint: 2 } as Partial<Combatant>);
    const m = dynamicMarks(combat([cavalier, monture]), null);
    expect(m.active).toEqual({ id: 'mnt', cell: { x: 4, y: 5, z: 0 }, n: 2 });
  });

  it('un cavalier SANS POS mais dont la MONTURE est posée porte tout de même son contour', () => {
    const cavalier = combattant('cav', { pos: undefined, mountId: 'mnt' } as Partial<Combatant>);
    const monture = combattant('mnt', { pos: { x: 3, y: 3 }, footprint: 2 } as Partial<Combatant>);
    const m = dynamicMarks(combat([cavalier, monture]), null);
    expect(m.active?.id).toBe('mnt');
    // et l'inverse : la monture non posée n'invente pas de contour au cavalier
    const monturePerdue = combattant('mnt', { pos: undefined } as Partial<Combatant>);
    expect(dynamicMarks(combat([combattant('cav', { pos: { x: 3, y: 3 }, mountId: 'mnt' } as Partial<Combatant>), monturePerdue]), null).active).toBeNull();
  });

  it('l’actif est celui du TOUR courant, et le fantassin reste lui-même', () => {
    const a = combattant('a', { pos: { x: 1, y: 1 } });
    const b = combattant('b', { pos: { x: 2, y: 2 } });
    expect(dynamicMarks(combat([a, b], 1), null).active?.id).toBe('b');
    expect(dynamicMarks(combat([a, b], 0), null).active).toEqual({ id: 'a', cell: { x: 1, y: 1, z: 0 }, n: 1 });
  });
});

describe('dynamicMarks — le repère du GROUPE et la valeur VIDE (#1176 P3-0d)', () => {
  it('le repère du groupe n’existe que si l’appelant fournit sa case (contexte tranché chez lui)', () => {
    // Le CONTEXTE (mode exploration, aucun dialogue ouvert) est tranché une seule fois par l'appelant
    // — `IsoStage.tsx:427` — et les deux voies consomment le même verdict.
    expect(dynamicMarks(null, { x: 6, y: 6 }).party).toEqual({ x: 6, y: 6, z: 0 });
    expect(dynamicMarks(null, null).party).toBeNull();
    expect(dynamicMarks(null, { x: 6, y: 6, z: 3 }).party).toEqual({ x: 6, y: 6, z: 3 });
  });

  it('hors combat, aucune marque de combat', () => {
    const m = dynamicMarks(null, { x: 6, y: 6 });
    expect(m.tethers).toHaveLength(0);
    expect(m.active).toBeNull();
  });

  it('NO_DYNAMIC_MARKS est GELÉE — une valeur partagée par toutes les voies ne se salit pas', () => {
    expect(Object.isFrozen(NO_DYNAMIC_MARKS)).toBe(true);
    expect(Object.isFrozen(NO_DYNAMIC_MARKS.tethers)).toBe(true);
    // le TYPE la donne déjà en lecture seule ; le gel tient aussi contre un appelant qui forcerait
    const forcée = NO_DYNAMIC_MARKS.tethers as EngageTether[];
    expect(() => forcée.push({ a: { id: 'x', cell: { x: 0, y: 0, z: 0 } }, b: { id: 'y', cell: { x: 0, y: 0, z: 0 } } })).toThrow();
    expect(NO_DYNAMIC_MARKS.tethers).toHaveLength(0);
  });
});

describe('dynamicMarks — le GABARIT du lien, en fractions de case (#1176 P3-0d)', () => {
  it('un pas de case se projette sur hypot(TW/2, TH/2) px : c’est CE pas qui convertit le gabarit affine', () => {
    const pasPx = Math.hypot(TW / 2, TH / 2);
    expect(pasPx).toBeCloseTo(35.777, 3);
    expect(TETHER_DASH_K).toBeCloseTo(TETHER_DASH_PX / pasPx, 12);
    expect(TETHER_GAP_K).toBeCloseTo(TETHER_GAP_PX / pasPx, 12);
    expect(TETHER_WIDTH_K).toBeCloseTo(TETHER_STROKE_PX / pasPx, 12);
  });
});
