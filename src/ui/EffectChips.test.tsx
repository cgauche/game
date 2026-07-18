import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ActiveEffect, ConditionInstance } from '../engine/types';
import { chipCodex, chipDetail, summarizeEffects, type EffectFlags, type FlagId } from '../gameIso/effectIcons';
import { psychologies, regles } from '../data';
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

  it('un buff sans sort source porte tout de même un popover de secours', () => {
    const ref = chipCodex(summarizeEffects([], [buff()]).visible[0]);
    expect(ref.id).toBeUndefined();
    expect(ref.fallback).toBeDefined(); // CodexRef rend un popover dès qu'un fallback est fourni
  });

  /** TOUS les états-drapeaux : chacun est adossé à une règle citable, donc chacun ouvre SA fiche —
   *  une pastille sans règle derrière elle remet en cause son existence (arbitrage user 2026-07-18). */
  const FLAG_CASES: [FlagId, EffectFlags, string, string][] = [
    ['frenzied', { frenzied: true }, 'psychologies', 'frenesie'],
    ['fear', { fear: 2 }, 'psychologies', 'peur'],
    ['focusDr', { focusDr: 3 }, 'regles', 'focalisation-etendue'],
    ['defensiveStance', { defensiveStance: true }, 'regles', 'sur-la-defensive'],
    ['hunger', { hunger: { days: 2, failures: 1 } }, 'regles', 'faim-et-soif'],
    ['aiming', { aiming: true }, 'regles', 'viser'],
  ];

  it.each(FLAG_CASES)('le drapeau %s ouvre SA fiche catalogue, routée par id stable', (flagId, flags, category, id) => {
    const chip = summarizeEffects([], [], Infinity, flags).visible[0];
    expect(chip.flagId).toBe(flagId); // identité STABLE, jamais le libellé
    const ref = chipCodex(chip);
    expect(ref).toMatchObject({ category, id });
    expect(ref.fallback).toBeDefined(); // aucune pastille muette, même routée
  });

  it('chaque cible de drapeau EXISTE au catalogue (le routage ne pointe pas dans le vide)', () => {
    for (const [, flags] of FLAG_CASES) {
      const ref = chipCodex(summarizeEffects([], [], Infinity, flags).visible[0]);
      const catalogue = ref.category === 'psychologies' ? psychologies : regles;
      expect(catalogue.map((e) => e.id)).toContain(ref.id);
    }
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

  it('la pastille COMPACTE abrège la durée en « N R » — même unité Round, jamais un « t » de tour', () => {
    const html = renderToStaticMarkup(<EffectChips effects={[buff()]} />);
    expect(html).toContain('<em>3 R</em>');
    expect(html).not.toMatch(/>\s*3\s*t\s*</);
  });

  it('le popover de la pastille garde la forme LONGUE (il a la place)', () => {
    expect(chipDetail(summarizeEffects([], [buff()]).visible[0])).toContain('3 Rounds restants');
  });
});
