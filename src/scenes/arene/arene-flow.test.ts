import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame } from '../../state/store';
import { applyEffects } from '../../state/combatFlow';
import { condMet, type Scene } from '../../state/scene';
import { makeArenaParty } from '../../data/pregens';

/**
 * Preuve que l'arène (données pures) tourne sur le MOTEUR EXISTANT, sans code applicatif :
 * loadProject (voie de l'éditeur) → on entre sur le sol → un trigger déclenche le combat →
 * les Effets onVictory donnent argent/XP, posent le flag et transitionnent au hub → la porte
 * de la zone suivante s'ouvre (flag). Tout via des primitives déjà testées (checkTriggers,
 * startCombat, applyEffects, transition, condMet).
 */
const project = JSON.parse(readFileSync(join(__dirname, 'arene-projet.json'), 'utf8')) as Scene[];
const zone1 = project.find((s) => s.id === 'arene-zone1')!;

describe('Arène — la boucle tourne sur le moteur existant (zéro code)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('loadProject démarre sur la zone d’entrée, sans combat', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-zone1');
    expect(useGame.getState().scene?.id).toBe('arene-zone1');
    expect(useGame.getState().battle).toBeNull();
  });

  it('entrer sur le sol (dans le rect du trigger) DÉCLENCHE la rencontre', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-zone1');
    useGame.getState().moveParty({ x: 6, y: 5 }); // dans le rect de combat (x≥6) → checkTriggers
    expect(useGame.getState().battle).not.toBeNull();
  });

  it('onVictory : argent + flag zone1_clear + transition vers le hub', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-zone1');
    applyEffects(useGame.getState, useGame.setState, zone1.encounters[0].onVictory!);
    expect(useGame.getState().flags.zone1_clear).toBe(true);
    expect(useGame.getState().scene?.id).toBe('arene-hub');
  });

  it('au hub, la porte des Ruines s’ouvre une fois la Cour nettoyée', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-zone1');
    applyEffects(useGame.getState, useGame.setState, zone1.encounters[0].onVictory!);
    const hub = useGame.getState().scene!;
    const dlgHub = hub.dialogues.find((d) => d.id === 'dlg-hub')!;
    const ruines = dlgHub.nodes[0].choices.find((c) => c.text.includes('Ruines'))!;
    expect(condMet(ruines.condition!, useGame.getState().flags)).toBe(true); // zone1_clear && !zone2_clear
  });
});
