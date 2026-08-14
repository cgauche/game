import { describe, expect, it } from 'vitest';
import {
  COMBAT_TOKEN_BASE,
  NO_DYNAMIC_MARKS,
  PARTY_TOKEN_BASE,
  RING_A_PX,
  RING_B_PX,
  TEAM_RING_RX_PX,
  TEAM_RING_STROKE_PX,
  TEAM_RING_WIDTH_K,
  TETHER_DASH_K,
  TETHER_DASH_PX,
  TETHER_GAP_K,
  TETHER_GAP_PX,
  TETHER_STROKE_PX,
  TETHER_WIDTH_K,
  dashPattern,
  discR,
  dynamicMarks,
  teamRingDecor,
  teamRings,
  type EngageTether,
} from './dynamicMarks';
import { CELL, TH, TW } from '../../geometry/iso';
import { ENEMY_RING, HERO_RING, teamShape } from '../teamColors';
import { combatantTokenScale } from '../sizeScale';
import type { TokenEl } from './types';
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../../state/store';

/**
 * DÉRIVATION des marques dynamiques (#1176, P3-0d) — la source UNIQUE que les deux voies consomment
 * (`stage/dynamicMarkPose`). Mesurée ici
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
    const m = dynamicMarks(combat([a, b]), null, [], null);
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
    const m = dynamicMarks(combat([a, b, z]), null, [], null);
    expect(m.tethers.map((t) => `${t.a.id}-${t.b.id}`)).toEqual(['a-b', 'a-z', 'a-b']);
  });

  it('un combattant HORS D’ACTION ou SANS POS ne porte aucun lien, des deux côtés de la paire', () => {
    const a = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['b', 'c', 'd'] });
    const mort = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'], dead: true } as Partial<Combatant>);
    const sansPos = combattant('c', { pos: undefined, engagedWith: ['a'] } as Partial<Combatant>);
    const vivant = combattant('d', { pos: { x: 1, y: 2 }, engagedWith: ['a'] });
    expect(dynamicMarks(combat([a, mort, sansPos, vivant]), null, [], null).tethers.map((t) => t.b.id)).toEqual(['d']);
    // et le porteur du lien lui-même : mort, il n'émet plus rien
    const aMort = combattant('a', { pos: { x: 1, y: 1 }, engagedWith: ['d'], dead: true } as Partial<Combatant>);
    expect(dynamicMarks(combat([aMort, vivant]), null, [], null).tethers).toHaveLength(0);
  });

  it('l’étage de CHAQUE extrémité est celui de SON combattant', () => {
    const a = combattant('a', { pos: { x: 1, y: 1, z: 2 }, engagedWith: ['b'] });
    const b = combattant('b', { pos: { x: 2, y: 1 }, engagedWith: ['a'] });
    const [lien] = dynamicMarks(combat([a, b]), null, [], null).tethers;
    expect([lien.a.cell.z, lien.b.cell.z]).toEqual([2, 0]);
  });
});

describe('dynamicMarks — l’unité ACTIVE (#1176 P3-0d)', () => {
  it('un CAVALIER est représenté par sa MONTURE : identité, case et empreinte de la monture', () => {
    const cavalier = combattant('cav', { pos: { x: 9, y: 9 }, mountId: 'mnt' } as Partial<Combatant>);
    const monture = combattant('mnt', { pos: { x: 4, y: 5 }, footprint: 2 } as Partial<Combatant>);
    const m = dynamicMarks(combat([cavalier, monture]), null, [], null);
    expect(m.active).toEqual({ id: 'mnt', cell: { x: 4, y: 5, z: 0 }, n: 2 });
  });

  it('un cavalier SANS POS mais dont la MONTURE est posée porte tout de même son contour', () => {
    const cavalier = combattant('cav', { pos: undefined, mountId: 'mnt' } as Partial<Combatant>);
    const monture = combattant('mnt', { pos: { x: 3, y: 3 }, footprint: 2 } as Partial<Combatant>);
    const m = dynamicMarks(combat([cavalier, monture]), null, [], null);
    expect(m.active?.id).toBe('mnt');
    // et l'inverse : la monture non posée n'invente pas de contour au cavalier
    const monturePerdue = combattant('mnt', { pos: undefined } as Partial<Combatant>);
    expect(dynamicMarks(combat([combattant('cav', { pos: { x: 3, y: 3 }, mountId: 'mnt' } as Partial<Combatant>), monturePerdue]), null, [], null).active).toBeNull();
  });

  it('l’actif est celui du TOUR courant, et le fantassin reste lui-même', () => {
    const a = combattant('a', { pos: { x: 1, y: 1 } });
    const b = combattant('b', { pos: { x: 2, y: 2 } });
    expect(dynamicMarks(combat([a, b], 1), null, [], null).active?.id).toBe('b');
    expect(dynamicMarks(combat([a, b], 0), null, [], null).active).toEqual({ id: 'a', cell: { x: 1, y: 1, z: 0 }, n: 1 });
  });
});

describe('dynamicMarks — le repère du GROUPE et la valeur VIDE (#1176 P3-0d)', () => {
  it('le repère du groupe n’existe que si l’appelant fournit sa case (contexte tranché chez lui)', () => {
    // Le CONTEXTE (mode exploration, aucun dialogue ouvert) est tranché une seule fois par l'appelant
    // — `IsoStage.tsx:427` — et les deux voies consomment le même verdict.
    expect(dynamicMarks(null, { x: 6, y: 6 }, [], null).party).toEqual({ x: 6, y: 6, z: 0 });
    expect(dynamicMarks(null, null, [], null).party).toBeNull();
    expect(dynamicMarks(null, { x: 6, y: 6, z: 3 }, [], null).party).toEqual({ x: 6, y: 6, z: 3 });
  });

  it('hors combat, aucune marque de combat', () => {
    const m = dynamicMarks(null, { x: 6, y: 6 }, [], null);
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

/** Jeton de COMBATTANT tel que `builders/tokens` l'émet. */
function jeton(c: Combatant, heroIndex?: number): TokenEl {
  return {
    kind: 'token',
    key: `cbt:${c.id}`,
    id: c.id,
    cell: { x: c.pos!.x, y: c.pos!.y, z: c.pos!.z ?? 0 },
    subject: { kind: 'combatant', c, ...(heroIndex == null ? {} : { heroIndex }), overhang: false },
    states: { visible: true },
  };
}

describe('teamRingDecor — la décoration d’ÉQUIPE, dérivation partagée des deux voies (#1176 P3-0e)', () => {
  it('un héros porte SON anneau d’identité, PLEIN ; l’ordinal cycle sur le catalogue', () => {
    for (let i = 0; i < HERO_RING.length + 2; i++) {
      const d = teamRingDecor(combattant(`h${i}`), i);
      expect(d.color).toBe(HERO_RING[i % HERO_RING.length]);
      expect(d.dash, 'un héros n’est jamais pointillé (R9 : la FORME encode l’équipe)').toBeUndefined();
    }
    expect(teamRingDecor(combattant('sans-ordinal')).color).toBe(HERO_RING[0]);
  });

  it('un ennemi porte le rouge ET le POINTILLÉ — le canal daltonien R9 de `teamShape`', () => {
    const d = teamRingDecor(combattant('e1', { kind: 'enemy' } as Partial<Combatant>), 0);
    expect(d.color).toBe(ENEMY_RING);
    expect(d.dash).toBe(teamShape(false));
    expect(dashPattern(d.dash)).toEqual({ dashPx: 5, gapPx: 3 });
  });

  it('un trait PLEIN n’a pas de motif à lire', () => {
    expect(dashPattern(undefined)).toBeNull();
    expect(dashPattern('')).toBeNull();
  });
});

describe('teamRings — la POPULATION des anneaux et leur gabarit (#1176 P3-0e)', () => {
  it('UN anneau par jeton de COMBATTANT posté, plus le meneur hors combat — et rien d’autre', () => {
    const h = combattant('h1', { pos: { x: 2, y: 3 } });
    const e = combattant('e1', { pos: { x: 5, y: 3 }, kind: 'enemy' } as Partial<Combatant>);
    const meneur = combattant('lead');
    const monté: TokenEl = {
      kind: 'token',
      key: 'mtd:m1',
      id: 'm1',
      cell: { x: 7, y: 7, z: 0 },
      subject: { kind: 'mounted', mount: combattant('m1', { pos: { x: 7, y: 7 } }), rider: combattant('r1') },
      states: { visible: true },
    };
    const anneaux = teamRings([jeton(h, 0), jeton(e), monté], { leader: meneur, pos: { x: 9, y: 9 } });
    expect(anneaux.map((a) => a.id), 'le couple MONTÉ n’en porte pas (la voie affine n’en trace pas)').toEqual(['h1', 'e1', 'lead']);
    expect(anneaux[0].color).toBe(HERO_RING[0]);
    expect(anneaux[1].dash).toBe(teamShape(false));
    expect(anneaux[2].cell).toEqual({ x: 9, y: 9, z: 0 });
    expect(teamRings([jeton(h, 0)], null)).toHaveLength(1);
  });

  it('l’anneau se pose au CENTRE du bloc d’empreinte — aux pieds du jeton, pas à son ancre', () => {
    const gros = combattant('g1', { pos: { x: 4, y: 6, z: 2 }, footprint: 3 } as Partial<Combatant>);
    expect(teamRings([jeton(gros, 0)], null)[0].cell).toEqual({ x: 5, y: 7, z: 2 });
  });

  it('le RAYON monde EST la projection inversée de l’ellipse affine `rx=18·s, ry=9·s`', () => {
    const c = combattant('h1', { pos: { x: 0, y: 0 } });
    const s = COMBAT_TOKEN_BASE * combatantTokenScale(c);
    const { rK } = teamRings([jeton(c, 0)], null)[0];
    // `BodyToken` peint `rx = 18·s` et `ry = 9·s` : ce sont exactement les demi-axes écran du cercle
    // monde de rayon `rK` cases (`RING_A_PX`/`RING_B_PX`), donc les deux voies dessinent LE MÊME disque.
    expect(rK * RING_A_PX).toBeCloseTo(TEAM_RING_RX_PX * s, 10);
    expect(rK * RING_B_PX).toBeCloseTo((TEAM_RING_RX_PX / 2) * s, 10);
    expect(RING_A_PX / RING_B_PX, 'l’ellipse écran d’un cercle monde a le rapport TW/TH').toBeCloseTo(TW / TH, 12);
    expect(RING_A_PX).toBeCloseTo(TW * Math.SQRT1_2, 12);
    // le jeton de GROUPE se mesure sur SA base d’échelle (0,6 — `partyLeaderObj`), pas sur celle du combat
    const meneur = teamRings([], { leader: c, pos: { x: 1, y: 1 } })[0];
    expect(meneur.rK * RING_A_PX).toBeCloseTo(TEAM_RING_RX_PX * PARTY_TOKEN_BASE, 10);
  });

  it('en VUE DU DESSUS, le rayon est celui du DISQUE-PORTRAIT — pas l’ellipse des pieds (#1176 P3-0e)', () => {
    const c = combattant('h1', { pos: { x: 0, y: 0 } });
    const gros = combattant('g1', { pos: { x: 4, y: 6 }, footprint: 3 } as Partial<Combatant>);
    // `BodyToken` (branche `flat`) peint le disque en `<circle r={discR(n)}>` et son anneau SUR ce
    // cercle : le rayon monde de l'anneau vaut donc `discR(n)` px à `CELL` px par case.
    const [petit] = teamRings([jeton(c, 0)], null);
    expect(petit.rTopK * CELL).toBeCloseTo(discR(1), 12);
    expect(teamRings([jeton(gros, 0)], null)[0].rTopK * CELL).toBeCloseTo(discR(3), 12);
    // et il n'a rien à voir avec le rayon LOSANGE : la vue du dessus ne rétrécit pas le jeton
    expect(petit.rTopK).toBeGreaterThan(petit.rK * 1.5);
    // le jeton de GROUPE porte le disque d'UNE case (`partyLeaderObj` : `discR(1)`)
    expect(teamRings([], { leader: c, pos: { x: 1, y: 1 } })[0].rTopK * CELL).toBeCloseTo(discR(1), 12);
  });

  it('le jeton de GROUPE porte l’anneau du GROUPE : plein et bleu, même si le meneur n’est pas un héros', () => {
    // `partyLeaderObj` peint le même : la décoration du groupe ne dépend pas de la NATURE du meneur —
    // un meneur PNJ (une escorte à la tête du groupe) n'y devient pas un ennemi rouge pointillé.
    const pnj = combattant('lead', { kind: 'npc' } as Partial<Combatant>);
    const [anneau] = teamRings([], { leader: pnj, pos: { x: 1, y: 1 } });
    expect(anneau.color).toBe(HERO_RING[0]);
    expect(anneau.dash, 'le jeton de groupe n’est jamais pointillé').toBeUndefined();
    // témoin : la décoration d'ÉQUIPE de ce même combattant, elle, serait rouge ET pointillée
    expect(teamRingDecor(pnj, 0)).toEqual({ color: ENEMY_RING, dash: teamShape(false) });
  });

  it('épaisseur du trait : le gabarit affine (2,5 px) au pas de case projeté, comme le lien de mêlée', () => {
    expect(TEAM_RING_WIDTH_K).toBeCloseTo(TEAM_RING_STROKE_PX / Math.hypot(TW / 2, TH / 2), 12);
  });

  it('la dérivation complète les porte : `dynamicMarks` rend les anneaux avec les autres marques', () => {
    const h = combattant('h1', { pos: { x: 1, y: 1 } });
    const m = dynamicMarks(combat([h]), null, [jeton(h, 0)], null);
    expect(m.rings.map((r) => r.id)).toEqual(['h1']);
    expect(dynamicMarks(combat([h]), null, [], null).rings, 'sans jetons, aucun anneau').toHaveLength(0);
    expect(NO_DYNAMIC_MARKS.rings).toHaveLength(0);
    expect(Object.isFrozen(NO_DYNAMIC_MARKS.rings)).toBe(true);
  });
});
