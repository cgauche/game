import { describe, it, expect } from 'vitest';
import { scenario } from './09-incantation-hors-combat';
import { findSpell } from '../../data';
import { knowsCastingSkill, isArcaneSpell, isMagicMissile, castInfo } from '../../engine/magic';

/** Le scénario doit être JOUABLE hors combat : les lanceurs maîtrisent réellement leur Compétence
 *  (sinon les boutons « Lancer/Focaliser » échoueraient sur « ne maîtrise pas »), et le groupe offre
 *  bien les 3 cas (sort d'Arcane focalisable, bénédiction de soin, Projectile magique combat-only). */
describe('Scénario Magie hors combat', () => {
  const party = scenario.makeParty();
  const wiz = party.find((h) => h.name.startsWith('Wilhelmina'))!;
  const priest = party.find((h) => h.name.startsWith('Frère Anselm'))!;

  it('est un scénario d’EXPLORATION (pas d’autoCombat)', () => {
    expect(scenario.autoCombat).toBeUndefined();
    expect(party.every((h) => h.kind === 'hero')).toBe(true);
  });

  it('le Sorcier maîtrise l’incantation et la Focalisation, et connaît un Sort d’Arcane focalisable', () => {
    expect(knowsCastingSkill(wiz, 'Langue', 'Magick')).toBe(true);
    expect(knowsCastingSkill(wiz, 'Focalisation')).toBe(true);
    const arme = findSpell('Armure Aethyrique')!;
    expect(wiz.spells).toContain('Armure Aethyrique');
    expect(isArcaneSpell(arme)).toBe(true); // → bouton « ✨ Focaliser »
    expect(isMagicMissile(arme)).toBe(false); // non offensif → lançable hors combat
  });

  it('le Prêtre maîtrise la Prière et porte une Bénédiction de soin (effet modélisé)', () => {
    const heal = findSpell('Bénédiction de Guérison')!;
    expect(castInfo(heal).skill).toBe('Prière');
    expect(knowsCastingSkill(priest, 'Prière')).toBe(true);
    expect(priest.spells).toContain('benediction-de-guerison'); // runtime = id de sort
    expect(isMagicMissile(heal)).toBe(false);
  });

  it('un allié est blessé (cible visible pour la Guérison) et un Projectile magique reste combat-only', () => {
    expect(wiz.wounds.current).toBeLessThan(wiz.wounds.max);
    expect(isMagicMissile(findSpell('Fléchette')!)).toBe(true); // affiché « en combat » sur la fiche
  });
});
