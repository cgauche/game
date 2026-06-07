import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { sceneFearSources } from './encounterPsychFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Scene, SceneEntity, CustomStatblock } from './scene';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C) — câblage store de `encounterPsych`.
 * On vérifie : ouverture à l'entrée de scène (startScene), Lancer/Résilience/Appliquer, chaînage
 * héros-par-héros, et les court-circuits (combat, immunité, aucune source).
 */

const TERREUR2: CustomStatblock = { name: 'Spectre', char: { F: 30, E: 30, FM: 30 }, traits: ['Terreur 2'] };

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

/** Héros au Calme bas (FM, 0 avance) → Test de Calme raté de façon déterministe (cible basse). */
function timoreux(name: string, fm = 1) {
  const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name, rng: makeRNG(1) });
  h.characteristics.FM = fm;
  h.skills = []; // pas d'avance de Calme → calmeValue = FM brut
  return h;
}

describe('encounterPsychFlow — Psychologie à la rencontre, hors combat (couture C, LDB 21)', () => {
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

  it('startScene ouvre le Test à la rencontre d’un PNJ « Terreur 2 »', () => {
    useGame.setState({ party: [timoreux('H')] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    const pe = useGame.getState().pendingEncounterPsych;
    expect(pe).toBeTruthy();
    expect(pe!.kind).toBe('terreur');
    expect(pe!.sourceId).toBe('spectre');
    expect(pe!.indice).toBe(2);
    expect(pe!.result).toBeNull();
  });

  it('Lancer (raté) + Appliquer : Brisé + la Terreur devient une Peur en psychState', () => {
    const h = timoreux('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    useGame.getState().encounterPsychRoll();
    const pe = useGame.getState().pendingEncounterPsych!;
    expect(pe.result).toBeTruthy();
    expect(pe.result!.success).toBe(false); // Calme 1 → échec déterministe
    useGame.getState().encounterPsychConfirm();
    const hero = useGame.getState().party[0];
    expect(hero.conditions.some((c) => c.name === 'Brisé')).toBe(true);
    expect((hero.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === 'spectre')).toBe(true);
    expect(useGame.getState().pendingEncounterPsych).toBeNull(); // un seul héros, une seule source
  });

  it('Résilience (force le succès) : aucun Brisé, Peur surmontée (Indice 0)', () => {
    const h = timoreux('H');
    h.resilience = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychForceSuccess();
    useGame.getState().encounterPsychConfirm();
    const hero = useGame.getState().party[0];
    expect(hero.conditions.some((c) => c.name === 'Brisé')).toBe(false);
    const peur = (hero.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === 'spectre');
    expect(peur?.indice).toBe(0); // surmontée → inerte
    expect(hero.resilience).toBe(0); // Résilience consommée
  });

  it('Trait ciblé (Animosité Elfes, raté) → affliction active en psychState', () => {
    const h = timoreux('H');
    h.psychTraits = [{ type: 'animosite', cible: 'Elfes' }];
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: { name: 'Elfe', char: { B: 10 }, groups: ['Elfe'] } })]));
    const pe = useGame.getState().pendingEncounterPsych!;
    expect(pe.kind).toBe('animosite');
    expect(pe.cible).toBe('Elfes');
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychConfirm();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === 'Elfes' && p.active === true)).toBe(true);
  });

  it('chaînage : deux héros concernés → le 2ᵉ Test s’ouvre après l’Appliquer du 1ᵉ', () => {
    useGame.setState({ party: [timoreux('A'), timoreux('B')] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    const first = useGame.getState().pendingEncounterPsych!;
    useGame.getState().encounterPsychRoll();
    useGame.getState().encounterPsychConfirm();
    const second = useGame.getState().pendingEncounterPsych;
    expect(second).toBeTruthy();
    expect(second!.heroId).not.toBe(first.heroId); // l'autre héros enchaîne
  });

  it('aucune source (PNJ de même Taille, aucun trait) → aucun Test', () => {
    useGame.setState({ party: [timoreux('H')] });
    useGame.getState().startScene(scene([ent({ id: 'paysan', statblock: { name: 'Paysan', char: { B: 10 } } })]));
    expect(useGame.getState().pendingEncounterPsych).toBeNull();
  });

  it('immunité (Frénésie) → aucun Test', () => {
    const h = timoreux('H');
    h.frenzied = true;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    expect(useGame.getState().pendingEncounterPsych).toBeNull();
  });
});
