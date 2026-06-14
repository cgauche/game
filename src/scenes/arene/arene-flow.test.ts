import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useGame } from '../../state/store';
import { applyEffects } from '../../state/combatFlow';
import { condMet, type Scene } from '../../state/scene';
import { parseProject } from '../../state/worldMap';
import { makeArenaParty } from '../../data/pregens';

/**
 * Preuve que l'arène (données pures) tourne sur le MOTEUR EXISTANT, sans code applicatif :
 * loadProject (voie de l'éditeur) → on entre sur le sol → un trigger déclenche le combat →
 * les Effets onVictory donnent argent/XP, posent le flag et transitionnent au hub → la porte
 * de la zone suivante s'ouvre (flag). Tout via des primitives déjà testées (checkTriggers,
 * startCombat, applyEffects, transition, condMet).
 */
const doc = parseProject(JSON.parse(readFileSync(join(__dirname, 'arene-projet.json'), 'utf8')));
const project: Scene[] = doc.scenes;
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
    useGame.getState().moveParty({ x: 8, y: 8 }); // dans le rect de combat (x≥7) → checkTriggers
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
    const ruines = dlgHub.nodes.flatMap((n) => n.choices).find((c) => c.text.includes('Ruines'))!;
    expect(condMet(ruines.condition!, useGame.getState().flags)).toBe(true); // zone1_clear && !zone2_clear
  });

  it('ÉCHELLE COMPLÈTE : les 13 victoires enchaînées ouvrent chaque porte puis le titre de champion', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-zone1');
    const dlgHub = project.find((s) => s.id === 'arene-hub')!.dialogues.find((d) => d.id === 'dlg-hub')!;
    const choices = dlgHub.nodes.flatMap((n) => n.choices);
    for (let n = 1; n <= 13; n++) {
      // la porte de la zone N est OUVERTE (condition satisfaite) avant sa victoire…
      const porte = choices.find((c) => c.effects?.some((e) => e.type === 'transition' && e.scene === `arene-zone${n}`))!;
      expect(condMet(porte.condition!, useGame.getState().flags), `porte zone${n} ouverte`).toBe(true);
      // … on applique la victoire de la zone (enc principal = enc-zoneN) → flag + retour Bourg
      const z = project.find((s) => s.id === `arene-zone${n}`)!;
      const enc = z.encounters.find((e) => e.id === `enc-zone${n}`)!;
      applyEffects(useGame.getState, useGame.setState, enc.onVictory!);
      expect(useGame.getState().flags[`zone${n}_clear`], `zone${n}_clear`).toBe(true);
      expect(useGame.getState().scene?.id).toBe('arene-hub');
      // … et la porte se REFERME (déjà nettoyée)
      expect(condMet(porte.condition!, useGame.getState().flags), `porte zone${n} refermée`).toBe(false);
    }
    // le titre de champion est désormais réclamable
    const champion = choices.find((c) => (c.condition ?? '').includes('zone13_clear'))!;
    expect(condMet(champion.condition!, useGame.getState().flags)).toBe(true);
  });

  it('INTÉRIEURS : marcher sur la porte de la taverne ENTRE, la sortie revient au Bourg (transitionBack)', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-hub');
    // La porte de la taverne (bâtiment reveal:'door') est en (5,4) — on s'y rend pas à pas.
    useGame.getState().moveParty({ x: 5, y: 5 });
    useGame.getState().moveParty({ x: 5, y: 4 });
    expect(useGame.getState().scene?.id).toBe('arene-int-taverne');
    // Sortie : le trigger transitionBack en bas de la salle ramène au Bourg.
    const sortie = useGame.getState().scene!.triggers.find((t) => t.id === 'sortie')!;
    applyEffects(useGame.getState, useGame.setState, sortie.effects);
    expect(useGame.getState().scene?.id).toBe('arene-hub');
  });

  it('CONTRATS : la victoire au camp de Bella pose contrat_foret_fait → la prime du Maître se débloque', () => {
    useGame.getState().setParty(makeArenaParty());
    useGame.getState().loadProject(project, 'arene-hub');
    const foret = project.find((s) => s.id === 'arene-exp-foret')!;
    const bande = foret.encounters.find((e) => e.id === 'enc-foret-bande')!;
    applyEffects(useGame.getState, useGame.setState, bande.onVictory!);
    expect(useGame.getState().flags.contrat_foret_fait).toBe(true);
    const dlgHub = project.find((s) => s.id === 'arene-hub')!.dialogues.find((d) => d.id === 'dlg-hub')!;
    const prime = dlgHub.nodes.flatMap((n) => n.choices).find((c) => (c.condition ?? '').includes('contrat_foret_fait'))!;
    expect(condMet(prime.condition!, useGame.getState().flags)).toBe(true);
  });

  it('CARTE DU MONDE : le Bourg est un lieu connu (bouton 🗺️) et ses routes partent vers les 3 expéditions', async () => {
    const { placeOfScene, routesFrom, otherEnd, placeById } = await import('../../state/worldMap');
    const wm = doc.worldMap!;
    const bourg = placeOfScene(wm, 'arene-hub')!;
    expect(bourg).toBeTruthy();
    const dests = new Set<string>();
    const frontier = [bourg.id];
    while (frontier.length) {
      const cur = frontier.pop()!;
      for (const r of routesFrom(wm, cur)) {
        const other = otherEnd(r, cur);
        if (!dests.has(other) && other !== bourg.id) {
          dests.add(other);
          frontier.push(other);
        }
      }
    }
    const scenes = [...dests].map((id) => placeById(wm, id)!.scene);
    expect(scenes.sort()).toEqual(['arene-exp-foret', 'arene-exp-marais', 'arene-exp-village']);
  });
});

const hub = project.find((s) => s.id === 'arene-hub')!;

describe('Médecin (PNJ) — soins payants (LDB 75), via l’infirmerie', () => {
  it('les 4 actes payants (Guérison/hémorragie/déchirure/Chirurgie) sont tarifés 4-6 pa ; le Médecin (Bourg) les offre TOUS', () => {
    const chapelle = project.find((s) => s.id === 'arene-int-chapelle')!;
    const dlgs = [hub.dialogues.find((d) => d.id === 'dlg-medecin')!, chapelle.dialogues.find((d) => d.id === 'dlg-frere')!];
    const aids = dlgs.flatMap((d) => d.nodes.flatMap((n) => n.choices.flatMap((c) => (c.effects ?? []).filter((e) => e.type === 'medicalAid'))));
    const acts = aids.flatMap((e: any) => e.acts as { act: string; cost?: { silver?: number } }[]);
    expect(acts.every((a) => (a.cost?.silver ?? 0) >= 4 && (a.cost?.silver ?? 0) <= 6)).toBe(true); // 4-6 pistoles RAW
    const medecin = aids.find((e: any) => e.entityId === 'medecin') as any;
    expect(new Set(medecin.acts.map((a: { act: string }) => a.act))).toEqual(new Set(['wounds', 'bleed', 'trauma', 'surgery']));
  });

  it('medicalAid ouvre l’infirmerie du PNJ : nom/id viennent de l’entité (pas codés en dur), jamais dans le groupe', () => {
    const party = makeArenaParty();
    party[1].wounds = { ...party[1].wounds, current: party[1].wounds.current - 6 };
    useGame.setState({ party, scene: hub, battle: null, pendingHeal: null, medic: null, money: { gold: 1, silver: 10, brass: 0 } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }], skill: 55, intBonus: 4, entityId: 'medecin' }]);
    const m = useGame.getState().medic!;
    expect(m.npc!.id).toBe('medecin'); // l'id de l'entité PNJ
    expect(m.npc!.name).toBe('Médecin'); // le label de l'entité (renommable)
    expect(useGame.getState().party.some((h) => h.id === m.npc!.id)).toBe(false);
    expect(m.patientId).toBe(party[1].id); // défaut = un patient soignable
    useGame.getState().medicAct('wounds'); // débit 5 pa + jet du PNJ (skill 55)
    const ph = useGame.getState().pendingHeal!;
    expect(ph.skillValue).toBe(55);
    expect(useGame.getState().money.silver).toBe(5);
    useGame.getState().healRoll();
    useGame.getState().healConfirm();
    expect(useGame.getState().pendingHeal).toBeNull();
    expect(useGame.getState().medic).not.toBeNull(); // l'infirmerie reste ouverte (autre acte/patient)
    useGame.getState().closeMedic();
  });

  it('le JOUEUR choisit le patient dans l’infirmerie (medicSelectPatient)', () => {
    const party = makeArenaParty();
    party[0].wounds = { ...party[0].wounds, current: party[0].wounds.current - 3 };
    party[2].wounds = { ...party[2].wounds, current: party[2].wounds.current - 8 };
    useGame.setState({ party, scene: hub, battle: null, pendingHeal: null, medic: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', acts: [{ act: 'wounds' }], skill: 55, intBonus: 4, entityId: 'medecin' }]);
    useGame.getState().medicSelectPatient(party[2].id);
    expect(useGame.getState().medic!.patientId).toBe(party[2].id);
    useGame.getState().closeMedic();
  });

  it('un acte sans patient pertinent est simplement refusé (pas de jet)', () => {
    useGame.setState({ party: makeArenaParty(), scene: hub, battle: null, pendingHeal: null, medic: null }); // groupe au max de PB
    applyEffects(useGame.getState, useGame.setState, [{ type: 'medicalAid', acts: [{ act: 'wounds' }], skill: 55, intBonus: 4 }]);
    useGame.getState().medicAct('wounds');
    expect(useGame.getState().pendingHeal).toBeNull();
    useGame.getState().closeMedic();
  });
});
