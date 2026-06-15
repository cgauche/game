import { describe, it, expect } from 'vitest';
import { harvestProfileFor, harvestSizeOf, harvestYield, costPerEnc } from './harvest';
import { formatMoney } from './money';

describe('harvest — Précieuses Entrailles (ZI)', () => {
  it('profil porté par la créature (creatures.json), coût = rareté × dangerosité', () => {
    const p = harvestProfileFor('Cockatrice')!; // Exotique, Menaçante
    expect(p.rarity).toBe('Exotique');
    expect(p.danger).toBe('Menaçante');
    expect(formatMoney(costPerEnc(p))).toBe('6 CO');
  });

  it('exemple du livre : cockatrice Grande → 4 Enc, 24 CO (Conservé), 3 CO (Pourri)', () => {
    const p = harvestProfileFor('Cockatrice')!;
    const conserve = harvestYield(p, 'Grande', 0, 'Conservé');
    expect(conserve.enc).toBe(4);
    expect(formatMoney(conserve.total)).toBe('24 CO');
    expect(formatMoney(harvestYield(p, 'Grande', 0, 'Pourri').total)).toBe('3 CO'); // 1/8, Exotique
  });

  it('Frais double le prix standard', () => {
    const p = harvestProfileFor('Cockatrice')!;
    expect(formatMoney(harvestYield(p, 'Grande', 0, 'Frais').total)).toBe('48 CO');
  });

  it('chaque DR d’échec au Savoir retire un cran de quantité', () => {
    const p = harvestProfileFor('Cockatrice')!;
    expect(harvestYield(p, 'Grande', 0, 'Conservé').enc).toBe(4); // Grande
    expect(harvestYield(p, 'Grande', -1, 'Conservé').enc).toBe(2); // → Moyenne
    expect(harvestYield(p, 'Grande', -2, 'Conservé').enc).toBe(1); // → Inf. Moyenne
    expect(harvestYield(p, 'Grande', -5, 'Conservé').enc).toBe(1); // plancher
  });

  it('Pourri : les pièces non Exotiques/Uniques ne valent plus rien', () => {
    const troll = harvestProfileFor('Troll des Rivières')!; // Rare
    expect(formatMoney(harvestYield(troll, 'Grande', 0, 'Pourri').total)).toBe('0 sc');
    const dragon = harvestProfileFor('Dragon de la Forêt')!; // Exotique
    expect(harvestYield(dragon, 'Énorme', 0, 'Pourri').total.gold).toBeGreaterThan(0);
  });

  it('Taille de récolte dérivée du Trait Taille', () => {
    expect(harvestSizeOf({ traits: ['Taille (Monstrueuse)'] })).toBe('Monstrueuse');
    expect(harvestSizeOf({ traits: ['Taille (Petite)'] })).toBe('InfMoyenne');
    expect(harvestSizeOf({ traits: ['Bestial', 'Vol 80'] })).toBe('Moyenne'); // défaut
  });
});
