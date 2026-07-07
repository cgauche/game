/**
 * Effets d'éditeur de SANTÉ rendus authorables (audit jouabilité §B) : imposer la Faim (LDB 18),
 * l'Exposition froid/chaleur (LDB 18), et ouvrir les jeux de taverne (NADJ ch.16). Chacun s'applique
 * via `applyEffects` et réutilise son moteur PUR existant (provisions / exposure / tavernFlow).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { cascadeAppliers } from './cascade';
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

describe('Effet exposureNight (LDB 18 l.326-334) — cascade INFLUENÇABLE (plus de jet silencieux)', () => {
  it('froid → OUVRE `count` étapes influençables par héros, AUCUN jet résolu (result null), rien encaissé en silence', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    useGame.getState().seedRng(3); // graine qui produisait des échecs à l'ancien (inline)
    const beforeW = useGame.getState().party[0].wounds.current;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'froid', count: 4, target: 'hero', heroId: party[0].id }]);
    const pc = useGame.getState().pendingCascade;
    expect(pc).not.toBeNull(); // le jet est DIFFÉRÉ en modale, pas roulé en boucle
    const steps = pc!.participants.filter((s) => s.kind === 'exposure' && s.actorId === party[0].id);
    expect(steps).toHaveLength(4); // un jet influençable par Test
    expect(steps.every((s) => s.result == null)).toBe(true); // rien résolu → rien de subi encore
    expect((steps[0].meta as { kind?: string } | undefined)?.kind).toBe('froid');
    expect(useGame.getState().party[0].wounds.current).toBe(beforeW); // aucune Blessure encaissée en silence
  });

  it('chaleur → étapes taguées kind "chaleur" ; SANS Possession lourde, la CONSÉQUENCE d’un échec (applier partagé) pose Exténué + journal chaleur (l.330)', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'exposureNight', kind: 'chaleur', count: 4, target: 'party' }]);
    const step = useGame.getState().pendingCascade!.participants.find((s) => s.kind === 'exposure')!;
    expect((step.meta as { kind?: string } | undefined)?.kind).toBe('chaleur');
    // Un échec (via l'applier `exposure` partagé) : 1ᵉʳ échec chaleur = −10 Int/FM + Exténué (l.330).
    // Aucune Possession lourde (items vidés) → conséquence IMMÉDIATE, comme avant l'implémentation du choix.
    const h = useGame.getState().party[0];
    h.items = [];
    const failed = { ...step, result: { roll: 99, target: step.target!, sl: -5, success: false } } as typeof step;
    const out = cascadeAppliers['exposure'].apply(
      useGame.getState, useGame.setState, failed, h, { steps: [failed], index: 0 },
    );
    expect((h.conditions ?? []).some((c) => c.name === 'extenue')).toBe(true);
    expect((out?.journal ?? []).some((l) => /chaleur|suffoque|accablé/i.test(l))).toBe(true);
    expect(out?.insert).toBeUndefined();
  });
});

describe('Exposition CHALEUR — annulation par délestage d’une Possession lourde (LDB 18 l.332)', () => {
  const heavyItem = { uid: 'sac-1', trappingId: 'grand-sac', name: 'Grand sac à dos', kind: 'misc', qualities: [], equipped: true, enc: 3 } as never;

  it('avec une Possession lourde : AUCUNE conséquence immédiate, un CHOIX est inséré (rien encaissé en silence)', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = [heavyItem];
    const step = { id: 'e0', kind: 'exposure', actorId: h.id, target: 50, meta: { kind: 'chaleur' },
      result: { roll: 99, target: 50, sl: -5, success: false } } as unknown as import('./pendings').CascadeStep;
    const out = cascadeAppliers['exposure'].apply(useGame.getState, useGame.setState, step, h, { steps: [step], index: 0 });
    expect((h.conditions ?? []).some((c) => c.name === 'extenue')).toBe(false); // choix non encore rendu, rien n'a été tranché
    expect(h.items).toHaveLength(1); // objet toujours en inventaire, rien n'a été jeté
    expect(out?.insert).toHaveLength(1);
    expect(out!.insert![0].kind).toBe('exposure-heat-drop');
    expect(out!.insert![0].options?.map((o) => o.key).sort()).toEqual(['garder', 'jeter']);
  });

  it('« jeter » : retire l’objet, ANNULE le Test (aucune escalade)', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = [heavyItem];
    const choice = { id: 'e0-drop', kind: 'exposure-heat-drop', actorId: h.id, chosen: 'jeter', meta: { failNumber: 1 } } as unknown as import('./pendings').CascadeStep;
    const out = cascadeAppliers['exposure-heat-drop'].apply(useGame.getState, useGame.setState, choice, h, { steps: [choice], index: 0 });
    expect(h.items).toHaveLength(0); // délestée
    expect((h.conditions ?? []).some((c) => c.name === 'extenue')).toBe(false); // Test ANNULÉ, pas subi
    expect((out?.journal ?? []).some((l) => /annulé/i.test(l))).toBe(true);
  });

  it('« garder » : conserve l’objet, la conséquence de l’échec s’applique normalement', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = [heavyItem];
    const choice = { id: 'e0-drop', kind: 'exposure-heat-drop', actorId: h.id, chosen: 'garder', meta: { failNumber: 1 } } as unknown as import('./pendings').CascadeStep;
    const out = cascadeAppliers['exposure-heat-drop'].apply(useGame.getState, useGame.setState, choice, h, { steps: [choice], index: 0 });
    expect(h.items).toHaveLength(1); // conservé
    expect((h.conditions ?? []).some((c) => c.name === 'extenue')).toBe(true); // 1ᵉʳ échec chaleur (l.330)
    expect((out?.journal ?? []).some((l) => /chaleur|suffoque|accablé/i.test(l))).toBe(true);
  });

  it('escalade : un échec ANNULÉ (jeté) ne compte PAS dans le rang du prochain échec GENUINE', () => {
    const party = makePregens().slice(0, 1);
    useGame.setState({ party, pendingCascade: null, journal: [] });
    const h = useGame.getState().party[0];
    h.items = []; // la Possession lourde a déjà été jetée avant ce 2ᵉ Test (plus rien à jeter)
    const cancelled = { id: 'e0', kind: 'exposure', actorId: h.id, target: 50, meta: { kind: 'chaleur' },
      result: { roll: 99, target: 50, sl: -5, success: false } } as unknown as import('./pendings').CascadeStep;
    const drop = { id: 'e0-drop', kind: 'exposure-heat-drop', actorId: h.id, chosen: 'jeter' } as unknown as import('./pendings').CascadeStep;
    const second = { id: 'e1', kind: 'exposure', actorId: h.id, target: 50, meta: { kind: 'chaleur' },
      result: { roll: 88, target: 50, sl: -4, success: false } } as unknown as import('./pendings').CascadeStep;
    const steps = [cancelled, drop, second];
    const out = cascadeAppliers['exposure'].apply(useGame.getState, useGame.setState, second, h, { steps, index: 2 });
    // Sans le 1er échec annulé, ce 2ᵉ Test GENUINE est le 1ᵉʳ échec RÉEL (l.330 : −10 Int/FM + Exténué),
    // PAS le 2ᵉ (qui infligerait −10 aux autres caractéristiques en plus).
    expect((out?.journal ?? []).join(' ')).toMatch(/suffoque/);
    expect((out?.journal ?? []).join(' ')).not.toMatch(/accablé/);
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
