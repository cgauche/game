import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { sceneFearSources } from './encounterPsychFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Scene, SceneEntity, CustomStatblock } from './scene';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C) — câblage store de `encounterPsych`.
 * Depuis 2026-06-10 : Peur/Terreur = COMBAT seulement → hors combat, SEULS les Traits sociaux ciblés
 * (Animosité/Haine/Préjugé/Phobie) se déclenchent à la rencontre. On vérifie ce contrat + le flux
 * (Lancer/Résilience/Appliquer, chaînage, court-circuits).
 */
const TERREUR2: CustomStatblock = { name: 'Spectre', char: { F: 30, E: 30, FM: 30 }, traits: ['Terreur 2'] };
const ELFE: CustomStatblock = { name: 'Elfe', char: { B: 10 }, groups: ['Elfe'] };

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}

function scene(entities: SceneEntity[]): Scene {
  return {
    id: 's', nom: 'S', description: '', dimensions: { w: 4, h: 4 },
    tiles: Array(16).fill('herbe'), entities,
    dialogues: [], triggers: [], encounters: [], flags: {},
  };
}

/** Héros au Calme bas (FM 1, 0 avance) → Test simple raté de façon déterministe (cible basse). */
function timoreux(name: string, fm = 1) {
  const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name, rng: makeRNG(1) });
  h.characteristics.FM = fm;
  h.skills = []; // pas d'avance de Calme → calmeValue = FM brut
  return h;
}
/** Héros timoré portant une Animosité (Elfes) — le Trait social qui se déclenche hors combat. */
function animosite(name: string) {
  const h = timoreux(name);
  h.psychTraits = [{ type: 'animosite', cible: 'Elfes' }];
  return h;
}

describe('encounterPsychFlow — Psychologie à la rencontre HORS COMBAT (Peur/Terreur = combat seulement)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingEncounterPsych: null, scene: null, party: [] });
    useGame.getState().seedRng(2);
  });

  it('sceneFearSources ne dérive QUE les entités « personnage » (ignore props/heroStart)', () => {
    const sources = sceneFearSources(
      scene([
        ent({ id: 'pnj', statblock: TERREUR2 }),
        ent({ id: 'porte', kind: 'prop', ref: 'Tonneau' }),
        ent({ id: 'depart', kind: 'heroStart' }),
      ]),
    );
    expect(sources.map((s) => s.id)).toEqual(['pnj']);
    expect(sources[0].causesTerreur).toBe(2);
  });

  it('une Terreur ne déclenche AUCUN Test à la rencontre (hors combat = non hostile)', () => {
    useGame.setState({ party: [timoreux('H')] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    expect(useGame.getState().pendingEncounterPsych).toBeNull();
  });

  it('un Trait ciblé social (Animosité Elfes) SE déclenche face à un Elfe présent', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const pe = useGame.getState().pendingEncounterPsych!;
    expect(pe).toBeTruthy();
    expect(pe.kind).toBe('animosite');
    expect(pe.cible).toBe('Elfes');
    expect(pe.result).toBeNull();
  });

  it('Animosité ratée + Appliquer → affliction active en psychState', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychConfirm();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === 'Elfes' && p.active === true)).toBe(true);
    expect(useGame.getState().pendingEncounterPsych).toBeNull(); // un seul héros, une seule source
  });

  it('Résilience (force le succès) → animosité maîtrisée, Résilience consommée', () => {
    const h = animosite('H');
    h.resilience = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychForceSuccess();
    useGame.getState().encounterPsychConfirm();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(hero.resilience).toBe(0);
  });

  it('chaînage : deux héros avec Animosité → le 2ᵉ Test s’ouvre après l’Appliquer du 1ᵉ', () => {
    useGame.setState({ party: [animosite('A'), animosite('B')] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const first = useGame.getState().pendingEncounterPsych!;
    expect(first).toBeTruthy();
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychConfirm();
    const second = useGame.getState().pendingEncounterPsych;
    expect(second).toBeTruthy();
    expect(second!.heroId).not.toBe(first.heroId); // l'autre héros enchaîne
  });

  it('aucune source sociale (PNJ neutre) → aucun Test', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'paysan', statblock: { name: 'Paysan', char: { B: 10 } } })]));
    expect(useGame.getState().pendingEncounterPsych).toBeNull();
  });

  it('immunité (Frénésie) → aucun Test même social', () => {
    const h = animosite('H');
    h.frenzied = true;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(useGame.getState().pendingEncounterPsych).toBeNull();
  });
});
