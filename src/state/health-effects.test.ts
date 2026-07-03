/**
 * Effets d'éditeur de SANTÉ rendus authorables (audit jouabilité §B) : imposer la Faim (LDB 18),
 * l'Exposition froid/chaleur (LDB 18), et ouvrir les jeux de taverne (NADJ ch.16). Chacun s'applique
 * via `applyEffects` et réutilise son moteur PUR existant (provisions / exposure / tavernFlow).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { makePregens } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import { effectiveChar } from '../engine/characteristics';

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], tavernGames: null });
  useGame.getState().seedRng(7);
});

describe('Effet inflictHunger (LDB 18 l.417-422)', () => {
  it('1 jour affamé → 1ᵉʳ échec : −10 en Force et en Endurance (via le pool de faim)', () => {
    const party = makePregens().slice(0, 1);
    const baseF = effectiveChar(party[0], 'F');
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 1, target: 'hero', heroId: party[0].id }]);
    const h = useGame.getState().party[0];
    expect(h.hunger?.failures).toBe(1);
    expect(effectiveChar(h, 'F')).toBe(baseF - 10); // 1ᵉʳ échec = −10 F/E (hungerCharPenalties)
  });

  it('2 jours → 2ᵉ échec : Dégâts encaissés (1d10 ignorant les PA, min 1) sur tout le groupe', () => {
    const party = makePregens().slice(0, 2);
    const before = party.map((h) => h.wounds.current);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 2, target: 'party' }]);
    const after = useGame.getState().party;
    expect(after[0].hunger?.failures).toBe(2);
    // 2ᵉ échec → au moins 1 Blessure sur chaque héros.
    expect(after[0].wounds.current).toBeLessThan(before[0]);
    expect(after[1].wounds.current).toBeLessThan(before[1]);
  });

  it('journalise l’affliction', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictHunger', days: 1, target: 'hero', heroId: party[0].id }]);
    expect(useGame.getState().journal.some((l) => /affam/i.test(l))).toBe(true);
  });
});

describe('Effet exposureNight (LDB 18 l.326-334)', () => {
  it('froid → Tests de Résistance en cascade, pénalités/Blessures possibles + journal', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party });
    useGame.getState().seedRng(3); // graine produisant des échecs
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'froid', count: 4, target: 'hero', heroId: party[0].id }]);
    // Le journal porte au moins une ligne d'Exposition (jets/échecs/froid) — le moteur a bien tourné.
    expect(useGame.getState().journal.some((l) => /froid|Exposition|grelotte|transi|gelé/i.test(l))).toBe(true);
  });

  it('chaleur → volet chaleur exercé : sur un échec, État Exténué + journal chaleur (l.330)', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party });
    useGame.getState().seedRng(3); // même graine que le froid : au moins un échec sur 4 Tests
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'chaleur', count: 4, target: 'party' }]);
    const h = useGame.getState().party[0];
    // Un échec de chaleur pose l'État Exténué (l.330) ET journalise une ligne « chaleur ».
    const extenue = (h.conditions ?? []).some((c) => c.name === 'extenue');
    const chaleurLog = useGame.getState().journal.some((l) => /chaleur|accablé/i.test(l));
    expect(extenue).toBe(true);
    expect(chaleurLog).toBe(true);
  });
});

describe('Effet setVessel (navire de campagne, MDG ch.13-15)', () => {
  beforeEach(() => useGame.setState({ vessel: undefined }));

  it('dote le groupe du navire choisi (state.vessel posé, Moral par défaut, coque intacte)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue' }]);
    const v = useGame.getState().vessel;
    expect(v?.vehicleId).toBe('cogue');
    expect(v?.morale.score).toBe(75); // MORALE_BASE (nouvel équipage)
    expect(v?.wounds).toBeUndefined(); // coque intacte (aucun hullMax authoré)
    expect(useGame.getState().journal.some((l) => /navire|cogue/i.test(l))).toBe(true);
  });

  it('Moral et coque INITIAUX authorés sont appliqués', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'cogue', morale: 60, hullMax: 50, hullCurrent: 20 }]);
    const v = useGame.getState().vessel;
    expect(v?.morale.score).toBe(60);
    expect(v?.wounds).toEqual({ current: 20, max: 50 });
  });

  it('ref invalide (véhicule non-navire / inexistant) → no-op (aucun navire posé)', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'charrette' }]); // pas de facette ship
    expect(useGame.getState().vessel).toBeUndefined();
    applyEffects(useGame.getState, useGame.setState, [{ type: 'setVessel', vehicleId: 'zzz-inconnu' }]);
    expect(useGame.getState().vessel).toBeUndefined();
  });
});

describe('Effet openTavernGames (NADJ ch.16)', () => {
  afterEach(() => resetRule('tavern-games'));

  it('option active → ouvre la modale (state tavernGames posé)', () => {
    setRule('tavern-games', true);
    useGame.setState({ party: makePregens().slice(0, 2), tavernGames: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openTavernGames' }]);
    expect(useGame.getState().tavernGames).not.toBeNull();
  });

  it('option éteinte → sans effet (comme interlude désactivé)', () => {
    setRule('tavern-games', false);
    useGame.setState({ party: makePregens().slice(0, 2), tavernGames: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openTavernGames' }]);
    expect(useGame.getState().tavernGames).toBeNull();
  });
});
