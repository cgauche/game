import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

/**
 * Incantation OPPOSÉE (`SpellSpec.opposed`) — multijet DANS la modale de cast (jamais auto-caché) :
 * une cible oppose son Test (FM pour Fauche-démon, Int pour Parole de Tzeentch) à l'incantation
 * FIGÉE. Cible IA = rangée TÉMOIN (jet roulé à l'ouverture). `oppositionConfirm` agrège
 * (résisté + marge de DR) puis `applyCast` n'applique qu'aux cibles n'ayant PAS résisté.
 * (LDB 48 « Fauche-démon » : Test d'Incantation opposé par la FM ; LDB 51 « Parole de Tzeentch ».)
 */
describe('Incantation opposée (SpellSpec.opposed — multijet)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null, pendingCastOpposition: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const hero = createHero({
      speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'W',
      careerTalent: 'Magie mineure', rng: makeRNG(707),
    });
    hero.spells = ['fauche-demon', 'parole-de-tzeentch'];
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
    E.groups = ['demon']; // cible Démoniaque (le gate `onlyGroups` de Fauche-démon)
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 12, y: 10 };
    useGame.setState({ battle: { ...b } });
    return { H, E };
  }

  /** Pose une incantation RÉUSSIE figée (résultat contrôlé) prête à confirmer. */
  function frozenCast(H: Combatant, E: Combatant, spellId: string, sl: number) {
    useGame.setState({
      pendingCast: {
        casterId: H.id, targetId: E.id, spellId, missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl, isCritical: false, isFumble: false, log: 'x' },
      },
    });
  }

  it('GATE : un Sort `opposed` réussi OUVRE le multijet d’opposition (garde pendingCast, ne s’applique pas encore)', () => {
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // FM faible → DR d'opposition plafonné (max +2)
    frozenCast(H, E, 'fauche-demon', 6);
    useGame.getState().castConfirm();
    const pco = useGame.getState().pendingCastOpposition;
    expect(pco).toBeTruthy();
    expect(pco!.kind).toBe('resist');
    expect(pco!.char).toBe('force-mentale');
    expect(useGame.getState().pendingCast).toBeTruthy(); // l'incantation reste figée le temps de l'opposition
    const part = pco!.participants.find((p) => p.id === E.id)!;
    expect(part.interactive).toBe(false); // cible IA = rangée témoin
    expect(part.result).toBeTruthy(); // jet roulé à l'ouverture (révélé, jamais caché)
  });

  it('le lanceur l’emporte (DR d’incantation > opposition) → la cible Démoniaque est annihilée', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 20; // opposition ≤ +2 DR, l'incantation à +6 gagne toujours
    frozenCast(H, E, 'fauche-demon', 6);
    useGame.getState().castConfirm(); // ouvre l'opposition, IA auto-roulée
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(false);
    useGame.getState().oppositionConfirm(); // agrège → applyCast
    expect(useGame.getState().pendingCast).toBeNull();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    expect(after.dead).toBe(true); // bannie/retirée du jeu (Fauche-démon)
  });

  it('la cible résiste (FM élevée) → le Sort ne l’affecte pas (PB intacts, pas d’annihilation)', () => {
    useGame.getState().seedRng(11);
    const { H, E } = setup();
    E.characteristics['force-mentale'] = 100; // FM ≥ 100 → DR d'opposition toujours ≥ l'incantation à +0
    E.wounds = { current: 12, max: 20 };
    frozenCast(H, E, 'fauche-demon', 0);
    useGame.getState().castConfirm();
    const part = useGame.getState().pendingCastOpposition!.participants.find((p) => p.id === E.id)!;
    expect(part.result!.resisted).toBe(true);
    useGame.getState().oppositionConfirm();
    const after = useGame.getState().battle!.combatants.find((c) => c.id === E.id)!;
    // Résiste à l'incantation entière : ni op (annihilation) ni rider de Domaine (frappe d'Hysh).
    expect(after.wounds.current).toBe(12);
    expect(after.dead ?? false).toBe(false);
  });

  it('paramétrage par Sort : Parole de Tzeentch oppose l’INTELLIGENCE (pas la FM)', () => {
    const { H, E } = setup();
    frozenCast(H, E, 'parole-de-tzeentch', 4);
    useGame.getState().castConfirm();
    const pco = useGame.getState().pendingCastOpposition!;
    expect(pco.char).toBe('intelligence');
  });
});
