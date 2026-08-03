import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castSpell, counterspellAttempt } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/**
 * Contre-sort à plusieurs CANDIDATS (Dissipation, LDB 46 l.156) — flux MULTI : le Sort ENNEMI est
 * figé dans `pendingCast`, chaque contre-lanceur éligible a SA rangée
 * (`pendingCounterspell.participants`) avec son propre cycle d'influence. UN SEUL tente (arbitrage
 * utilisateur 2026-08-03, #1029 — lecture stricte du singulier de l.156 ; l.162 « effectuent leur
 * lancer séparément » relève du § Dissiper des Sorts PERMANENTS, l.158-160) : le premier qui chante
 * verrouille les autres AU NIVEAU ÉTAT, et son issue seule s'applique.
 */
describe('Contre-sort à plusieurs candidats — un seul tenteur (flux multi)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCounterspell: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const mk = (name: string, seed: number) => {
      const h = createHero({ speciesId: 'humains-reiklander', careerId: 'sorcier', label: name, careerTalent: 'Magie mineure', rng: makeRNG(seed) });
      h.spells = ['flechette'];
      h.resilience = 1; // pour les tests de Résilience
      return h;
    };
    const w1 = mk('W1', 707), w2 = mk('W2', 101);
    useGame.setState({ party: [w1, w2] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const heroes = b.combatants.filter((c) => c.kind === 'hero');
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    E.characteristics.intelligence = 48; E.characteristics['force-mentale'] = 53;
    E.skills = [{ skillId: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 15 }];
    E.spells = ['carreau'];
    heroes.forEach((h, i) => { h.pos = { x: 10, y: 10 + i }; h.wounds = { ...h.wounds, max: 99, current: 99 }; });
    E.pos = { x: 12, y: 10 }; // ≤ FM mètres de chaque héros
    useGame.setState({ battle: { ...b } });
    return { heroes: heroes as Combatant[], E };
  }

  /** Ouvre l'incantation ENNEMIE figée (= ce que fait le pré-roll de `castSpell` pour un lanceur IA). */
  function enemyCast(E: Combatant, target: Combatant) {
    castSpell(useGame.getState, useGame.setState, E, target, 'carreau');
    useGame.getState().castRoll();
  }
  function openCounter(ids: string[]) {
    useGame.setState({ pendingCounterspell: { participants: ids.map((id) => ({ id, interactive: true, result: null })) } });
  }
  const cur = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  it('le PREMIER qui chante est le tenteur ; le second est REFUSÉ et garde son essai du Round', () => {
    useGame.getState().seedRng(9);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellRoll(h1.id);
    // Geste du SECOND siège (chemin d'un intent réseau, hors UI) : refusé au niveau ÉTAT.
    useGame.getState().counterspellRoll(h2.id);
    const pcs = useGame.getState().pendingCounterspell!;
    expect(counterspellAttempt(pcs)!.id, 'le tenteur est le premier à avoir chanté').toBe(h1.id);
    expect(pcs.participants.find((p) => p.id === h2.id)!.result, 'aucun second jet ne s’est produit').toBeNull();
    expect(cur(h1.id).dispelledThisRound, 'seul le tenteur dépense son essai').toBe(true);
    expect(cur(h2.id).dispelledThisRound, 'l’essai du Round du second est INTACT').toBeFalsy();
    // « Appliquer » : l'issue du tenteur est portée au Sort figé, les deux pendings se ferment.
    useGame.getState().counterspellConfirm();
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
  });

  it('l’influence d’un NON-tenteur est refusée aussi (Résilience : aucun point dépensé)', () => {
    useGame.getState().seedRng(5);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellRoll(h1.id);
    useGame.getState().counterspellForceSuccess(h2.id); // « Je ne faillirai pas ! » d'un non-tenteur
    const parts = useGame.getState().pendingCounterspell!.participants;
    expect(parts.find((p) => p.id === h2.id)!.result, 'la rangée verrouillée reste vierge').toBeNull();
    expect(cur(h2.id).resilience, 'aucune Résilience dépensée sur un geste refusé').toBe(1);
    expect(cur(h2.id).dispelledThisRound).toBeFalsy();
  });

  it('Résilience du TENTEUR : « Je ne faillirai pas ! » dissipe → la cible ne subit aucun Dégât', () => {
    useGame.getState().seedRng(5);
    const { heroes, E } = setup();
    const [h1, h2] = heroes;
    enemyCast(E, h1);
    openCounter([h1.id, h2.id]);
    useGame.getState().counterspellForceSuccess(h2.id); // premier à chanter → c'est LUI le tenteur
    const part = useGame.getState().pendingCounterspell!.participants.find((p) => p.id === h2.id)!;
    expect(part.result!.dispelled).toBe(true);
    expect(cur(h2.id).resilience).toBe(0); // 1 dépensé
    useGame.getState().counterspellConfirm();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(cur(h1.id).wounds.current).toBe(99); // dissipé : cible intacte
  });

  it('« Laisser passer » (aucun Contre-sort) → le Sort se résout tel quel', () => {
    useGame.getState().seedRng(3);
    const { heroes, E } = setup();
    const [h1] = heroes;
    enemyCast(E, h1);
    const castLog = useGame.getState().pendingCast!.result!.log;
    openCounter([h1.id]);
    useGame.getState().counterspellCancel(); // personne ne contre
    expect(useGame.getState().pendingCounterspell).toBeNull();
    expect(useGame.getState().pendingCast).toBeNull();
    expect(castLog).not.toContain('Contre-sort'); // le jet ennemi n'a pas été opposé
  });
});
