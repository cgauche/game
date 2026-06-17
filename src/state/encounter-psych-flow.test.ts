import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { sceneFearSources } from './encounterPsychFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Scene, SceneEntity, CustomStatblock } from './scene';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C). Depuis 2026-06-10 : Peur/Terreur =
 * COMBAT seulement → hors combat, SEULS les Traits sociaux ciblés (Animosité/Haine/Préjugé/Phobie) se
 * déclenchent à la rencontre. Depuis le fold cascade : c'est UNE cascade `purpose:'test'` à N étapes
 * (une par héros concerné, `kind:'encounterPsych'`) — plus N modales enchaînées. On vérifie ce contrat.
 */
const TERREUR2: CustomStatblock = { name: 'Spectre', char: { F: 30, E: 30, FM: 30 }, traits: [{ id: 'terreur', value: 2 }] };
const ELFE: CustomStatblock = { name: 'Elfe', char: { B: 10 }, groups: ['Elfe'] };

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}

function scene(entities: SceneEntity[]): Scene {
  return {
    id: 's', nom: 'S', description: '', dimensions: { w: 4, h: 4 },
    levels: [{ z: 0, tiles: Array(16).fill('herbe') }], entities,
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

describe('encounterPsychFlow — Psychologie à la rencontre HORS COMBAT (cascade à N étapes)', () => {
  beforeEach(() => {
    useGame.setState({ battle: null, pendingCascade: null, scene: null, party: [] });
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

  it('une Terreur ne déclenche AUCUNE cascade à la rencontre (hors combat = non hostile)', () => {
    useGame.setState({ party: [timoreux('H')] });
    useGame.getState().startScene(scene([ent({ id: 'spectre', statblock: TERREUR2 })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('un Trait ciblé social (Animosité Elfes) ouvre une étape de cascade face à un Elfe présent', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('test');
    const step = c.participants[0];
    expect(step.kind).toBe('encounterPsych');
    expect(step.encounterPsych?.kind).toBe('animosite');
    expect(step.encounterPsych?.cible).toBe('Elfes');
    expect(step.result).toBeFalsy();
  });

  it('Animosité ratée + Continuer → affliction active en psychState ; cascade close (1 héros)', () => {
    const h = animosite('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeRoll(`psych-${h.id}`);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === 'Elfes' && p.active === true)).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Résilience (force le succès) → animosité maîtrisée, Résilience consommée', () => {
    const h = animosite('H');
    h.resilience = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeForceSuccess(`psych-${h.id}`);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(hero.resilience).toBe(0);
  });

  it('Détermination = immunité temporaire (LDB 17 l.62) : psychImmuneRoundsLeft posé, animosité inerte (≈ succès one-shot), -1 Détermination', () => {
    const h = animosite('H');
    h.resolve = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.encounterPsych?.kind).toBe('animosite');
    useGame.getState().cascadeDetermine(`psych-${h.id}`);
    expect(useGame.getState().pendingCascade!.participants[0].immune).toBe(true);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect(hero.resolve).toBe(0);
    expect(hero.psychImmuneRoundsLeft).toBe(2);
    // One-shot : immune ≈ inerte = même état final qu'un succès (pas d'affliction active → pas de re-déclenchement).
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('cascade : deux héros avec Animosité → DEUX étapes dans la MÊME cascade (plus N modales)', () => {
    const a = animosite('A');
    const b = animosite('B');
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.length).toBe(2);
    expect(c.participants.map((s) => s.actorId)).toEqual([a.id, b.id]);
    // Résoudre la 1ʳᵉ étape → le curseur avance sur la 2ᵉ (toujours la même cascade).
    useGame.getState().cascadeRoll(`psych-${a.id}`);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade?.cursor).toBe(1);
  });

  it('aucune source sociale (PNJ neutre) → aucune cascade', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'paysan', statblock: { name: 'Paysan', char: { B: 10 } } })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('immunité (Frénésie) → aucune cascade même sociale', () => {
    const h = animosite('H');
    h.frenzied = true;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
