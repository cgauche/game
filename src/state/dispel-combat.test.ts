import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame, type BattleState } from './store';
import type { Combatant } from '../engine/types';

/** Action de combat « Dissiper » (LDB 46 l.204-207) : ouverture du pending (Soutien même Domaine),
 *  cumul du DR sur `caster.dispel`, dissipation au NI. Calque la Focalisation. */
describe('Dissipation permanente — Action de combat', () => {
  beforeEach(() => { vi.clearAllTimers(); useGame.setState({ battle: null, pendingDispel: null }); });

  const langue = { skillId: 'langue', spec: 'magick', characteristic: 'Int' as const, advances: 20 };
  const mk = (id: string, spells: string[], extra: Partial<Combatant> = {}): Combatant => ({
    id, name: id, kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 40, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [langue], talents: [], spells, pos: { x: 1, y: 1 },
    ...extra,
  } as unknown as Combatant);

  function setup() {
    // Deux lanceurs du MÊME Domaine (Bête) avec Langue (Magick) + une cible portant un sort durable.
    const mage = mk('mage', ['forme-bestiale']); // ids STABLES (subType Bête)
    const allie = mk('allie', ['incarnation-de-wyssan'], { pos: { x: 2, y: 1 } }); // subType Bête → même Domaine
    const cible: Combatant = mk('cible', [], {
      kind: 'enemy', pos: { x: 5, y: 5 },
      activeEffects: [{ label: 'Malédiction', char: 'Ag', bonus: -10, duration: { scale: 'rounds', left: 9 },
        spell: { spellId: 'malefice', ni: 2, casterId: 'ennemi', label: 'Maléfice' } }],
    } as unknown as Combatant) as Combatant;
    const battle = { combatants: [mage, allie, cible], order: ['mage', 'allie', 'cible'], turn: 0, round: 1, acted: false, over: false, log: [] } as unknown as BattleState;
    useGame.setState({ battle });
    return { mage, allie, cible };
  }

  it('ouvre le pending avec le NI du sort + Soutien « même Domaine »', () => {
    setup();
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    expect(pd).toBeTruthy();
    expect(pd.ni).toBe(2);
    expect(pd.support?.count).toBe(1); // allie (même Domaine Bête, Langue Magick) assiste
    expect(pd.support?.bonus).toBe(10);
    expect(pd.value).toBe(60 + 10); // Int 40 + 20 avances Langue = 60, + Soutien 10
  });

  it('cumule le DR et dissipe le sort quand le DR cumulé atteint le NI', () => {
    const { cible } = setup();
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd = useGame.getState().pendingDispel!;
    // Round 1 : DR +1 (cumul 1/2) → sort toujours actif, progression persistée.
    useGame.setState({ pendingDispel: { ...pd, result: { roll: 10, target: pd.value, sl: 1, success: true } } });
    useGame.getState().dispelConfirm();
    const mage1 = useGame.getState().battle!.combatants.find((c) => c.id === 'mage')!;
    expect(mage1.dispel).toEqual({ spellId: 'malefice', spellCasterId: 'ennemi', total: 1 });
    expect((useGame.getState().battle!.combatants.find((c) => c.id === 'cible')!.activeEffects ?? []).length).toBe(1); // toujours là

    // Round 2 : re-Dissiper, DR +1 (cumul 2/2) → dissipé.
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: false } as BattleState });
    useGame.getState().battleDispelSpell('malefice', 'ennemi');
    const pd2 = useGame.getState().pendingDispel!;
    useGame.setState({ pendingDispel: { ...pd2, result: { roll: 10, target: pd2.value, sl: 1, success: true } } });
    useGame.getState().dispelConfirm();
    const cibleAfter = useGame.getState().battle!.combatants.find((c) => c.id === 'cible')!;
    expect((cibleAfter.activeEffects ?? []).some((e) => e.spell?.spellId === 'malefice')).toBe(false); // dissipé
    const mage2 = useGame.getState().battle!.combatants.find((c) => c.id === 'mage')!;
    expect(mage2.dispel).toBeUndefined(); // accumulateur effacé
    void cible;
  });
});
