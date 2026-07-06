import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './42-belier-porte';
import { resolveAttack } from '../../state/combatFlow';
import { placeCombatant } from '../../state/spawn';
import { seedBattleRng } from '../../state/battleRng';
import { combatValue } from '../../engine/combat';
import { effectiveChar } from '../../engine/characteristics';

/**
 * BÉLIER — PORTE : consommateur LIVE de la résolution par Force d'une machine de guerre ADE II
 * (`Weapon.resolveChar`, ADE II ch.08 l.233). Vérif LOGIQUE headless de la Scene PRODUITE par le
 * `MapSpec` + un VRAI jet d'attaque contre la porte (structure brèchable, auto-enrôlée depuis `scene.walls`
 * au démarrage du combat, `combatSlice.ts` l.2215).
 */
describe('Bélier — porte (belier-porte)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('scène : une porte-de-ville brèchable sur l\'arête N de (5,4)', () => {
    const s = scenario.scene;
    expect(s.dimensions).toEqual({ w: 10, h: 8 });
    const gate = s.walls!.find((w) => w.structure === 'porte-de-ville');
    expect(gate).toMatchObject({ x: 5, y: 4, side: 'N' });
  });

  it('le Soldat est équipé du Bélier : arme dérivée resolveChar=F, Groupe machine-de-guerre, Atouts Siège+Bélier', () => {
    const party = scenario.makeParty();
    const soldat = party[0];
    const belier = soldat.weapons.find((w) => w.name === 'Bélier');
    expect(belier).toBeTruthy();
    expect(belier!.type).toBe('melee');
    expect(belier!.resolveChar).toBe('F');
    expect(belier!.weaponGroup).toBe('machine-de-guerre');
    expect(belier!.qualities.map((q) => q.id).sort()).toEqual(['belier', 'devastatrice', 'equipe', 'percutante', 'siege'].sort());
  });

  it('le jet d\'attaque du Bélier se résout sur la Force du Soldat — PAS sa CC (ADE II ch.08 l.233)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const soldat = b.combatants.find((c) => c.kind === 'hero' && c.weapons.some((w) => w.name === 'Bélier'))!;
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    // La CC et la Force DIVERGENT volontairement (ADE II ch.08 l.233 : « utilise Force ») pour désambiguïser :
    // si le moteur résolvait encore sur CC, la valeur de Test observée serait TRÈS différente.
    soldat.characteristics.CC = 20;
    soldat.characteristics.F = 65;
    expect(combatValue(soldat, 'melee', belier)).toBe(65); // Force brute, aucune Spé n'entre en jeu
    expect(combatValue(soldat, 'melee', belier)).not.toBe(effectiveChar(soldat, 'CC'));
  });

  it('une touche RÉUSSIE contre la porte lui inflige des Blessures (Atout Bélier + Siège, ×2 dégâts structure)', () => {
    useGame.setState({ party: scenario.makeParty() });
    useGame.getState().startScene(scenario.scene);
    useGame.getState().startCombat('siege-belier');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const scene = useGame.getState().scene!;
    const soldat = b.combatants.find((c) => c.kind === 'hero' && !c.aiControlled && c.weapons.some((w) => w.name === 'Bélier'))!;
    const porte = b.combatants.find((c) => c.creatureId === 'porte-de-ville')!;
    expect(porte).toBeTruthy();
    soldat.pos = { x: 5, y: 5 };
    placeCombatant(soldat, scene, soldat.pos);
    soldat.characteristics.F = 90; // Test quasi-garanti (Force très haute), aucune Spé requise (raw characteristic)
    seedBattleRng(1);
    const r = resolveAttack(() => useGame.getState(), soldat, porte, undefined, false, false, false, undefined);
    expect(r).not.toBeNull();
    expect(r!.weapon.resolveChar).toBe('F'); // le jet qui vient de se résoudre était bien un Test de Force
    expect(r!.res.hit).toBe(true); // Force 90 → Test quasi-garanti
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0); // la porte encaisse RÉELLEMENT (Atout Siège ×2 dégâts structure)
  });
});
