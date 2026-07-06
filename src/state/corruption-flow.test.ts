/**
 * Corruption — flux store (LDB 19) : exposition par modale (Effet d'éditeur),
 * gain → seuil → mutation → limites (damné), Sombre Pacte (relance à +1 Corruption).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { makePregens } from '../data/pregens';
import mutationTables from '../data/mutationTables.json';
import type { Combatant } from '../engine/types';

function party2() {
  const all = makePregens();
  const a = all[0];
  const b = all[1];
  return { a, b, party: [a, b] as Combatant[] };
}

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCorruption: null, pendingTest: null, pendingReveals: [] });
  useGame.getState().seedRng(13);
});

describe('Effet corruptionExposure → modale → resolveCorruption', () => {
  it('ouvre pendingCorruption sur le héros visé ; le gain suit corruptionGain (niveau + DR)', () => {
    const { a, party } = party2();
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    const pc = useGame.getState().pendingCorruption;
    expect(pc).toBeTruthy();
    expect(pc!.heroId).toBe(a.id);
    useGame.getState().corruptionRoll();
    const rolled = useGame.getState().pendingCorruption!;
    expect(rolled.roll).not.toBeNull();
    // On force l'échec pour un résultat déterministe (mineure + échec → +1).
    useGame.setState({ pendingCorruption: { ...rolled, roll: 99, target: 30, sl: -7, success: false } });
    useGame.getState().resolveCorruption();
    expect(useGame.getState().pendingCorruption).toBeNull();
    expect(useGame.getState().party.find((h) => h.id === a.id)!.corruption).toBe(1);
    expect(useGame.getState().journal.join('\n')).toMatch(/Corruption/);
  });

  it('compétence DÉTERMINÉE par la source (skill) → verrouillée, corruptionSetSkill sans effet', () => {
    const { a, party } = party2();
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'calme', heroId: a.id }]);
    expect(useGame.getState().pendingCorruption!.skill).toBe('calme');
    expect(useGame.getState().pendingCorruption!.skillLocked).toBe(true);
    useGame.getState().corruptionSetSkill('resistance'); // verrouillé → ignoré
    expect(useGame.getState().pendingCorruption!.skill).toBe('calme');
  });

  it('compétence INDÉTERMINÉE (skill absent) → défaut Résistance, choix joueur autorisé', () => {
    const { a, party } = party2();
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', heroId: a.id }]);
    expect(useGame.getState().pendingCorruption!.skill).toBe('resistance'); // défaut affiché
    expect(useGame.getState().pendingCorruption!.skillLocked).toBeFalsy();
    useGame.getState().corruptionSetSkill('calme'); // le joueur tranche
    expect(useGame.getState().pendingCorruption!.skill).toBe('calme');
    // Après le jet, plus de changement possible.
    useGame.getState().corruptionRoll();
    useGame.getState().corruptionSetSkill('resistance');
    expect(useGame.getState().pendingCorruption!.skill).toBe('calme');
  });

  it('seuil (l.80) : Résistance verrouillée', () => {
    const { a, party } = party2();
    a.corruption = 99; // au-delà du seuil BFM+BE
    useGame.setState({ party });
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    const pc = useGame.getState().pendingCorruption;
    expect(pc?.kind).toBe('seuil');
    expect(pc?.skill).toBe('resistance');
    expect(pc?.skillLocked).toBe(true);
  });

  it('exposition repoussée (DR suffisant) → aucun Point', () => {
    const { a, party } = party2();
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'moderee', skill: 'calme', heroId: a.id }]);
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 5, target: 45, sl: 4, success: true } });
    useGame.getState().resolveCorruption();
    expect(useGame.getState().party.find((h) => h.id === a.id)!.corruption ?? 0).toBe(0);
  });
});

describe('gainCorruption : seuil → mutation → limites (l.80-95)', () => {
  it('sous le seuil : aucun Test, juste le compteur', () => {
    const { a, party } = party2();
    useGame.setState({ party });
    const lines = gainCorruption(useGame.getState, useGame.setState, a, 1);
    expect(a.corruption).toBe(1);
    expect(a.mutations ?? []).toHaveLength(0);
    expect(lines[0]).toMatch(/\+1 Point de Corruption/);
  });

  it('au-delà du seuil → MODALE de Test de Résistance (kind seuil) ; échec acquitté → mutation + révélation 🧬', () => {
    const { a, party } = party2();
    a.characteristics.E = 1; // BE 0
    a.characteristics.FM = 30; // BFM 3
    a.corruption = 4; // seuil = BFM(3) + BE(0) = 3 → dépassé au prochain gain
    a.resilience = 0; // sans Résilience, pas de « Je te renie ! » (LDB 17 l.71) → mutation directe
    useGame.setState({ party });
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    // « Un jet = une modale » : le Test du seuil est DIFFÉRÉ — visible, avec Chance/Pacte.
    const pc = useGame.getState().pendingCorruption;
    expect(pc).toBeTruthy();
    expect(pc!.kind).toBe('seuil');
    expect(pc!.heroId).toBe(a.id);
    expect(a.mutations ?? []).toHaveLength(0); // rien n'est appliqué avant la résolution
    useGame.getState().corruptionRoll();
    // Échec forcé (déterministe) puis acquittement → mutation (−BFM) + révélation témoin.
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 99, target: 30, sl: -7, success: false } });
    useGame.getState().resolveCorruption();
    const after = useGame.getState().party.find((h) => h.id === a.id)!;
    expect(after.mutations?.length).toBe(1);
    expect(after.corruption).toBe(Math.max(0, 5 - 3)); // −BFM après mutation
    const reveal = useGame.getState().pendingReveals.find((r) => r.kind === 'mutation');
    expect(reveal).toBeTruthy();
    expect(reveal!.subjectId).toBe(a.id);
  });

  it('align de la SOURCE → la mutation est tirée sur la table EDOC alignée (l\'éditeur de niveau le pose)', () => {
    const { a, party } = party2();
    a.characteristics.E = 1; // BE 0
    a.characteristics.FM = 30; // BFM 3
    a.corruption = 4; // seuil dépassé au prochain gain
    a.resilience = 0; // mutation directe
    useGame.setState({ party });
    gainCorruption(useGame.getState, useGame.setState, a, 1, 'nurgle'); // source alignée Nurgle
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.kind).toBe('seuil');
    expect(pc.align).toBe('nurgle'); // l'alignement voyage source → modale
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 99, target: 30, sl: -7, success: false } });
    useGame.getState().resolveCorruption();
    const after = useGame.getState().party.find((h) => h.id === a.id)!;
    expect(after.mutations?.length).toBe(1);
    // La mutation obtenue est atteignable depuis une table EDOC « nurgle » (phys/mental/sous-table).
    const nurgleRefs = new Set(
      (mutationTables as { id: string; ranges: { mutation: string }[] }[])
        .filter((t) => t.id.includes('nurgle')).flatMap((t) => t.ranges.map((r) => r.mutation)),
    );
    expect(nurgleRefs.has(after.mutations![0].id)).toBe(true);
  });

  it('seuil RÉUSSI (acquitté) : Corruption contenue, aucune mutation', () => {
    const { a, party } = party2();
    a.characteristics.E = 1; // BE 0 → seuil = BFM seul
    a.characteristics.FM = 30;
    a.corruption = 4;
    useGame.setState({ party });
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 3, target: 30, sl: 2, success: true } });
    useGame.getState().resolveCorruption();
    expect(useGame.getState().party.find((h) => h.id === a.id)!.mutations ?? []).toHaveLength(0);
    expect(useGame.getState().journal.join('\n')).toMatch(/contient sa Corruption/);
  });

  it('limites dépassées → damné + hors-jeu (dead)', () => {
    const { a, party } = party2();
    a.characteristics.E = 1; // BE 0 → 1 mutation physique suffit
    a.characteristics.FM = 1; // BFM 0 → 1 mutation mentale suffit ; perte de Corruption = 0
    a.corruption = 5; // seuil = 0 → dépassé
    a.resilience = 1; // AVEC Résilience : la mutation est suspendue (« Je te renie ! ») → on choisit de SUBIR
    useGame.setState({ party });
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 99, target: 5, sl: -9, success: false } });
    useGame.getState().resolveCorruption();
    expect(useGame.getState().pendingRenounce).toBeTruthy();
    useGame.getState().renounceResolve(false); // subir la mutation
    const after = useGame.getState().party.find((h) => h.id === a.id)!;
    expect(after.mutations?.length).toBe(1);
    expect(after.damned).toBe(true);
    expect(after.dead).toBe(true);
  });

  it('PNJ (pas de modale) : seuil auto-résolu — la mutation tombe sans pendingCorruption', () => {
    const { a, party } = party2();
    const npc = { ...a, id: 'npc-1', kind: 'enemy', characteristics: { ...a.characteristics, E: 1, FM: 1 }, corruption: 5, resilience: 0, mutations: [] } as unknown as Combatant;
    useGame.setState({ party, battle: { combatants: [npc], log: [] } as never });
    gainCorruption(useGame.getState, useGame.setState, npc, 1);
    expect(useGame.getState().pendingCorruption).toBeNull();
  });
});

describe('Sombre Pacte (l.16/41)', () => {
  it('Test de compétence raté : testDarkPact relance SANS Chance, +1 Corruption, même déjà relancé', () => {
    const { a, party } = party2();
    a.fortune = 0; // aucune Chance — le Pacte marche quand même
    useGame.setState({
      party,
      pendingTest: {
        actorId: a.id, actorName: a.name, label: 'Test important', skillValue: 40,
        difficulty: 'intermediaire', requireSL: 0, target: 40,
        roll: 95, sl: -6, success: false, isDouble: false, rerolled: true, onSuccess: [], onFailure: [],
      } as never,
    });
    useGame.getState().seedRng(1); // reseed JUSTE avant la relance → d100 déterministe (indépendant du setup)
    useGame.getState().testDarkPact();
    const pt = useGame.getState().pendingTest as { roll?: number } | null;
    expect(pt?.roll).not.toBe(95); // relancé (seed fixe → valeur stable ≠ 95)
    expect(useGame.getState().party.find((h) => h.id === a.id)!.corruption).toBe(1);
  });

  it('Test réussi : le Pacte est refusé (on ne relance qu\'un Test RATÉ)', () => {
    const { a, party } = party2();
    useGame.setState({
      party,
      pendingTest: {
        actorId: a.id, actorName: a.name, label: 'Test', skillValue: 40,
        difficulty: 'intermediaire', requireSL: 0, target: 40,
        roll: 12, sl: 2, success: true, isDouble: false, onSuccess: [], onFailure: [],
      } as never,
    });
    useGame.getState().testDarkPact();
    expect((useGame.getState().pendingTest as { roll?: number }).roll).toBe(12);
    expect(useGame.getState().party.find((h) => h.id === a.id)!.corruption ?? 0).toBe(0);
  });
});

describe('Effet ops { op: corruption } (gain direct via ops generiques)', () => {
  it('cible le heros designe et applique le compteur via l\'Effet ops', () => {
    const { b, party } = party2();
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'ops', on: 'hero', heroId: b.id, ops: [{ op: 'corruption', amount: 2, align: 'nurgle' }] }]);
    expect(useGame.getState().party.find((h) => h.id === b.id)!.corruption).toBe(2);
  });

  it('align voyage jusqu\'a gainCorruption : seuil declenche la table EDOC nurgle', () => {
    const { a, party } = party2();
    a.characteristics.E = 1; // BE 0
    a.characteristics.FM = 30; // BFM 3
    a.corruption = 4; // seuil depasse au prochain gain
    a.resilience = 0; // mutation directe
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'ops', on: 'hero', heroId: a.id, ops: [{ op: 'corruption', amount: 1, align: 'nurgle' }] }]);
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.kind).toBe('seuil');
    expect(pc.align).toBe('nurgle'); // l\'alignement voyage source -> modale
    useGame.getState().corruptionRoll();
    useGame.setState({ pendingCorruption: { ...useGame.getState().pendingCorruption!, roll: 99, target: 30, sl: -7, success: false } });
    useGame.getState().resolveCorruption();
    const after = useGame.getState().party.find((h) => h.id === a.id)!;
    expect(after.mutations?.length).toBe(1);
    const nurgleRefs = new Set(
      (mutationTables as { id: string; ranges: { mutation: string }[] }[])
        .filter((t) => t.id.includes('nurgle')).flatMap((t) => t.ranges.map((r) => r.mutation)),
    );
    expect(nurgleRefs.has(after.mutations![0].id)).toBe(true);
  });
});

// #152 (suite #143) : `corruptionTarget` (utilisé par `resolveRenounce` / « Je te renie ! ») filtrait
// encore `kind === 'hero'` — reconditionné sur `followsCharacterRules` (engine/relations.ts), le MÊME
// prédicat que le reste de la boucle de fin de combat/Corruption (#143).
describe('corruptionTarget — #152 : reconditionné sur followsCharacterRules (pas kind===\'hero\')', () => {
  const e30 = { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 };
  const npcPersonnage = (p: Partial<Combatant>): Combatant =>
    ({
      id: 'npc', name: 'PNJ', kind: 'enemy', followsCharacterRules: true,
      characteristics: e30,
      wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
      weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      ...p,
    } as Combatant);

  it('trouve un PNJ ENNEMI flagué `followsCharacterRules` par id (pas seulement un héros)', () => {
    const npc = npcPersonnage({});
    useGame.setState({ party: [], battle: { combatants: [npc], log: [] } as never });
    expect(corruptionTarget(useGame.getState(), npc.id)).toBe(npc);
  });

  it('une créature GÉNÉRIQUE (sans le flag) n’est jamais résolue par corruptionTarget, même par id', () => {
    const monster = { ...npcPersonnage({}), followsCharacterRules: undefined };
    useGame.setState({ party: [], battle: { combatants: [monster], log: [] } as never });
    expect(corruptionTarget(useGame.getState(), monster.id)).toBeUndefined();
  });

  it('« Je te renie ! » (resolveRenounce) résout sur un PNJ ennemi flagué : la Résilience est bien décomptée', () => {
    const npc = npcPersonnage({ resilience: 1 });
    useGame.setState({
      party: [],
      battle: { combatants: [npc], log: [] } as never,
      pendingRenounce: { heroId: npc.id, testRoll: 99, testTarget: 30 },
    });
    useGame.getState().renounceResolve(true);
    expect(useGame.getState().pendingRenounce).toBeNull();
    expect(npc.resilience).toBe(0); // trouvé via followsCharacterRules → « Je te renie ! » a pu s'appliquer
  });
});
