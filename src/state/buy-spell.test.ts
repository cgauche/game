/**
 * Lot 7 — achat/apprentissage de sorts côté store : buySpell (PX, Chaos → +1
 * Corruption), Effet d'éditeur learnSpell (sans PX), lecture au grimoire (NI ×2
 * dans le flux pendingCast).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, effectiveSpellOf } from './combatFlow';
import { makePregens } from '../data/pregens';
import type { Combatant } from '../engine/types';

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingReveals: [] });
  useGame.getState().seedRng(41);
});

describe('buySpell', () => {
  it('mémorise contre PX (Magie mineure) ; refuse sans PX suffisants', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    w.talents.push({ talentId: 'magie-mineure', times: 1 });
    // Prémisse contrôlée (les stats des pré-tirés évoluent avec la création) : BFM 2, et
    // Wilhelmina connaît déjà 2 sorts mineurs (Fléchette, Choc) = ses BFM inclus au Talent.
    // Le suivant est PAYANT : « Jusqu'à BFM ×1 » (bande inclusive) = 50 PX (LDB 10 l.591).
    w.characteristics.FM = 25;
    w.xp = 60;
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().buySpell(w.id, 'drain');
    const after = useGame.getState().party[0];
    expect(after.spells).toContain('drain'); // runtime = id de sort
    expect(after.xp).toBe(10);
    useGame.getState().buySpell(w.id, 'eblouissant'); // 3 connus → bande ×2 : 100 PX > 10 restants
    expect(useGame.getState().party[0].spells).not.toContain('eblouissant');
    expect(useGame.getState().journal.join('\n')).toMatch(/PX requis/);
  });

  it('Bénédictions du culte : 0 PX (incluses au Talent Béni)', () => {
    const p = makePregens().find((h) => h.name === 'Frère Anselm')!;
    p.talents.push({ talentId: 'beni', spec: 'Sigmar', times: 1 });
    p.xp = 0;
    useGame.setState({ party: [p] as Combatant[] });
    useGame.getState().buySpell(p.id, 'benediction-de-puissance'); // Sigmar (LDB 41)
    expect(useGame.getState().party[0].spells).toContain('benediction-de-puissance'); // id de sort
    expect(useGame.getState().party[0].xp).toBe(0);
  });

  it('sort de Magie du Chaos : 100 PX ET +1 Point de Corruption', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    w.talents.push({ talentId: 'magie-du-chaos', spec: 'Nurgle', times: 1 });
    w.xp = 200;
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().buySpell(w.id, 'flot-de-corruption');
    const after = useGame.getState().party[0];
    expect(after.spells).toContain('flot-de-corruption'); // sort du Chaos appris (id stable)
    expect(after.corruption ?? 0).toBeGreaterThanOrEqual(1); // +1 Point de Corruption (LDB 19)
    expect(after.xp).toBe(100); // 200 − 100 PX
  });
});

describe('Effet learnSpell (trouvaille de campagne)', () => {
  it('apprend SANS PX au héros au Talent éligible', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    const other = makePregens().find((h) => h.name === 'Sigmund Reikhardt')!;
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 }); // rend le sort d'Arcane apprenable
    w.xp = 0;
    useGame.setState({ party: [other, w] as Combatant[] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'learnSpell', spell: 'arme-aethyrique' }]);
    const after = useGame.getState().party.find((h) => h.id === w.id)!;
    expect(after.spells).toContain('arme-aethyrique'); // id de sort (runtime) ; pas le guerrier : le Talent guide la cible
    expect(after.xp).toBe(0);
  });
});

describe('lecture au grimoire — NI doublé dans le flux', () => {
  it('effectiveSpellOf double le NI quand pendingCast.grimoire', () => {
    const base = effectiveSpellOf({ spellId: 'arme-aethyrique' });
    const doubled = effectiveSpellOf({ spellId: 'arme-aethyrique', grimoire: true });
    expect(doubled!.cn).toBe((base!.cn ?? 0) * 2);
  });

  it('oocCastSpell(fromGrimoire) refuse sans grimoire porté', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().oocCastSpell(w.id, 'arme-aethyrique', w.id, true);
    expect(useGame.getState().pendingCast).toBeNull();
    expect(useGame.getState().journal.join('\n')).toMatch(/grimoire/);
  });

  it('avec grimoire porté + Domaine : pendingCast.grimoire posé', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    w.talents.push({ talentId: 'magie-des-arcanes', spec: 'Feu', times: 1 });
    w.spells = (w.spells ?? []).filter((s) => s !== 'arme-aethyrique'); // id de sort (runtime)
    w.items = [...(w.items ?? []), { uid: 'g1', name: 'Grimoire', isGrimoire: true, kind: 'misc', enc: 1, qualities: [] } as never];
    useGame.setState({ party: [w] as Combatant[] });
    useGame.getState().oocCastSpell(w.id, 'arme-aethyrique', w.id, true);
    expect(useGame.getState().pendingCast?.grimoire).toBe(true);
  });
});
