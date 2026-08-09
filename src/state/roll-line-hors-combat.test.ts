import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { beginShipwreck } from './shipwreck';
import { buildNightCascade, deferredUpkeepSteps, type PendingRest } from './restFlow';
import { runDailyUpkeep, type DeferredUpkeepTest } from './upkeep';
import { bestActivitySkill } from './interludeFlow';
import { inexplique } from './cascadeTestKit';
import { skillBaseValue, testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { restResistVal } from '../engine/rest';
import { clampTarget } from '../engine/tests';
import { DIFFICULTY_MODIFIERS, type Combatant, type Difficulty } from '../engine/types';
import { rule } from '../engine/policy';

/**
 * MONTEUR CANONIQUE — les flux HORS COMBAT (#1153 L3). Chaque site migré est jugé sur DEUX grandeurs
 * indissociables :
 *  1. la CIBLE reste celle que `rollTest` jettera — recalculée ICI à la main depuis la valeur du RAW
 *     (`testValue`/`restResistVal` + Difficulté, écrêtée par `clampTarget`), jamais relue du site ;
 *  2. l'écart base→cible est INTÉGRALEMENT nommé (`inexplique === 0`) : plus une chip « autres ».
 * L'acteur porte un ÉTAT (`empoisonne`, −10 par valeur, LDB 16) : sans lui, une base FONDUE se
 * confondrait avec le Niveau de Compétence nu et le test passerait sur un monteur faux.
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h1', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 35, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 40, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

const scene = { id: 'sc', nom: 'Rade', dimensions: { w: 2, h: 2 }, layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }], entities: [], dialogues: [], triggers: [] };

function fresh(party: Combatant[]) {
  seedBattleRng(1);
  useGame.setState({
    party, battle: null, mode: 'exploration', pendingCascade: null, journal: [],
    scene: scene as never, worldMap: null, vessel: null, medic: null, pendingHeal: null,
  } as never);
}

describe('Naufrage — Natation montée par `rollStep` (#1153 L3)', () => {
  it('héros EMPOISONNÉ : base = Niveau NU, l’État est une chip NOMMÉE, cible = valeur jetée + Difficulté', () => {
    const nageur = hero({
      id: 'nag', label: 'Nageur',
      skills: [{ skillId: 'natation', advances: 25, characteristic: 'force' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    fresh([nageur]);

    const nue = skillBaseValue(nageur, 'natation', undefined, 'force');
    const jetee = testValue(nageur, 'natation', 'force');
    expect(jetee, 'l’État sépare la nue de la valeur jetée — sinon le test ne prouve rien').toBeLessThan(nue);
    const diff = rule('sea-shipwreck-swim') as Difficulty;

    beginShipwreck(get, set);
    const step = get().pendingCascade!.participants.find((s) => s.kind === 'shipwreckSwim')!;
    expect(step.base, 'Niveau de Compétence NU (LDB 09 l.17)').toBe(nue);
    expect(step.difficulty, 'la ligne DIT sa Difficulté (#1072)').toBe(diff);
    // CIBLE INVARIANTE : exactement ce que roulait l'ancien monteur à la main.
    expect(step.target).toBe(clampTarget(jetee + DIFFICULTY_MODIFIERS[diff]).target);
    expect(inexplique(step), 'aucune chip « autres » : l’État est nommé').toBe(0);
  });
});

describe('Nuit — contagion / cauchemars / entretien différé montés par `rollStep` (#1153 L3)', () => {
  const restPending = (party: Combatant[]): PendingRest => ({
    places: { lodging: [], food: [] }, quality: 'normale', days: 1, phase: 'setup',
    perHero: Object.fromEntries(party.map((h) => [h.id, { lodging: 'auberge', food: 'repas' }])),
  } as never);

  beforeEach(() => seedBattleRng(1));

  it('Contagion + Cauchemars : cible = valeur RAW + Difficulté, et rien d’anonyme', () => {
    const dormeur = hero({
      id: 'dor', label: 'Dormeur', nightmares: true,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    } as never);
    fresh([dormeur]);
    const { steps } = buildNightCascade(get, set, restPending([dormeur]), {
      fedDaily: true,
      extraContagion: [{ heroId: dormeur.id, diseaseName: 'courante-galopante', difficulty: 'accessible', resVal: restResistVal(dormeur) }],
    } as never);

    const contagion = steps.find((s) => s.kind === 'contagion')!;
    // `restResistVal` (E effective + avances) est la valeur RAW du Test passif : elle ne subit PAS l'État.
    expect(contagion.target).toBe(clampTarget(restResistVal(dormeur) + DIFFICULTY_MODIFIERS.accessible).target);
    expect(contagion.base).toBe(restResistVal(dormeur));
    expect(inexplique(contagion), 'aucune chip « autres » sur la Contagion').toBe(0);

    const cauchemar = steps.find((s) => s.kind === 'nightmare')!;
    const calme = effectiveChar(dormeur, 'force-mentale'); // aucune avance de Calme sur la fixture
    expect(cauchemar.target).toBe(clampTarget(calme + DIFFICULTY_MODIFIERS.facile).target);
    expect(inexplique(cauchemar), 'aucune chip « autres » sur les Cauchemars').toBe(0);
  });

  it('Entretien différé (Faim) : la pénalité RAW est SUR LA CIBLE et nommée, l’écart est nul', () => {
    // Faim DÉJÀ installée (2 Tests derrière lui, jour impair) : le jour franchi tombe sur un Test —
    // avec sa pénalité cumulée « −10 % de plus pour chaque Test » (LDB 18 l.338), donc NON NULLE.
    const affame = hero({
      id: 'aff', label: 'Affamé', conditions: [{ id: 'empoisonne', value: 1 }] as never,
      hunger: { days: 1, tests: 2, failures: 0 },
    } as never);
    fresh([affame]);
    set({ lastUpkeepDay: -1 } as never);
    const deferred: DeferredUpkeepTest[] = [];
    runDailyUpkeep(get, set, { onDeferTest: (t) => deferred.push(t) });
    const faim = deferred.find((t) => t.kind === 'faim');
    expect(faim, 'un jour sans ration diffère bien le Test de Faim').toBeTruthy();

    const somme = (faim!.mods ?? []).reduce((s, m) => s + m.value, 0);
    expect(somme, 'la pénalité cumulée est une ligne NOMMÉE, jamais fondue dans la base').toBe(-20);
    expect(faim!.target).toBe(clampTarget(faim!.base + DIFFICULTY_MODIFIERS[faim!.difficulty] + somme).target);
    const st = deferredUpkeepSteps(get().party, [faim!])[0];
    expect(inexplique(st), 'aucune chip « autres » sur un Test d’entretien').toBe(0);
  });
});

describe('Infirmerie / Activité — cibles montées par `rollLine` (#1153 L3)', () => {
  it('Soin : cible = valeur de Guérison JETÉE + Difficulté (soigneur EMPOISONNÉ)', () => {
    const doc = hero({
      id: 'doc', label: 'Doc',
      skills: [{ skillId: 'guerison', advances: 30, characteristic: 'intelligence' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    const blesse = hero({ id: 'al', label: 'Blessé', wounds: { current: 4, max: 12 } });
    fresh([doc, blesse]);
    get().openMedic({ patientId: 'al' });
    get().medicAct('wounds');
    const ph = get().pendingHeal!;
    // Aucun soutien possible (le patient n'a pas Guérison) → la cible est celle du soigneur seul.
    expect(ph.target).toBe(clampTarget(testValue(doc, 'guerison') + DIFFICULTY_MODIFIERS[ph.difficulty]).target);
    expect(ph.skillValue).toBe(testValue(doc, 'guerison'));
  });

  it('Passe de Rééducation : la cible AFFICHÉE porte l’Accessible +20 que `rollTest` jettera (LDB l.120/179)', () => {
    const doc = hero({ id: 'doc', label: 'Doc', skills: [{ skillId: 'guerison', advances: 30, characteristic: 'intelligence' }] as never });
    const patient = hero({
      id: 'p', label: 'Patient', wounds: { current: 40, max: 40 },
      traumas: [{ label: 'Épaule luxée (bras perdu)', location: 'brasD', restoreDR: 6, ops: [{ op: 'maxWeaponHands', hands: 1 }] }],
    } as never);
    fresh([doc, patient]);
    set({ pendingSurgery: null } as never);
    get().openMedic({ patientId: 'p' });
    get().medicAct('recovery'); // ARME la rééducation (aucun jet)
    const sg = get().medic!.surgery!;
    expect(sg.difficulty).toBe('accessible');
    get().openSurgeryPass();
    const ps = get().pendingSurgery!;
    // La cible ne vaut PLUS la compétence nue : elle porte la Difficulté de l'opération engagée.
    expect(ps.target).toBe(clampTarget(sg.skill + DIFFICULTY_MODIFIERS.accessible).target);
  });

  it('Activité d’interlude : `bestActivitySkill` classe sur la cible ÉCRÊTÉE que le jet subira', () => {
    const h = hero({
      id: 'act', skills: [{ skillId: 'ragot', advances: 20, characteristic: 'sociabilite' }] as never,
      conditions: [{ id: 'empoisonne', value: 1 }] as never,
    });
    const pick = bestActivitySkill(h, { skills: [{ skillId: 'ragot' }] as never, difficulty: 'complexe' })!;
    expect(pick.value).toBe(testValue(h, 'ragot', undefined, undefined));
    expect(pick.target).toBe(clampTarget(pick.value + DIFFICULTY_MODIFIERS.complexe).target);
  });
});
