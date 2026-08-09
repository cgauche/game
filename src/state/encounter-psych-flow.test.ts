import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { sceneFearSources } from './encounterPsychFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import type { Scene, SceneEntity, CustomStatblock } from './scene';

/**
 * Flux de Psychologie À LA RENCONTRE, hors combat (couture C). Depuis 2026-06-10 : Peur/Terreur =
 * COMBAT seulement → hors combat, SEULS les Traits sociaux ciblés (Animosité/Haine/Préjugé/Phobie) se
 * déclenchent à la rencontre. Depuis la VAGUE MULTI (#1117 L1) : c'est UNE cascade `purpose:'test'` de
 * BANDES — une étape `kind:'encounterPsych'` PAR ENTRÉE DE RÈGLE mise en jeu (type psy + source), et
 * une RANGÉE (`participants`) par héros concerné, au lieu d'une étape par héros. On vérifie ce contrat.
 */
const TERREUR2: CustomStatblock = { label: 'Spectre', char: { force: 30, endurance: 30, 'force-mentale': 30 }, traits: [{ id: 'terreur', value: 2 }] };
const ELFE: CustomStatblock = { label: 'Elfe', char: { B: 10 }, groups: ['elfe'] };

function ent(over: Partial<SceneEntity> & Pick<SceneEntity, 'id'>): SceneEntity {
  return { kind: 'personnage', pos: { x: 1, y: 1 }, ...over } as SceneEntity;
}

function scene(entities: SceneEntity[]): Scene {
  return {
    id: 's', nom: 'S', description: '', dimensions: { w: 4, h: 4 },
    layers: [{ z: 0, tiles: Array(16).fill('herbe') }], entities,
    dialogues: [], triggers: [], encounters: [], flags: {},
  };
}

/** Héros au Calme bas (FM 1, 0 avance) → Test simple raté de façon déterministe (cible basse). */
function timoreux(name: string, fm = 1) {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: name, rng: makeRNG(1) });
  h.characteristics['force-mentale'] = fm;
  h.skills = []; // pas d'avance de Calme → calmeValue = FM brut
  return h;
}
/** Héros timoré portant une Animosité (Elfe) — le Trait social qui se déclenche hors combat. */
function animosite(name: string) {
  const h = timoreux(name);
  h.psychTraits = [{ type: 'animosite', cible: 'elfe' }];
  return h;
}

describe('encounterPsychFlow — Psychologie à la rencontre HORS COMBAT (bandes : une fenêtre par entrée de règle)', () => {
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

  it('un Trait ciblé social (Animosité Elfes) ouvre une BANDE face à un Elfe présent (déclaration sur l’étape, jet sur la rangée)', () => {
    const h = animosite('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c).toBeTruthy();
    expect(c.purpose).toBe('test');
    const step = c.participants[0];
    expect(step.kind).toBe('encounterPsych');
    expect(step.encounterPsych?.kind).toBe('animosite');
    expect(step.encounterPsych?.cible).toBe('elfe');
    // BANDE : le jet vit sur la RANGÉE, jamais sur l'étape (contrat `aggregate:'none'`).
    expect(step.aggregate).toBe('none');
    expect(step.target).toBeUndefined();
    expect(step.participants?.map((p) => p.id)).toEqual([h.id]);
    expect(step.participants?.[0].result).toBeNull();
  });

  it('Animosité ratée + Continuer → affliction active en psychState ; cascade close (1 héros)', () => {
    const h = animosite('H');
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchRoll(h.id);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.cible === 'elfe' && p.active === true)).toBe(true);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Résilience (force le succès) → animosité maîtrisée, Résilience consommée', () => {
    const h = animosite('H');
    h.resilience = 1;
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchForceSuccess(h.id);
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
    useGame.getState().cascadeBatchDetermine(h.id);
    expect(useGame.getState().pendingCascade!.participants[0].participants![0].immune).toBe(true);
    useGame.getState().cascadeNext();
    const hero = useGame.getState().party[0];
    expect(hero.resolve).toBe(0);
    expect(hero.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });
    // One-shot : immune ≈ inerte = même état final qu'un succès (pas d'affliction active → pas de re-déclenchement).
    expect((hero.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('BANDE : deux héros sur la MÊME entrée de règle → UNE étape à DEUX rangées (une fenêtre, pas « jet 1/2 »)', () => {
    const a = animosite('A');
    const b = animosite('B');
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.length).toBe(1);
    const band = c.participants[0];
    expect(band.encounterPsych?.kind).toBe('animosite');
    expect(band.participants?.map((p) => p.id)).toEqual([a.id, b.id]);
    // La bande n'est PRÊTE qu'une fois toutes ses rangées jouées — puis la cascade se clôt d'un coup.
    useGame.getState().cascadeBatchRoll(a.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade!.cursor).toBe(0); // rangée B pas encore jouée
    useGame.getState().cascadeBatchRoll(b.id);
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
    const psy = useGame.getState().party.map((h) => (h.psychState ?? []).filter((p) => p.type === 'animosite').length);
    expect(psy).toEqual([1, 1]); // chaque rangée a reçu SA conséquence
  });

  it('BANDES : deux entrées de règle DIFFÉRENTES → deux étapes, dans l’ordre de première rencontre', () => {
    const a = animosite('A');
    const b = timoreux('B');
    b.psychTraits = [{ type: 'haine', cible: 'elfe' }];
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const c = useGame.getState().pendingCascade!;
    expect(c.participants.map((s) => s.encounterPsych?.kind)).toEqual(['animosite', 'haine']);
    expect(c.participants.map((s) => s.participants?.map((p) => p.id))).toEqual([[a.id], [b.id]]);
  });

  it('Détermination PAR RANGÉE : le porteur est immunisé, l’autre rangée garde sa conséquence', () => {
    const a = animosite('A');
    a.resolve = 1;
    const b = animosite('B');
    b.resolve = 1;
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    useGame.getState().cascadeBatchDetermine(a.id);
    const band = useGame.getState().pendingCascade!.participants[0];
    expect(band.participants![0].immune).toBe(true);
    expect(band.participants![1].immune).toBeUndefined();
    expect(band.participants![1].result).toBeNull();
    useGame.getState().cascadeBatchRoll(b.id);
    useGame.getState().cascadeNext();
    const [ha, hb] = useGame.getState().party;
    expect(ha.resolve).toBe(0);
    expect(hb.resolve).toBe(1); // B n'a RIEN dépensé : la Détermination est jouée PAR RANGÉE
    expect((ha.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(false);
    expect((hb.psychState ?? []).some((p) => p.type === 'animosite' && p.active === true)).toBe(true);
    // Verdict PAR RANGÉE : chaque rangée porte SA conséquence (jamais un agrégat de bande).
    const done = useGame.getState().journal;
    expect(done.some((l) => /A .*insensible/.test(l))).toBe(true);
  });

  // Sonde du juge (L1) : une bande ne doit pas être SOURDE au seam `onOwnTestFailed` — MSRC 16 l.152-158
  // (Crampes abdominales) : « Lorsqu'un Test se solde par un échec normal ou pire, il se plie en deux de
  // douleur […] et gagne l'État *Sonné*. » Le trigger est dû au TEST, pas à la forme de la fenêtre.
  it('Crampes abdominales : une RANGÉE perdante de la bande émet onOwnTestFailed → État Sonné pour SON porteur', () => {
    const a = animosite('A');
    a.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    const b = animosite('B');
    b.diseases = [{ id: 'colique', phase: 'active', symptoms: [{ symptomId: 'crampes-abdominales' }], minutesLeft: 1e5, durationMinutes: 1e5 }];
    useGame.setState({ party: [a, b] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    const pc = useGame.getState().pendingCascade!;
    const band = pc.participants[0];
    // Jets POSÉS (déterministes) : A rate d'un échec normal (DR −2 → palier 1), B réussit.
    const rows = band.participants!.map((p, k) => ({
      ...p,
      result: k === 0 ? { roll: 99, target: p.target, sl: -2, success: false } : { roll: 1, target: p.target, sl: 2, success: true },
    }));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants: rows }] } });
    useGame.getState().cascadeNext();
    const [ha, hb] = useGame.getState().party;
    expect(ha.conditions.some((c) => c.id === 'sonne')).toBe(true);
    expect(hb.conditions.some((c) => c.id === 'sonne')).toBe(false); // rangée RÉUSSIE : muette
  });

  it('aucune source sociale (PNJ neutre) → aucune cascade', () => {
    useGame.setState({ party: [animosite('H')] });
    useGame.getState().startScene(scene([ent({ id: 'paysan', statblock: { label: 'Paysan', char: { B: 10 } } })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('immunité (Frénésie) → aucune cascade même sociale', () => {
    const h = animosite('H');
    (h.psychState ??= []).push({ type: 'frenesie' });
    useGame.setState({ party: [h] });
    useGame.getState().startScene(scene([ent({ id: 'elfe', statblock: ELFE })]));
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
