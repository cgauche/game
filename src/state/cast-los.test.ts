/**
 * Ciblage homogène — Ligne de Vue des SORTS (LDB 46 l.170 : « sauf indication contraire, vous
 * devez toujours être capable de voir – par exemple, avoir en Ligne de vue – votre cible ») :
 *  • castSpell refuse AVANT la modale (pas de pendingCast) — Projectile comme buff sur allié ;
 *  • ZdE : LdV vers la case CENTRE de la zone (clic-case) ;
 *  • Surincantation : candidats filtrés par LdV quand `sight` est fourni ;
 *  • castOutOfSightTargetIds : grisage hors-LdV du mode incantation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { castSpell, overcastTargetCandidates, castOutOfSightTargetIds } from './combatFlow';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';

function wiz() {
  const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
  const sk = w.skills.find((s) => s.name === 'Langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['Explosion', 'Carreau', ...(w.spells ?? [])];
  return w;
}

/** Arène 20×8, MUR vertical en x=10 percé d'une brèche en y=0 (la ligne y=0 reste dégagée). */
function wallScene() {
  const w = 20, h = 8;
  const tiles: string[] = new Array(w * h).fill('herbe');
  for (let y = 1; y < h; y++) tiles[y * w + 10] = 'mur';
  return { id: 's', dimensions: { w, h }, tiles, entities: [], dialogues: [], triggers: [], encounters: [] } as never;
}

/** Lanceuse en (2,0) ; e-vu en (16,0) — brèche — ; e-cache en (16,4) — derrière le mur. */
function setup() {
  const w = wiz();
  w.pos = { x: 2, y: 0 };
  w.characteristics.FM = 40; // Carreau (FM mètres) → 20 cases : tout le plateau est À PORTÉE
  const seen = spawnEnemy('Bandit de Grand Chemin', undefined, 'e-vu', { x: 16, y: 0 });
  const hidden = spawnEnemy('Bandit de Grand Chemin', undefined, 'e-cache', { x: 16, y: 4 });
  const battle = {
    combatants: [w, seen, hidden], order: [w.id, 'e-vu', 'e-cache'], baseOrder: [w.id, 'e-vu', 'e-cache'],
    turn: 0, round: 1, action: 'cast', selectedSpell: 'Carreau', reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as never;
  useGame.setState({ battle, scene: wallScene(), party: [] });
  return { w, seen, hidden };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
  useGame.getState().seedRng(23);
});

describe('castSpell — Ligne de Vue (LDB 46 l.170)', () => {
  it('cible derrière un mur → refus journalisé, pas de modale', () => {
    const { w, hidden } = setup();
    castSpell(useGame.getState, useGame.setState, w, hidden, 'Carreau');
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/pas de ligne de vue/i);
  });

  it('ligne dégagée (brèche) → la modale s’ouvre', () => {
    const { w, seen } = setup();
    castSpell(useGame.getState, useGame.setState, w, seen, 'Carreau');
    expect(useGame.getState().pendingCast?.targetId).toBe('e-vu');
  });

  it('cibler un ALLIÉ derrière un mur → refusé aussi (le gate ignore l’équipe — buffs compris)', () => {
    const { w } = setup();
    const ally = makePregens().find((h) => h.id !== w.id)!;
    ally.pos = { x: 16, y: 4 }; // derrière le mur
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, combatants: [...b.combatants, ally] } });
    castSpell(useGame.getState, useGame.setState, w, ally, 'Carreau');
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/pas de ligne de vue/i);
  });

  it('sur SOI-MÊME : jamais bloqué par la LdV', () => {
    const { w } = setup();
    castSpell(useGame.getState, useGame.setState, w, w, 'Carreau');
    expect(useGame.getState().pendingCast?.targetId).toBe(w.id);
  });
});

describe('ZdE « jet puis pose » — LdV vers la case centre À LA POSE', () => {
  it('centre derrière le mur → refus (pose toujours en cours), brèche → zone posée', () => {
    const { w } = setup();
    const b = useGame.getState().battle!;
    useGame.setState({ battle: { ...b, selectedSpell: 'Explosion' } });
    useGame.getState().battleClickTile({ x: 3, y: 0 }); // tout clic ouvre la modale (centre null)
    const pc = useGame.getState().pendingCast!;
    expect(pc.zone).toMatchObject({ center: null });
    useGame.setState({ pendingCast: { ...pc, result: { cast: true, roll: 11, target: 70, sl: 4, isCritical: false, isFumble: false, log: 'lancé' } as never } });
    useGame.getState().castPlaceZone(true);
    useGame.getState().battleClickTile({ x: 16, y: 4 }); // centre masqué par le mur
    expect(useGame.getState().journal.join('\n')).toMatch(/pas de ligne de vue/i);
    expect(useGame.getState().pendingCast?.zone?.placing).toBe(true); // la pose continue
    useGame.getState().battleClickTile({ x: 16, y: 0 }); // brèche : e-vu dans le rayon → appliqué
    expect(useGame.getState().pendingCast).toBeNull();
    void w;
  });
});

describe('Surincantation « +Cible » — candidats filtrés par LdV (sight fourni)', () => {
  it('candidat derrière un mur exclu AVEC sight, inclus SANS (compat hors combat)', () => {
    const { w, seen, hidden } = setup();
    const pool: Combatant[] = [w, seen, hidden];
    const spell = findSpell('Carreau')!;
    const sansSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true).map((c) => c.id);
    expect(sansSight).toContain('e-cache');
    const avecSight = overcastTargetCandidates(pool, w, 'e-vu', spell, true, { scene: useGame.getState().scene! as never, smoke: [] }).map((c) => c.id);
    expect(avecSight).not.toContain('e-cache');
  });
});

describe('castOutOfSightTargetIds — grisage du mode incantation', () => {
  it('ennemi derrière le mur grisé, ennemi en ligne dégagée non', () => {
    setup();
    const ids = castOutOfSightTargetIds(useGame.getState);
    expect(ids.has('e-cache')).toBe(true);
    expect(ids.has('e-vu')).toBe(false);
  });
});
