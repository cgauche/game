import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { startCascade, registerCascadeApplier, stepInteraction, stepReady } from './cascade';
import type { CascadeStep } from './pendings';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — cœur générique. 3ᵉ consommateur de la
 * fabrique UNIQUE de jet, SÉQUENTIEL comme le Test Étendu mais avec une conséquence PROPRE par étape
 * (registre `cascadeAppliers`) et insertion dynamique d'étapes (dépendance abri → Exposition).
 */
describe('Cascade séquentielle influençable', () => {
  const applied: { kind: string; success: boolean }[] = [];
  beforeEach(() => {
    applied.length = 0;
    useGame.setState({ battle: null, pendingCascade: null, journal: [] });
    // Conséquence synthétique : enregistre l'étape validée + une ligne de journal.
    registerCascadeApplier('tally', (_get, _set, step) => {
      applied.push({ kind: step.kind, success: !!step.result?.success });
      return { journal: [`${step.label} → ${step.result?.success ? 'réussi' : 'raté'}`] };
    });
  });

  function hero() {
    const h = createHero({ speciesLabel: 'Humains (Reiklander)', careerLabel: 'Soldat', name: 'Brawn', rng: makeRNG(1) });
    h.fortune = 2; h.resilience = 1;
    useGame.setState({ party: [h] });
    return h;
  }
  const step = (id: string, actorId: string, target = 55): CascadeStep =>
    ({ id, kind: 'tally', actorId, label: id, rollLabel: 'Résistance', base: target, target, result: null, interactive: true });

  it('présente une étape à la fois, applique chaque conséquence dans l’ordre, puis finalise', () => {
    useGame.getState().seedRng(3);
    const h = hero();
    startCascade(useGame.getState, useGame.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id)],
    });
    // Étape 1 : seule l'étape COURANTE (cursor) est active.
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeRoll('s1');
    expect(useGame.getState().pendingCascade!.participants[0].result).toBeTruthy();
    useGame.getState().cascadeNext(); // valide s1 → conséquence appliquée, avance sur s2
    expect(applied).toHaveLength(1);
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
    // Étape 2 → fin de cascade.
    useGame.getState().cascadeRoll('s2');
    useGame.getState().cascadeNext();
    expect(applied).toHaveLength(2);
    expect(useGame.getState().pendingCascade).toBeNull(); // finalisée
    expect(useGame.getState().journal.some((l) => l.startsWith('s1'))).toBe(true); // journal des conséquences
  });

  it('« Étape suivante » est un no-op tant que l’étape courante n’est pas lancée', () => {
    const h = hero();
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [step('s1', h.id)] });
    useGame.getState().cascadeNext(); // pas encore lancé → rien ne se passe
    expect(applied).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
  });

  it('une conséquence peut INSÉRER des étapes suivantes (dépendance abri → Exposition)', () => {
    useGame.getState().seedRng(5);
    const h = hero();
    registerCascadeApplier('shelter', (_get, _set, step) => {
      applied.push({ kind: step.kind, success: !!step.result?.success });
      // Abri raté → 2 jets d'Exposition insérés ; réussi → aucun.
      const insert = step.result?.success ? [] : [step1Insert(h.id, 'expo-a'), step1Insert(h.id, 'expo-b')];
      return { insert };
    });
    function step1Insert(actorId: string, id: string): CascadeStep {
      return { id, kind: 'tally', actorId, label: id, rollLabel: 'Résistance', base: 40, target: 40, result: null, interactive: true };
    }
    // Abri FORCÉ raté (dé 99) → insère 2 étapes d'Exposition.
    const shelter: CascadeStep = { id: 'abri', kind: 'shelter', actorId: h.id, label: 'Abri', rollLabel: 'Survie', base: 40, target: 40, result: { roll: 99, target: 40, sl: -5, success: false }, interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'Camp', purpose: 'test', steps: [shelter] });
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(1);
    useGame.getState().cascadeNext(); // valide l'abri raté → +2 étapes
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(3); // abri + 2 Exposition
    expect(useGame.getState().pendingCascade!.cursor).toBe(1); // on enchaîne sur la 1ʳᵉ insérée
  });

  it('« Tout lancer » résout d’office les étapes restantes puis montre le BILAN avant fermeture', () => {
    useGame.getState().seedRng(9);
    const h = hero();
    startCascade(useGame.getState, useGame.setState, {
      title: 'Nuit', purpose: 'test', steps: [step('s1', h.id), step('s2', h.id), step('s3', h.id)],
    });
    useGame.getState().cascadeResolveAll(); // auto-résout s1..s3
    expect(applied).toHaveLength(3); // toutes les conséquences se sont appliquées
    // BILAN : la modale reste ouverte (curseur EN FIN) pour voir les conséquences — pas encore fermée.
    expect(useGame.getState().pendingCascade!.cursor).toBe(3);
    useGame.getState().cascadeFinish(); // « Terminer » ferme
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('mêmes verbes d’influence : la Chance relance une étape propre ratée', () => {
    const h = hero();
    const failed: CascadeStep = { id: 's1', kind: 'tally', actorId: h.id, label: 's1', rollLabel: 'Résistance', base: 30, target: 30, result: { roll: 88, target: 30, sl: -5, success: false }, rerolled: false, interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'Nuit', purpose: 'test', steps: [failed] });
    useGame.getState().cascadeReroll('s1');
    expect(useGame.getState().party[0].fortune).toBe(1); // 1 Point de Chance dépensé
    // Résilience : étape garantie réussie.
    useGame.getState().cascadeForceSuccess('s1');
    expect(useGame.getState().pendingCascade!.participants[0].result!.success).toBe(true);
    expect(useGame.getState().party[0].resilience).toBe(0);
  });

  it('stepInteraction / stepReady : type d’interaction inféré des champs', () => {
    const jet: CascadeStep = { id: 'j', kind: 'tally', actorId: 'x', rollLabel: 'R', base: 30, target: 30, result: null, interactive: true };
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: 'x', options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], interactive: true };
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: 'x', interactive: true };
    expect(stepInteraction(jet)).toBe('jet');
    expect(stepInteraction(choix)).toBe('choix');
    expect(stepInteraction(aff)).toBe('affichage');
    expect(stepReady(jet)).toBe(false);
    expect(stepReady({ ...jet, result: { roll: 10, target: 30, sl: 2, success: true } })).toBe(true);
    expect(stepReady(choix)).toBe(false);
    expect(stepReady({ ...choix, chosen: 'a' })).toBe(true);
    expect(stepReady(aff)).toBe(true);
  });

  it('étape « choix » : no-op sans choix, puis l’option pilote la conséquence + insertion', () => {
    const h = hero();
    registerCascadeApplier('pick', (_g, _s, step) => {
      applied.push({ kind: step.kind, success: step.chosen === 'devier' });
      return step.chosen === 'devier' ? { insert: [{ id: 'suite', kind: 'note', actorId: h.id, interactive: true }] } : {};
    });
    registerCascadeApplier('note', (_g, _s, step) => { applied.push({ kind: step.kind, success: true }); return { journal: [`${step.id}`] }; });
    const choix: CascadeStep = { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'devier', label: 'Dévier' }, { key: 'subir', label: 'Subir' }], interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [choix] });
    useGame.getState().cascadeNext(); // pas de choix → no-op
    expect(applied).toHaveLength(0);
    expect(useGame.getState().pendingCascade!.cursor).toBe(0);
    useGame.getState().cascadeChoose('c', 'devier');
    expect(useGame.getState().pendingCascade!.participants[0].chosen).toBe('devier');
    useGame.getState().cascadeNext(); // valide → applier voit 'devier' + insère 'suite'
    expect(applied[0]).toEqual({ kind: 'pick', success: true });
    expect(useGame.getState().pendingCascade!.participants).toHaveLength(2);
    expect(useGame.getState().pendingCascade!.cursor).toBe(1);
  });

  it('étape « affichage » : validée sans jet ni choix', () => {
    const h = hero();
    registerCascadeApplier('note', (_g, _s, step) => { applied.push({ kind: 'note', success: true }); return { journal: [`${step.id}`] }; });
    const aff: CascadeStep = { id: 'd', kind: 'note', actorId: h.id, interactive: true };
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps: [aff] });
    useGame.getState().cascadeNext(); // affichage → acquitté directement, cascade finalisée
    expect(applied).toEqual([{ kind: 'note', success: true }]);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('« Tout lancer » résout une séquence MIXTE (jet roulé, choix par défaut, affichage) → bilan', () => {
    useGame.getState().seedRng(7);
    const h = hero();
    registerCascadeApplier('pick', (_g, _s, step) => { applied.push({ kind: 'pick', success: step.chosen === 'a' }); return {}; });
    registerCascadeApplier('note', (_g, _s) => { applied.push({ kind: 'note', success: true }); return {}; });
    const steps: CascadeStep[] = [
      step('s1', h.id), // jet (tally)
      { id: 'c', kind: 'pick', actorId: h.id, options: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], interactive: true }, // défaut = 'a'
      { id: 'd', kind: 'note', actorId: h.id, interactive: true }, // affichage
    ];
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps });
    useGame.getState().cascadeResolveAll();
    expect(applied.map((a) => a.kind)).toEqual(['tally', 'pick', 'note']);
    expect(applied[1]).toEqual({ kind: 'pick', success: true }); // défaut = 1ʳᵉ option 'a'
    expect(useGame.getState().pendingCascade!.cursor).toBe(3); // bilan (curseur en fin)
    useGame.getState().cascadeFinish();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('étape « affichage » : contenu pré-posé (outcome) PRÉSERVÉ par un applier muet', () => {
    const h = hero();
    registerCascadeApplier('reveal', () => {}); // applier MUET (mutation seule, aucun journal)
    registerCascadeApplier('note', (_g, _s) => { applied.push({ kind: 'note', success: true }); return {}; });
    const steps: CascadeStep[] = [
      { id: 'r', kind: 'reveal', actorId: h.id, outcome: ['Sonné appliqué (Assommante)'], interactive: true }, // affichage
      { id: 'd', kind: 'note', actorId: h.id, interactive: true },
    ];
    startCascade(useGame.getState, useGame.setState, { title: 'T', purpose: 'test', steps });
    useGame.getState().cascadeNext(); // valide l'affichage → figé, avance sur 'd'
    const committed = useGame.getState().pendingCascade!.participants[0];
    expect(committed.committed).toBe(true);
    expect(committed.outcome).toEqual(['Sonné appliqué (Assommante)']); // contenu pré-posé NON effacé
  });
});
