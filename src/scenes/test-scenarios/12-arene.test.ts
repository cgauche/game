import { describe, it, expect } from 'vitest';
import { scenario } from './12-arene';
import { condMet } from '../../state/scene';

/** Vérifie que l'arène (100 % données) séquence ses vagues UNIQUEMENT via les flags + conditions de
 *  dialogue composées — aucun mécanisme dédié. */
describe('Arène — séquençage des vagues par flags (#3)', () => {
  const master = scenario.scene.entities.find((e) => e.id === 'maitre')!;
  const dlg = scenario.scene.dialogues.find((d) => d.id === master.dialogueId)!;
  const node = dlg.nodes.find((n) => n.id === dlg.start)!;
  // Vagues lançables (startCombat visibles) pour un état de flags donné.
  const launchable = (flags: Record<string, boolean>): string[] =>
    node.choices
      .filter((c) => !c.condition || condMet(c.condition, flags))
      .flatMap((c) => (c.effects ?? []).filter((e) => e.type === 'startCombat').map((e) => (e as { encounter: string }).encounter));

  it('au départ : seule la vague 1 est lançable', () => {
    expect(launchable({})).toEqual(['wave-1']);
  });
  it('après la vague 1 : seule la vague 2', () => {
    expect(launchable({ arene_v1: true })).toEqual(['wave-2']);
  });
  it('après la vague 2 : seule la vague 3 (finale)', () => {
    expect(launchable({ arene_v1: true, arene_v2: true })).toEqual(['wave-3']);
  });
  it('arène vaincue : plus aucune vague lançable', () => {
    expect(launchable({ arene_v1: true, arene_v2: true, arene_v3: true })).toEqual([]);
  });
  it('chaque vague pose son flag de progression + un butin dans onVictory', () => {
    scenario.scene.encounters.forEach((enc, i) => {
      const eff = enc.onVictory ?? [];
      expect(eff.some((e) => e.type === 'setFlag' && (e as { flag: string }).flag === `arene_v${i + 1}`)).toBe(true);
      expect(eff.some((e) => e.type === 'giveMoney')).toBe(true);
    });
  });
  it('le maître est aussi marchand (interlude entre vagues)', () => {
    expect(master.merchant?.archetype).toBeTruthy();
  });
});
