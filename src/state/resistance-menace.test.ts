import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { openCombatEndCascade, applyEffects } from './combatFlow';
import { gainCorruption } from './corruptionFlow';
import { seedBattleRng } from './battleRng';
import { bonus } from '../engine/characteristics';
import type { Combatant } from '../engine/types';

/**
 * Talent « Résistance (Menace) » CÂBLÉ sur les flux de jet (LDB 10 l.1015-1021) — verbe `resist` de la
 * fabrique rollFlow (MÊME mécanisme d'auto-succès que la Résilience, autre ressource : 1× par spec et
 * par séance) : le Test tagué `menace` réussit d'office avec DR = Bonus d'Endurance. Le tag `menace` ET
 * la spec du talent sont désormais des ids stables (Phase 3) : exposition à la Corruption ('corruption'),
 * seuil → mutation ('mutation'), Contraction de fin de combat ('maladie'), opposition à un Sort ('magie').
 * Poison ('poison') = tag de DONNÉE (`FlowTest.menace` du Venin/lames empoisonnées) → couvert par les
 * étapes `triggeredTest`.
 */
const hero = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'a', name: 'A', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 43, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [],
    talents: [
      { talentId: 'resistance', spec: 'corruption', times: 1 },
      { talentId: 'resistance', spec: 'maladie', times: 1 },
      { talentId: 'resistance', spec: 'mutation', times: 1 },
      { talentId: 'resistance', spec: 'magie', times: 1 },
    ],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 2, fortune: 1,
    ...p,
  } as Combatant);

function setBattle(combatants: Combatant[]) {
  useGame.setState({ battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, log: [], over: null } as any });
}

beforeEach(() => {
  seedBattleRng(1);
  useGame.setState({ battle: null, mode: 'exploration', journal: [], pendingCascade: null, pendingCorruption: null, pendingCast: null, pendingCastOpposition: null });
});

describe('Résistance (Corruption) — exposition (modale pendingCorruption, LDB 19 l.23-75)', () => {
  it('l’Effet corruptionExposure tague la modale `menace: corruption` ; `corruptionResist` = auto-succès à DR = BE + spec consommée', () => {
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'moderee', skill: 'resistance', heroId: a.id }]);
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.menace).toBe('corruption');
    useGame.getState().corruptionResist();
    const done = useGame.getState().pendingCorruption!;
    expect(done.success).toBe(true);
    expect(done.sl).toBe(bonus(43)); // « utilisez votre Bonus d'Endurance comme DR » → 4
    expect(useGame.getState().party[0].resistanceUsed).toContain('corruption');
    // Modérée + succès à DR 4 (≥ 2) → 0 Point de Corruption au resolve.
    useGame.getState().resolveCorruption();
    expect(useGame.getState().party[0].corruption ?? 0).toBe(0);
  });

  it('« le premier Test […] à chaque séance » : 2e exposition la même séance → resist NO-OP ; nouvelle séance (restoreFortuneNow) → ré-armé', () => {
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    useGame.getState().corruptionResist();
    useGame.getState().resolveCorruption();
    // 2e exposition, même séance : la spec est consommée → le verbe ne fait RIEN (pas de jet posé).
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.roll).toBeUndefined();
    useGame.getState().corruptionRoll(); // le jet normal reste possible
    useGame.getState().resolveCorruption();
    // Début de séance (couture UNIQUE restoreFortune) → compteur remis, le talent est de nouveau offert.
    useGame.getState().restoreFortuneNow();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
  });

  it('utilisable APRÈS un échec (même fenêtre que la Résilience) — jamais sur un Test déjà réussi', () => {
    seedBattleRng(4); // 1er d100 = 93 → échec garanti (cible ≤ 63)
    const a = hero();
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    useGame.getState().corruptionRoll();
    expect(useGame.getState().pendingCorruption!.success).toBe(false);
    useGame.getState().corruptionResist(); // rattrapage post-échec
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
    expect(useGame.getState().party[0].resistanceUsed).toContain('corruption');
  });

  it('spec non couverte → resist NO-OP (pas de dépense)', () => {
    const a = hero({ talents: [{ talentId: 'resistance', spec: 'poison', times: 1 }] });
    useGame.setState({ party: [a] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: a.id }]);
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.roll).toBeUndefined();
    expect(useGame.getState().party[0].resistanceUsed ?? []).toEqual([]);
  });
});

describe('Résistance (Mutation) — Test de SEUIL de Corruption (LDB 19 l.80)', () => {
  it('le seuil ouvre la modale taguée `menace: mutation` ; resist → contenu (pas de mutation)', () => {
    const a = hero({ corruption: 7 }); // seuil BFM+BE = 3+4 = 7 → le prochain gain déborde
    useGame.setState({ party: [a] });
    setBattle([a]);
    gainCorruption(useGame.getState, useGame.setState, a, 1);
    const pc = useGame.getState().pendingCorruption!;
    expect(pc.kind).toBe('seuil');
    expect(pc.menace).toBe('mutation');
    useGame.getState().corruptionResist();
    expect(useGame.getState().pendingCorruption!.success).toBe(true);
    useGame.getState().resolveCorruption();
    expect((a.mutations ?? []).length).toBe(0); // contenu « pour cette fois »
    expect(a.resistanceUsed).toContain('mutation');
  });
});

describe('Résistance (Maladie) — Contraction de fin de combat (LDB 20 l.32/49)', () => {
  it('étape `combatEndDisease` taguée `menace: maladie` ; cascadeResist → réussite à DR = BE → PAS de contraction', () => {
    const a = hero({ diseaseExposure: [{ disease: 'blessure-purulente' }] });
    setBattle([a]);
    useGame.setState({ party: [hero()] });
    openCombatEndCascade(useGame.getState, useGame.setState);
    const p = useGame.getState().pendingCascade!;
    const step = p.participants.find((s) => s.kind === 'combatEndDisease')!;
    expect(step.menace).toBe('maladie');
    useGame.getState().cascadeResist(step.id);
    const rolled = useGame.getState().pendingCascade!.participants.find((s) => s.id === step.id)!;
    expect(rolled.result).toEqual({ roll: 1, target: step.target, sl: bonus(43), success: true });
    useGame.getState().cascadeNext();
    expect(a.diseases ?? []).toHaveLength(0); // résisté → pas de Blessure Purulente
    expect(a.resistanceUsed).toContain('maladie');
  });
});

describe('Résistance (Magie) — opposition à un Sort (« résister aux sorts »)', () => {
  it('pendingCastOpposition tagué `menace: magie` ; oppositionResist → la cible RÉSISTE (DR = BE)', () => {
    const a = hero();
    const foe = hero({ id: 'e', name: 'E', kind: 'enemy', talents: [] });
    useGame.setState({ party: [a] });
    setBattle([a, foe]);
    useGame.setState({
      pendingCast: {
        casterId: foe.id, targetId: a.id, spellId: 'fauche-demon', missile: false, focused: false,
        result: { cast: true, roll: 30, target: 70, sl: 6, isCritical: false, isFumble: false, log: 'x' },
      } as never,
      pendingCastOpposition: { participants: [{ id: a.id, interactive: true, result: null }], kind: 'resist', char: 'FM', menace: 'magie' } as never,
    });
    useGame.getState().oppositionResist(a.id);
    const part = useGame.getState().pendingCastOpposition!.participants[0];
    expect(part.result!.resisted).toBe(true);
    expect(part.result!.oppose.sl).toBe(bonus(43));
    expect(part.result!.margin).toBe(Math.max(0, 6 - bonus(43)));
    expect(a.resistanceUsed).toContain('magie');
  });
});
