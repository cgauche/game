/**
 * OPTIONNELS COMPOSÉS (LDB 76, #174) — vocabulaire « swap » (remplacer des Traits par un bonus) et
 * joker « tous les traits ». Vérifie (1) que le picker/Codex les AFFICHE (libellé source verbatim,
 * jamais « undefined »), et (2) que l'APPLICATION au spawn retire bien les Traits nommés et octroie le
 * bonus de caractéristique (Grand Loup ZI p.16 : +15 Soc ; Griffon ZI : +20 Soc).
 */
import { describe, it, expect } from 'vitest';
import { findCreatureById } from '../data';
import { creatureToCombatant } from './spawn';
import { hasTraitKey, optionalLabels } from '../engine/traits/dispatch';
import { isOptionalNote, type OptionalSwap } from '../engine/statEntry';

const at = { x: 0, y: 0 };

describe('optionals composés — affichage (picker/Codex) sans « undefined »', () => {
  it('Mutant : joker « Tous les traits » affiché VERBATIM', () => {
    const c = findCreatureById('mutant')!;
    const labels = optionalLabels(c.optionals);
    expect(labels).toContain('Tous les traits');
    expect(labels.some((l) => /undefined/.test(l))).toBe(false);
  });

  it('Grand Loup / Griffon : la variante « swap » affiche sa note source, pas « undefined »', () => {
    for (const [id, expected] of [
      ['grand-loup', 'Taille (Grande) ; remplacer Bestial, Dressé et Territorial par un bonus de +15 en Soc'],
      ['griffon-zoo-imperial', 'Remplacer Bestial par un bonus de +20 en Soc'],
    ] as const) {
      const labels = optionalLabels(findCreatureById(id)!.optionals);
      expect(labels).toContain(expected);
      expect(labels.some((l) => /undefined/.test(l))).toBe(false);
    }
  });
});

describe('optionals composés — application au spawn (moteur)', () => {
  it('Grand Loup : la variante retire Bestial/Territorial, octroie +15 Soc et applique Taille (Grande)', () => {
    const c = findCreatureById('grand-loup')!;
    const swap = c.optionals.find((o): o is OptionalSwap => isOptionalNote(o) && o.note === 'swap')!;
    const wolf = creatureToCombatant(c, 'w1', at, { optionals: [swap] });
    expect(hasTraitKey(wolf.traits, 'bestial')).toBe(false);
    expect(hasTraitKey(wolf.traits, 'territorial')).toBe(false);
    expect(wolf.characteristics.Soc).toBe(15); // Soc « – » (0) + 15
    expect(wolf.size).toBe('grande');
    // Sans la variante : Bestial reste et Soc demeure inexistante (0).
    const plain = creatureToCombatant(c, 'w0', at);
    expect(hasTraitKey(plain.traits, 'bestial')).toBe(true);
    expect(plain.characteristics.Soc).toBe(0);
  });

  it('Griffon : la variante retire Bestial et octroie +20 Soc (Taille inchangée)', () => {
    const c = findCreatureById('griffon-zoo-imperial')!;
    const swap = c.optionals.find((o): o is OptionalSwap => isOptionalNote(o) && o.note === 'swap')!;
    const g = creatureToCombatant(c, 'g1', at, { optionals: [swap] });
    expect(hasTraitKey(g.traits, 'bestial')).toBe(false);
    expect(g.characteristics.Soc).toBe(20); // Soc « – » (0) + 20
    expect(g.size).toBe('enorme'); // Trait Taille (Énorme) conservé
  });

  it('Mutant : le joker « tous les traits » n’a AUCUN effet mécanique au spawn (indication picker)', () => {
    const c = findCreatureById('mutant')!;
    const wildcard = c.optionals.find(isOptionalNote)!;
    const m = creatureToCombatant(c, 'm1', at, { optionals: [wildcard] });
    expect((m.traits ?? []).length).toBe(c.traits.length); // aucune fusion, aucun retrait
  });
});
