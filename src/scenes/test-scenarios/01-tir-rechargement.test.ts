import { describe, it, expect } from 'vitest';
import { scenario } from './01-tir-rechargement';

describe('Scénario Tir & Rechargement', () => {
  it('le héros porte une arbalète (Recharge ≥1) équipée + des carreaux', () => {
    const party = scenario.makeParty();
    expect(party.length).toBeGreaterThanOrEqual(1);
    const hero = party[0];
    const ranged = hero.weapons.find((w) => w.type === 'ranged');
    expect(ranged).toBeTruthy();
    expect(ranged!.reload ?? 0).toBeGreaterThanOrEqual(1); // Recharge → Test étendu
    expect(ranged!.subType).toBe('Arbalète');
    const ammo = (hero.items ?? []).find((i) => i.kind === 'ammo' && i.subType === 'Arbalète');
    expect(ammo && (ammo.qty ?? 0) > 0).toBe(true);
  });
  it('la scène a un encounter (autoCombat) avec une cible à distance', () => {
    expect(scenario.autoCombat).toBeTruthy();
    const enc = scenario.scene.encounters.find((e) => e.id === scenario.autoCombat);
    expect(enc).toBeTruthy();
    expect(enc!.enemies.length).toBeGreaterThanOrEqual(1);
  });
});
