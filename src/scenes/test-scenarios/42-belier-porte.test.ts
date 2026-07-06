import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { scenario } from './42-belier-porte';
import { resolveAttack, firedWeapon, firedAttackBlock } from '../../state/combatFlow';
import { placeCombatant } from '../../state/spawn';
import { seedBattleRng } from '../../state/battleRng';
import { combatValue } from '../../engine/combat';
import { effectiveChar } from '../../engine/characteristics';
import type { Combatant } from '../../engine/types';

/**
 * BÉLIER — PORTE : consommateur LIVE du modèle ENGIN DE SIÈGE CREWÉ (poste `ShipPoste`, ADE II ch.08
 * l.233) sur la Scène PRODUITE par le scénario réel (`42-belier-porte.ts`) — le Soldat SERT le bélier
 * (chef de pièce), 5 servants PNJ complètent l'Équipe de 6. `war-machine-crew.test.ts` couvre déjà la
 * mécanique PURE (`warMachineCrewPenalty`) ; ici on prouve qu'elle est bien CÂBLÉE au scénario : poste
 * authoré, `crewIds` réels (dont un HÉROS chef), résolution par Force contre une vraie porte, et les 3
 * courbes d'effectif d'Équipe (complet / 3-6 / sous la moitié).
 */
function startBelier(): { soldat: Combatant; crew: Combatant[]; ram: Combatant; porte: Combatant } {
  useGame.setState({ party: scenario.makeParty() });
  useGame.getState().startScene(scenario.scene);
  useGame.getState().startCombat('siege-belier');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const ram = b.combatants.find((c) => c.postes?.length)!;
  const soldat = b.combatants.find((c) => c.kind === 'hero' && !!c.mannedPoste)!;
  const crew = (ram.postes![0].crewIds ?? []).map((id) => b.combatants.find((c) => c.id === id)!);
  const porte = b.combatants.find((c) => c.creatureId === 'porte-de-ville')!;
  return { soldat, crew, ram, porte };
}

describe('Bélier — porte (belier-porte) : engin de siège CREWÉ, jamais une arme portée', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("scène : une porte-de-ville brèchable sur l'arête N de (5,4)", () => {
    const s = scenario.scene;
    expect(s.dimensions).toEqual({ w: 10, h: 8 });
    const gate = s.walls!.find((w) => w.structure === 'porte-de-ville');
    expect(gate).toMatchObject({ x: 5, y: 4, side: 'N' });
  });

  it('le Soldat SERT le bélier en POSTE (jamais dans son inventaire) : Équipe au complet (6/6), arme dérivée resolveChar=F', () => {
    const { soldat, ram, porte } = startBelier();
    expect(soldat.items?.some((i) => i.trappingId === 'belier-ade2')).toBeFalsy(); // jamais dans le loadout du héros
    expect(soldat.mannedPoste?.item.trappingId).toBe('belier-ade2');
    expect(ram.postes?.[0].crewIds).toHaveLength(6); // Équipe requise (ADE II ch.08 l.233)
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    expect(belier).toBeTruthy();
    expect(belier.type).toBe('melee');
    expect(belier.resolveChar).toBe('F');
    expect(belier.weaponGroup).toBe('machine-de-guerre');
    expect(belier.qualities.map((q) => q.id).sort()).toEqual(['belier', 'devastatrice', 'equipe', 'percutante', 'siege'].sort());
    const w = firedWeapon(soldat, porte, belier.uid, useGame.getState().battle!.combatants);
    expect(w.crewTeamPenalty).toBeUndefined(); // Équipe au complet → arme nette
  });

  it("le jet d'attaque du Bélier se résout sur la Force du Soldat — PAS sa CC (ADE II ch.08 l.233)", () => {
    const { soldat } = startBelier();
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    // La CC et la Force DIVERGENT volontairement (ADE II ch.08 l.233 : « utilise Force ») pour désambiguïser :
    // si le moteur résolvait encore sur CC, la valeur de Test observée serait TRÈS différente.
    soldat.characteristics.CC = 20;
    soldat.characteristics.F = 65;
    expect(combatValue(soldat, 'melee', belier)).toBe(65); // Force brute, aucune Spé n'entre en jeu
    expect(combatValue(soldat, 'melee', belier)).not.toBe(effectiveChar(soldat, 'CC'));
  });

  it('une touche RÉUSSIE contre la porte lui inflige des Blessures (Atout Bélier + Siège, ×2 dégâts structure)', () => {
    const { soldat, porte } = startBelier();
    const scene = useGame.getState().scene!;
    expect(porte).toBeTruthy();
    soldat.pos = { x: 5, y: 5 };
    placeCombatant(soldat, scene, soldat.pos);
    soldat.characteristics.F = 90; // Test quasi-garanti (Force très haute), aucune Spé requise (raw characteristic)
    seedBattleRng(1);
    // weaponUid EXPLICITE (Bélier) : le Soldat garde SON arme personnelle en plus du poste servi (kind-agnostique,
    // comme un canonnier qui garde sa dague) — l'auto-sélection `attackWeapon` prendrait sinon sa propre arme.
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    const r = resolveAttack(() => useGame.getState(), soldat, porte, undefined, false, false, false, belier.uid);
    expect(r).not.toBeNull();
    expect(r!.weapon.resolveChar).toBe('F'); // le jet qui vient de se résoudre était bien un Test de Force
    expect(r!.res.hit).toBe(true); // Force 90 → Test quasi-garanti
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0); // la porte encaisse RÉELLEMENT (Atout Siège ×2 dégâts structure)
  });

  it('Équipe incomplète (3/6, ≥ moitié) : −20 baké, mais toujours UTILISABLE', () => {
    const { soldat, crew, porte } = startBelier();
    // Neutralise 3 des 5 servants PNJ (jamais le chef) → 3/6 restants (chef + 2 servants).
    for (const c of crew.filter((x) => x.id !== soldat.id).slice(0, 3)) c.wounds = { current: 0, max: c.wounds.max };
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    const w = firedWeapon(soldat, porte, belier.uid, useGame.getState().battle!.combatants);
    expect(w.crewTeamPenalty).toBe(-20);
    expect(firedAttackBlock(() => useGame.getState(), soldat, porte, belier.uid)).toBeNull(); // toujours utilisable
  });

  it("sous la moitié (2/6) : INUTILISABLE — firedAttackBlock refuse l'attaque", () => {
    const { soldat, crew, porte } = startBelier();
    // Neutralise 4 des 5 servants PNJ (jamais le chef) → 2/6 restants (chef + 1 servant, < moitié).
    for (const c of crew.filter((x) => x.id !== soldat.id).slice(0, 4)) c.wounds = { current: 0, max: c.wounds.max };
    const belier = soldat.weapons.find((w) => w.name === 'Bélier')!;
    const block = firedAttackBlock(() => useGame.getState(), soldat, porte, belier.uid);
    expect(block).toMatchObject({ reason: 'sous-effectif' });
  });
});
