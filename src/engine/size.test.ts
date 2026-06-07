import { describe, it, expect } from 'vitest';
import { SIZE_ORDER, SIZE_RANGED_MOD, effectiveSize, sizeGap, parseSizeLabel } from './size';

describe('size — modèle de Taille (LDB 85 l.279-280 ; 14 l.151-170)', () => {
  it('ordonne les 7 catégories 0..6', () => {
    expect(SIZE_ORDER.minuscule).toBe(0);
    expect(SIZE_ORDER.moyenne).toBe(3);
    expect(SIZE_ORDER.monstrueuse).toBe(6);
  });
  it("mod d'à-toucher au tir : -30 (Minuscule) .. +60 (Monstrueuse)", () => {
    expect(SIZE_RANGED_MOD.minuscule).toBe(-30);
    expect(SIZE_RANGED_MOD.moyenne).toBe(0);
    expect(SIZE_RANGED_MOD.grande).toBe(20);
    expect(SIZE_RANGED_MOD.monstrueuse).toBe(60);
  });
  it('Taille effective par défaut = Moyenne (standard implicite, LDB 14 l.163)', () => {
    expect(effectiveSize(undefined)).toBe('moyenne');
    expect(effectiveSize('grande')).toBe('grande');
  });
  it("sizeGap > 0 si l'attaquant est plus grand", () => {
    expect(sizeGap('grande', 'moyenne')).toBe(1);
    expect(sizeGap('moyenne', 'enorme')).toBe(-2);
    expect(sizeGap(undefined, undefined)).toBe(0);
  });
  it('parseSizeLabel — catégories simples (accents/casse insensibles)', () => {
    expect(parseSizeLabel('Énorme')).toBe('enorme');
    expect(parseSizeLabel('tres petite')).toBe('tresPetite');
    expect(parseSizeLabel('Très Petite')).toBe('tresPetite');
    expect(parseSizeLabel('inconnu')).toBeNull();
  });
  it('parseSizeLabel — plages narratives → borne HAUTE (design documenté)', () => {
    expect(parseSizeLabel('de Petite à Énorme')).toBe('enorme');
    expect(parseSizeLabel('Minuscule-Énorme')).toBe('enorme');
    expect(parseSizeLabel('de Petite à Moyenne')).toBe('moyenne');
    expect(parseSizeLabel('Énorme-Monstrueuse')).toBe('monstrueuse');
  });
});
