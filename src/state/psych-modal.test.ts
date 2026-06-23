import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { openRoundStartPsych, openRoundEndCascade } from './combatFlow';
import { FLOWS } from './rollFlows';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/**
 * Psychologie de COMBAT — régime CASCADE de Round (LDB 21). Les Traits ciblés et les NOUVELLES
 * Terreurs se testent au DÉBUT du Round (l.14,
 * `openRoundStartPsych`) ; la Peur est un Test ÉTENDU testé à la FIN de chaque Round (l.27,
 * `openRoundEndPsych`). Chaque collecte ouvre UNE cascade `purpose:'combat'`, applier 'combatPsych',
 * une étape par héros — résolue par les handlers `cascade*`. On vérifie ce contrat.
 */
describe('Psychologie de combat héros — cascade de Round (Peur/Terreur)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(enemySize: Combatant['size']) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source
    E.size = enemySize;
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // Ligne de Vue dégagée
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn }, pendingCascade: null, pendingReveals: [] }); // vide la révélation d'Initiative
    return { H, E };
  }

  it('Terreur : openRoundStartPsych ouvre la cascade ; cascadeRoll+cascadeNext applique le Brisé', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('enorme'); // gap 2 → Terreur 2
    H.characteristics.FM = 10; // Test de Calme raté → Brisé
    openRoundStartPsych(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade;
    expect(c).toBeTruthy();
    expect(c!.purpose).toBe('combat');
    const step = c!.participants[0];
    expect(step.kind).toBe('combatPsych');
    expect(step.combatPsych?.kind).toBe('terreur');
    expect(step.combatPsych?.sourceId).toBe(E.id);
    expect(step.result).toBeFalsy();

    useGame.getState().cascadeRoll(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(h.conditions.some((c) => c.name === 'brise')).toBe(true);
    expect((h.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === E.id)).toBe(true); // la Terreur devient une Peur
    expect(useGame.getState().pendingCascade).toBeNull(); // cascade close (1 héros)
  });

  it('Peur : openRoundEndPsych ouvre la cascade (kind peur) et cumule le DR', () => {
    useGame.getState().seedRng(2);
    const { E } = setup('grande'); // gap 1 → Peur 1
    openRoundEndCascade(useGame.getState, useGame.setState);
    const c = useGame.getState().pendingCascade;
    expect(c).toBeTruthy();
    const step = c!.participants[0];
    expect(step.combatPsych?.kind).toBe('peur');
    expect(step.combatPsych?.sourceId).toBe(E.id);
    useGame.getState().cascadeRoll(step.id);
    expect(typeof useGame.getState().pendingCascade!.participants[0].result!.sl).toBe('number');
    useGame.getState().cascadeNext();
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Peur — Résilience « Je ne faillirai pas ! » : réussite forcée (DR maximal) + Résilience consommée', () => {
    useGame.getState().seedRng(2);
    const { H } = setup('grande'); // Peur 1 (Indice 1)
    H.resilience = 2;
    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.combatPsych?.kind).toBe('peur');

    // Résilience AVANT le jet : réussite garantie (dé 01 → DR max), −1 Résilience. La cascade générique
    // force le succès ; l'applier 'combatPsych' cumule le DR vers l'Indice (vainc à ≥ Indice).
    useGame.getState().cascadeForceSuccess(step.id);
    const r = useGame.getState().pendingCascade!.participants[0].result!;
    expect(r.success).toBe(true);
    expect(r.roll).toBe(1);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.resilience).toBe(1);

    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const peur = (h.psychState ?? []).find((p) => p.type === 'peur');
    expect(peur).toBeTruthy();
    expect(peur!.calmeDR! >= 1).toBe(true); // DR maximal du dé 01 ≥ Indice 1 → Peur surmontée
  });

  it('Détermination sur une Peur de combat = immunité TEMPORAIRE (LDB 17 l.62) : psychImmuneRoundsLeft posé, calmeDR INCHANGÉ, Peur NON surmontée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande'); // E est une source de Peur (Taille)
    H.resolve = 2;
    const round = useGame.getState().battle!.round;
    // Peur déjà ENTAMÉE (Test étendu) : 1 DR cumulé sur 3 requis, pas encore testée ce Round.
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 3, calmeDR: 1, lastTestRound: round - 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.combatPsych?.kind).toBe('peur');
    expect(step.combatPsych?.prevDR).toBe(1); // l'étape part du DR déjà cumulé

    // Détermination : NE force PAS le succès — immunité temporaire. -1 Détermination, ActiveEffect psychImmune (2 Rounds).
    useGame.getState().cascadeDetermine(step.id);
    const sAfterDet = useGame.getState().pendingCascade!.participants[0];
    expect(sAfterDet.immune).toBe(true);
    const hMid = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hMid.resolve).toBe(1);
    expect(hMid.activeEffects?.find((e) => e.psychImmune)?.duration).toEqual({ scale: 'rounds', left: 2 });

    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const peur = (h.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.calmeDR).toBe(1); // DR INCHANGÉ : la Peur n'a PAS été cumulée…
    expect(peur.calmeDR! >= peur.indice!).toBe(false); // …ni surmontée (toujours sous l'emprise)
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('Résilience « Je ne faillirai pas ! » sur une Peur de combat : le DR gagné suit le dé CHOISI (LDB 17 l.73)', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande');
    H.resilience = 2;
    const round = useGame.getState().battle!.round;
    H.psychState = [{ type: 'peur', sourceId: E.id, indice: 6, calmeDR: 0, lastTestRound: round - 1 }];
    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.combatPsych?.kind).toBe('peur');

    // forceSuccess (dé par défaut 01 → DR max) PUIS dé CHOISI : on prend un dé MOYEN (réussite à plus
    // faible DR que le 01). Le DR gagné DOIT suivre ce dé (pas rester au max). Le picker n'existe que
    // pour cette étape (Peur étendue).
    useGame.getState().cascadeForceSuccess(step.id);
    const target = useGame.getState().pendingCascade!.participants[0].result!.target;
    expect(FLOWS.cascade.picker?.(useGame.getState().pendingCascade!.participants[0], H)).toBeTruthy();
    const maxDR = useGame.getState().pendingCascade!.participants[0].result!.sl; // DR du dé 01 (max)
    const chosen = Math.max(1, target - 5); // dé élevé encore réussi → DR plus faible
    useGame.getState().cascadeSetForcedRoll(step.id, chosen);
    const r = useGame.getState().pendingCascade!.participants[0].result!;
    expect(r.roll).toBe(chosen);
    expect(r.success).toBe(true);
    expect(r.sl).toBeLessThan(maxDR); // le DR gagné SUIT le dé choisi (plus faible qu'au 01)

    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const peur = (h.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur.calmeDR).toBe(r.sl); // le DR cumulé est exactement celui du dé choisi (prevDR 0 + r.sl)
  });

  it('le picker (dé choisi) N\'existe PAS sur une étape BINAIRE (Terreur) : réussite au DR max', () => {
    useGame.getState().seedRng(2);
    const { H } = setup('enorme'); // Terreur 2 (étape binaire)
    H.resilience = 1;
    openRoundStartPsych(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.combatPsych?.kind).toBe('terreur');
    useGame.getState().cascadeForceSuccess(step.id);
    expect(FLOWS.cascade.picker?.(useGame.getState().pendingCascade!.participants[0], H)).toBeNull();
  });

  it('Sans Peur (Ennemi, LDB 10 l.864) : Peur testée par UN seul Calme Accessible (+20) ; réussite → ignorée', () => {
    useGame.getState().seedRng(2);
    const { H, E } = setup('grande'); // source de Peur 1 (Taille)
    E.groups = ['Ogre'];
    H.talents = [...(H.talents ?? []), { talentId: 'sans-peur', spec: 'Ogre', times: 1 }]; // Sans Peur (Ogre)
    openRoundEndCascade(useGame.getState, useGame.setState);
    const step = useGame.getState().pendingCascade!.participants[0];
    expect(step.combatPsych?.kind).toBe('peur');
    expect(step.combatPsych?.sansPeur).toBe(true); // marqué Sans Peur
    expect(step.target).toBe(step.base! + 20); // Test de Calme Accessible (+20), pas Intermédiaire (+0)

    // Une réussite IGNORE la Peur d'emblée (un seul Test) → DR porté à l'Indice (Peur surmontée).
    useGame.getState().cascadeForceSuccess(step.id);
    useGame.getState().cascadeNext();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    const peur = (h.psychState ?? []).find((p) => p.type === 'peur' && p.sourceId === E.id)!;
    expect(peur).toBeTruthy();
    expect(peur.calmeDR! >= peur.indice!).toBe(true); // ignorée (vaincue) en un seul Test
  });

  it('pas de source de peur (ennemi de même Taille) → aucune cascade (ni début ni fin de Round)', () => {
    setup('moyenne');
    openRoundStartPsych(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();
    openRoundEndCascade(useGame.getState, useGame.setState);
    expect(useGame.getState().pendingCascade).toBeNull();
  });

  it('la Peur ne se teste PAS au début de Round (réservée à la fin) ; la Terreur PAS à la fin', () => {
    useGame.getState().seedRng(2);
    setup('grande'); // Peur 1
    openRoundStartPsych(useGame.getState, useGame.setState); // Peur exclue du début → aucune cascade
    expect(useGame.getState().pendingCascade).toBeNull();

    setup('enorme'); // Terreur 2
    openRoundEndCascade(useGame.getState, useGame.setState); // Terreur exclue de la fin → aucune cascade
    expect(useGame.getState().pendingCascade).toBeNull();
  });
});
