import { describe, it, expect } from 'vitest';
import { scenario } from './12-arene';
import { condMet } from '../../state/scene';

/** Vérifie que le gauntlet (100 % données) séquence ses 10 vagues par flags, et que les mécaniques
 *  d'interlude (butin magique non identifié, Repos payant, Chance par paliers) sont correctement câblées. */
describe('Arène — gauntlet 10 vagues (#3, 100 % données)', () => {
  const master = scenario.scene.entities.find((e) => e.id === 'maitre')!;
  const dlg = scenario.scene.dialogues.find((d) => d.id === master.dialogueId)!;
  const node = dlg.nodes.find((n) => n.id === dlg.start)!;
  const launchable = (flags: Record<string, boolean>): string[] =>
    node.choices
      .filter((c) => !c.condition || condMet(c.condition, flags))
      .flatMap((c) => (c.effects ?? []).filter((e) => e.type === 'startCombat').map((e) => (e as { encounter: string }).encounter));
  const upTo = (n: number): Record<string, boolean> => Object.fromEntries(Array.from({ length: n }, (_, k) => [`arene_v${k + 1}`, true]));

  it('compte 10 vagues', () => {
    expect(scenario.scene.encounters).toHaveLength(10);
  });
  it('séquence stricte : départ → wave-1, après 5 → wave-6, tout fini → rien', () => {
    expect(launchable({})).toEqual(['wave-1']);
    expect(launchable(upTo(5))).toEqual(['wave-6']);
    expect(launchable(upTo(10))).toEqual([]);
  });
  it('chaque vague : flag de progression + or + PX dans onVictory', () => {
    scenario.scene.encounters.forEach((enc, i) => {
      const eff = enc.onVictory ?? [];
      expect(eff.some((e) => e.type === 'setFlag' && (e as { flag: string }).flag === `arene_v${i + 1}`)).toBe(true);
      expect(eff.some((e) => e.type === 'giveMoney')).toBe(true);
      expect(eff.some((e) => e.type === 'giveXp')).toBe(true);
    });
  });
  it('butin MAGIQUE non identifié aux paliers 4 (Dévastatrice) et 9 (De plaies atroces + skin)', () => {
    const w4 = (scenario.scene.encounters[3].onVictory ?? []).find((e) => e.type === 'giveTrapping') as { qualities?: string[]; identified?: boolean } | undefined;
    expect(w4?.identified).toBe(false);
    expect(w4?.qualities).toContain('Dévastatrice');
    const w9 = (scenario.scene.encounters[8].onVictory ?? []).find((e) => e.type === 'giveTrapping') as { qualities?: string[]; identified?: boolean; skin?: object } | undefined;
    expect(w9?.identified).toBe(false);
    expect(w9?.qualities).toContain('De plaies atroces');
    expect(w9?.skin).toBeTruthy();
  });
  it('Chance redevient méditable tous les 3 paliers (waves 3/6/9 posent chance_dispo)', () => {
    [2, 5, 8].forEach((i) => {
      expect((scenario.scene.encounters[i].onVictory ?? []).some((e) => e.type === 'setFlag' && (e as { flag: string }).flag === 'chance_dispo')).toBe(true);
    });
  });
  it('le Repos est une option de dialogue PAYANTE (auberge, RAW LDB 66)', () => {
    const rest = node.choices.find((c) => (c.effects ?? []).some((e) => e.type === 'rest'));
    expect(rest).toBeTruthy();
    expect(rest!.cost).toBeTruthy(); // gratuit chez soi, payant à l'auberge
  });
});
