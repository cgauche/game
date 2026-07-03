/**
 * Battement & Distraire JOUÉS PAR LE HÉROS (flux par modale, ≠ IA). Prouve que le câblage store →
 * FLOWS.battement/FLOWS.distraire → resolveBattement/resolveDistraire produit bien l'effet RAW :
 *  - Battement (LDB 10 l.103) : Action, Test de CC non opposé → retire de l'Avantage adverse ;
 *  - Distraire (LDB 10 l.364) : Mouvement, Test opposé Athlétisme vs Calme → pose `distractedRounds`.
 * On pilote le VRAI flux (battleX → xRoll → xConfirm), avec des Caractéristiques rendant l'issue
 * déterministe, et on vérifie l'effet + le coût (Action pour Battement, Mouvement pour Distraire).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { engage } from '../engine/engagement';
import type { Combatant } from '../engine/types';

describe('Battement & Distraire — flux HÉROS (par modale, pas l’IA)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null, pendingBattement: null, pendingDistraire: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /** Un héros (avec les deux Talents) face à UN ennemi armé et pourvu d'Avantage, adjacent. */
  function setup() {
    useGame.getState().seedRng(1);
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
    hero.talents = [{ talentId: 'battement', times: 1 }, { talentId: 'distraire', times: 1 }] as Combatant['talents'];
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    enemies.slice(1).forEach((e) => (e.dead = true));
    const E = enemies[0];
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 11, y: 10 }; // adjacent (Engagé pour le Battement, en Ligne de vue pour le Distraire)
    // Ennemi ARMÉ (prérequis Battement l.103) + pourvu d'Avantage à retirer/nier.
    E.weapons = [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0 }, qualities: [], uid: 'sw' }] as Combatant['weapons'];
    E.advantage = 3;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, movementUsed: 0, acted: false } });
    return { H, E };
  }

  it('Battement : Action, jet de CC réussi → l’Avantage adverse chute ; l’Action est consommée', () => {
    const { H, E } = setup();
    H.characteristics.CC = 60;
    H.resilience = 1; // Résilience : réussite garantie (LDB 17 l.73) → issue déterministe (jet du flux forcé)
    engage(H, E); // Engagé (prérequis l.103)
    expect(useGame.getState().battle!.combatants.find((c) => c.id === E.id)!.advantage).toBe(3);

    useGame.getState().battleBattement(); // OUVRE la modale (défaut = 1er foe éligible), sans tirer
    const pb = useGame.getState().pendingBattement;
    expect(pb).toBeTruthy();
    expect(pb!.foeId).toBe(E.id);
    expect(pb!.result).toBeNull(); // rien n’est tiré avant Lancer

    useGame.getState().battementRoll(); // le flux tire le jet de CC (figé)
    useGame.getState().battementForceSuccess(); // Résilience → le jet du flux est forcé en réussite (LDB 17 l.73)
    expect(useGame.getState().pendingBattement!.result!.success).toBe(true);
    useGame.getState().battementConfirm(); // Appliquer → resolveBattement

    const st = useGame.getState();
    expect(st.pendingBattement).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.advantage).toBeLessThan(3); // l’Avantage adverse a bien été retiré (LDB 10 l.103)
    expect(st.battle!.acted).toBe(true); // Battement = Action → consommée
  });

  it('Distraire : Mouvement, Test opposé gagné → distractedRounds=2 ; le Mouvement est consommé, PAS l’Action', () => {
    const { H, E } = setup();
    H.characteristics.Ag = 95; // Athlétisme très haut → gagne le Test opposé
    E.characteristics.FM = 5; // Calme (figé à l’ouverture) très bas → perd
    expect(E.distractedRounds ?? 0).toBe(0);

    useGame.getState().battleDistraire(); // OUVRE (fige le Calme du foe), sans tirer l’Athlétisme
    const pd = useGame.getState().pendingDistraire;
    expect(pd).toBeTruthy();
    expect(pd!.foeId).toBe(E.id);
    expect(pd!.atk).toBeNull(); // Athlétisme du mover pas encore lancé
    expect(pd!.defRoll).toBeTruthy(); // Calme du foe déjà figé

    useGame.getState().distraireRoll(); // le flux tire l’Athlétisme, opposé au Calme figé
    expect(useGame.getState().pendingDistraire!.result).toBe('success');
    useGame.getState().distraireConfirm(); // Appliquer → resolveDistraire

    const st = useGame.getState();
    expect(st.pendingDistraire).toBeNull();
    const e2 = st.battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.distractedRounds).toBe(2); // le foe est distrait (LDB 10 l.364)
    expect(st.battle!.acted).toBe(false); // Distraire = Mouvement → l’Action reste disponible
    expect(st.battle!.movementUsed).toBeGreaterThan(0); // le Mouvement est consommé
  });

  it('Battement échoué (CC très bas) : l’Avantage adverse est PRÉSERVÉ ; l’Action reste consommée', () => {
    const { H, E } = setup();
    H.characteristics.CC = 1; // échec quasi certain
    engage(H, E);
    useGame.getState().battleBattement();
    useGame.getState().battementRoll();
    expect(useGame.getState().pendingBattement!.result!.success).toBe(false);
    useGame.getState().battementConfirm();
    const e2 = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(e2.advantage).toBe(3); // rien retiré sur un échec (manv.battementFail)
  });
});
