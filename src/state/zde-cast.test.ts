/**
 * Lot 6 — Ciblage de Zone d'Effet (LDB 47 l.44) : parsing diamètre/portée,
 * clic-case en mode incantation → toutes les cibles du rayon visées par le
 * même jet, garde-fou de portée.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './spawn';
import { zdeDiameterMeters, zdeRadiusTiles, spellRangeTiles } from '../engine/magic';
import type { Combatant } from '../engine/types';

function wiz() {
  const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
  const sk = w.skills.find((s) => s.name === 'Langue');
  if (sk) sk.advances = Math.max(sk.advances, 10);
  w.spells = ['Explosion', ...(w.spells ?? [])]; // Explosion : Projectile magique ZdE (LDB 47 l.347)
  return w;
}

describe('parsing ZdE / portée (engine/magic)', () => {
  const caster = { characteristics: { FM: 42, I: 30, Soc: 30, CC: 0, CT: 0, F: 0, E: 0, Ag: 0, Dex: 0, Int: 0 }, skills: [], talents: [], conditions: [], wounds: { current: 1, max: 1 }, advantage: 0, movement: 4, weapons: [], armour: {} } as never as Combatant;
  it('« ZdE (Bonus de Force Mentale) mètres » → diamètre BFM, rayon en cases ⌊d/2/2⌋', () => {
    expect(zdeDiameterMeters('ZdE (Bonus de Force Mentale) mètres', caster)).toBe(4);
    expect(zdeRadiusTiles('ZdE (Bonus de Force Mentale) mètres', caster)).toBe(1);
    expect(zdeRadiusTiles('ZdE (Spécial)', caster)).toBeNull(); // mur/lieu : non chiffrable
    expect(zdeRadiusTiles(1, caster)).toBeNull(); // cible numérique : pas une ZdE
  });
  it('portée : littéral mètres / (Caractéristique) / Vous / Contact', () => {
    expect(spellRangeTiles('6 mètres', caster)).toBe(3);
    expect(spellRangeTiles('(Force Mentale) mètres', caster)).toBe(21); // 42 m → 21 cases
    expect(spellRangeTiles('Vous', caster)).toBe(0);
    expect(spellRangeTiles('Contact', caster)).toBe(1);
    expect(spellRangeTiles(null, caster)).toBeNull();
  });
});

describe('clic-case ZdE en combat', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null });
    useGame.getState().seedRng(17);
  });

  function setupBattle() {
    const w = wiz();
    w.pos = { x: 2, y: 2 };
    w.characteristics.FM = 40; // BFM 4 → ZdE diamètre 4 m → rayon 1 case
    const e1 = spawnEnemy('Bandit de Grand Chemin', undefined, 'e1', { x: 6, y: 6 });
    const e2 = spawnEnemy('Bandit de Grand Chemin', undefined, 'e2', { x: 7, y: 6 });
    const e3 = spawnEnemy('Bandit de Grand Chemin', undefined, 'e3', { x: 12, y: 12 }); // hors zone
    const battle = {
      combatants: [w, e1, e2, e3], order: [w.id, 'e1', 'e2', 'e3'], baseOrder: [w.id, 'e1', 'e2', 'e3'],
      turn: 0, round: 1, action: 'cast', selectedSpell: 'Explosion', reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    const scene = { id: 's', dimensions: { w: 20, h: 20 }, tiles: [], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
    useGame.setState({ battle, scene, party: [] });
    return { w, e1, e2, e3 };
  }

  it('clic sur une case → pendingCast de zone avec toutes les cibles du rayon', () => {
    setupBattle();
    useGame.getState().battleClickTile({ x: 6, y: 6 });
    const pc = useGame.getState().pendingCast;
    expect(pc).toBeTruthy();
    expect(pc!.zone).toBeTruthy();
    // Explosion : ZdE (BFM) mètres → rayon 1 case autour de (6,6) → e1 (6,6) + e2 (7,6) ; e3 hors zone.
    const ids = [pc!.targetId, ...(pc!.extraTargetIds ?? [])].sort();
    expect(ids).toEqual(['e1', 'e2']);
  });

  it('zone hors de portée → refus journalisé, pas de modale', () => {
    const { w } = setupBattle();
    w.characteristics.FM = 8; // portée (FM) mètres → 4 cases seulement
    useGame.getState().battleClickTile({ x: 12, y: 12 });
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/hors de portée/);
  });

  it('zone vide → refus journalisé', () => {
    setupBattle();
    useGame.getState().battleClickTile({ x: 9, y: 9 });
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/personne dans la zone/);
  });
});
