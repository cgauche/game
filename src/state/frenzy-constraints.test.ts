import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { frenzyTarget } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';

/**
 * Contraintes de Frénésie pour le HÉROS (LDB 21 l.34) : « vous devez vous déplacer à votre maximum
 * en direction de l'ennemi le plus proche dans votre Ligne de Vue pour l'attaquer. La seule Action
 * possible est un Test de Capacité de Combat ou un Test d'Athlétisme. »
 */
describe('Frénésie héros — cible imposée et déplacement contraint', () => {
  beforeEach(() => { vi.useFakeTimers(); useGame.setState({ battle: null, pendingAttack: null }); });
  afterEach(() => { vi.useRealTimers(); });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const foes = b.combatants.filter((c) => c.kind === 'enemy');
    const [E1, E2] = foes;
    for (const e of foes.slice(2)) e.wounds.current = 0;
    H.pos = { x: 6, y: 10 };
    (H.psychState ??= []).push({ type: 'frenesie' });
    E1.pos = { x: 8, y: 10 }; // le plus PROCHE (2 cases)
    E2.pos = { x: 12, y: 10 }; // plus loin (6 cases)
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, acted: false, movementUsed: 0, movedPreAction: false }, pendingReveals: [] });
    return { H, E1, E2 };
  }

  it('frenzyTarget = l’ennemi le plus proche en Ligne de Vue', () => {
    const { H, E1 } = setup();
    const h = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(frenzyTarget(useGame.getState, h)?.id).toBe(E1.id);
  });

  it('attaquer un AUTRE ennemi que le plus proche est refusé ; le plus proche passe', () => {
    const { E1, E2 } = setup();
    vi.clearAllTimers(); // largue le turn-handoff résiduel du setup (le tour a été forcé sur le héros)
    useGame.getState().battleClickEntity(E2.id, { confirm: true });
    expect(useGame.getState().pendingAttack).toBeNull(); // refusé : pas le plus proche
    useGame.getState().battleClickEntity(E1.id, { confirm: true });
    vi.runOnlyPendingTimers(); // joue le glissé d'approche (charge) → ouvre la frappe
    expect(useGame.getState().pendingAttack?.targetId).toBe(E1.id); // charge/attaque sur la cible imposée
  });

  it('entrée en Frénésie ce Tour (Action dépensée) : la CHARGE vers la cible imposée reste permise (LDB 21 l.34)', () => {
    const { H, E1 } = setup();
    // Le Test de FM pour ENTRER en Frénésie a consommé l'Action (acted), mais PAS le Mouvement : le
    // frénétique « doit se déplacer à son maximum vers l'ennemi le plus proche pour l'attaquer ».
    const b = useGame.getState().battle!;
    const Hc = b.combatants.find((c) => c.id === H.id)!;
    Hc.talents = [...(Hc.talents ?? []), { talentId: 'frenesie', times: 1 }]; // talent Frénésie → attaque d'arme libre dispo (donnée)
    useGame.setState({ battle: { ...b, acted: true }, pendingAttack: null });
    vi.clearAllTimers();
    useGame.getState().battleClickEntity(E1.id, { confirm: true }); // E1 à 2 cases → CHARGE (déplacement + attaque)
    vi.runOnlyPendingTimers(); // joue le glissé d'approche → ouvre la frappe
    const pa = useGame.getState().pendingAttack;
    expect(pa?.targetId).toBe(E1.id); // la charge s'ouvre malgré l'Action dépensée (≠ blocage « attaque directe seulement »)
    expect(pa?.fromCharge).toBe(true);
  });

  it('se déplacer en s’ÉLOIGNANT de la cible imposée est refusé ; s’en rapprocher passe', () => {
    const { H } = setup();
    const before = { ...useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos! };
    useGame.getState().battleClickTile({ x: before.x - 2, y: before.y }, { confirm: true }); // s'éloigne
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual(before);
    useGame.getState().battleClickTile({ x: before.x + 1, y: before.y }, { confirm: true }); // se rapproche
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos).toEqual({ x: before.x + 1, y: before.y });
  });
});
