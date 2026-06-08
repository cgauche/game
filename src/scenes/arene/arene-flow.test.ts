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

const hub = project.find((s) => s.id === 'arene-hub')!;

describe('Médecin (PNJ) — actes de soin payants (LDB 75), via la modale de Guérison', () => {
  it('le dialogue du médecin propose 3 actes payants (Guérison/hémorragie/Chirurgie) avec un coût', () => {
    const dlg = hub.dialogues.find((d) => d.id === 'dlg-medecin')!;
    const acts = dlg.nodes[0].choices.filter((c) => c.effects?.some((e) => e.type === 'medicalAid'));
    expect(acts.length).toBe(3);
    expect(acts.every((c) => (c.cost?.silver ?? 0) >= 4 && (c.cost?.silver ?? 0) <= 6)).toBe(true); // 4-6 pistoles RAW
    const modes = acts.flatMap((c) => c.effects!.filter((e) => e.type === 'medicalAid').map((e: any) => e.act));
    expect(new Set(modes)).toEqual(new Set(['wounds', 'bleed', 'surgery']));
  });

  it('medicalAid : nom/id du soigneur viennent de l’entité PNJ (pas codés en dur), jamais dans le groupe', () => {
    const party = makeArenaParty();
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 }; // le plus blessé
    useGame.setState({ party, scene: hub, battle: null, pendingHeal: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', act: 'wounds', skill: 55, intBonus: 4, entityId: 'medecin' }]);
    const ph = useGame.getState().pendingHeal!;
    expect(ph.healerId).toBe('medecin'); // l'id de l'entité PNJ
    expect(ph.healerName).toBe('Médecin'); // le label de l'entité (renommable)
    expect(useGame.getState().party.some((h) => h.id === ph.healerId)).toBe(false);
    expect(ph.mode).toBe('wounds');
    expect(ph.targetId).toBe(party[1].id); // défaut = le plus blessé
    expect(ph.skillValue).toBe(55);
    useGame.getState().healRoll();
    useGame.getState().healConfirm();
    expect(useGame.getState().pendingHeal).toBeNull();
  });

  it('le JOUEUR choisit la cible : candidateIds liste les héros éligibles, healSetTarget change la cible', () => {
    const party = makeArenaParty();
    party[0].wounds = { ...party[0].wounds, current: party[0].wounds.current - 3 };
    party[2].wounds = { ...party[2].wounds, current: party[2].wounds.current - 8 }; // le plus blessé → défaut
    useGame.setState({ party, scene: hub, battle: null, pendingHeal: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', act: 'wounds', skill: 55, intBonus: 4, entityId: 'medecin' }]);
    const ph = useGame.getState().pendingHeal!;
    expect(ph.candidateIds).toEqual(expect.arrayContaining([party[0].id, party[2].id]));
    expect(ph.targetId).toBe(party[2].id); // défaut = le plus blessé
    useGame.getState().healSetTarget(party[0].id); // le joueur choisit l'autre
    expect(useGame.getState().pendingHeal!.targetId).toBe(party[0].id);
  });

  it('sans patient à traiter, l’acte ne fait rien (pas de modale)', () => {
    useGame.setState({ party: makeArenaParty(), scene: hub, battle: null, pendingHeal: null }); // groupe au max de PB
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', act: 'wounds', skill: 55, intBonus: 4 }]);
    expect(useGame.getState().pendingHeal).toBeNull();
  });
});
