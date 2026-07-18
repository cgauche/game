import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveEffect, ConditionInstance } from '../engine/types';
import { chipCodex, chipDetail, summarizeEffects } from '../gameIso/effectIcons';
import { EffectChips } from './EffectChips';

const cond = (name: string, value = 1): ConditionInstance => ({ name, value } as ConditionInstance);
const buff = (over: Partial<ActiveEffect> = {}): ActiveEffect => ({
  label: 'Bénédiction du courage',
  bonus: 10,
  char: 'capacite-de-combat',
  duration: { scale: 'rounds', left: 3 },
  ...over,
} as ActiveEffect);

describe('chipCodex — routage d’information UNIQUE de la famille des pastilles', () => {
  it('un État route vers le catalogue États par son id STABLE', () => {
    const chip = summarizeEffects([cond('assourdi')], []).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category: 'etats', id: 'assourdi' });
  });

  it('un buff route vers SON sort source (Codex Sorts) quand il est résolvable', () => {
    const chip = summarizeEffects([], [buff({ sourceSpellId: 'benediction-du-courage' })]).visible[0];
    expect(chipCodex(chip)).toMatchObject({ category: 'spells', id: 'benediction-du-courage' });
  });

  it('une pastille hors catalogue (drapeau, buff sans sort source) porte tout de même un popover de secours', () => {
    const flag = summarizeEffects([], [], Infinity, { aiming: true }).visible[0];
    const ref = chipCodex(flag);
    expect(ref.id).toBeUndefined();
    expect(ref.fallback).toBeDefined(); // CodexRef rend un popover dès qu'un fallback est fourni
    expect(ref.label).toContain('En joue');
  });

  it('le détail paramétré porte bonus (carac en clair), Rounds restants et empilement', () => {
    const b = summarizeEffects([], [buff()]).visible[0];
    expect(chipDetail(b)).toBe('+10 Capacité de Combat · 3 Rounds restants');
    const c = summarizeEffects([cond('hemorragique', 3)], []).visible[0];
    expect(chipDetail(c)).toBe('×3');
  });

  it('le libellé paramétré coiffe le libellé catalogue (instance du popover)', () => {
    const b = summarizeEffects([], [buff()]).visible[0];
    expect(chipCodex(b).instance).toBe('Bénédiction du courage — +10 Capacité de Combat · 3 Rounds restants');
  });
});

describe('EffectChips', () => {
  it('toute pastille — État, buff, drapeau — expose le mécanisme Codex (jamais une infobulle native)', () => {
    const html = renderToStaticMarkup(
      <EffectChips conditions={[cond('assourdi')]} effects={[buff()]} flags={{ aiming: true }} />,
    );
    expect(html).not.toContain('title=');
    expect((html.match(/codex-ref/g) ?? []).length).toBe(3); // 1 État + 1 drapeau + 1 buff
  });

  it('la durée d’un buff est rendue en ROUNDS (vocabulaire canon), jamais en tours', () => {
    const html = renderToStaticMarkup(<EffectChips effects={[buff()]} />);
    expect(html).toContain('3 Rounds');
    expect(html).not.toMatch(/>3t</);
  });
});
