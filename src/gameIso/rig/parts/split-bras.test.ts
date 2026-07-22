import { describe, it, expect } from 'vitest';
import { splitBrasSvg, ELBOW_Y, ELBOW_OVERLAP } from './derive';

// Contrat POSITIF de la scission du bras au coude (#633 D1) : haut clippé dans le repère épaule,
// bas rebasé (translate -ELBOW_Y) puis clippé dans le repère avant-bras.
describe('splitBrasSvg — scission du bras au coude', () => {
  const SVG = '<path d="M-4 -2 L4 -2 L4 34 L-4 34 Z" fill="@vet1"/>';

  it('constantes de contrat du squelette', () => {
    expect(ELBOW_Y).toBe(18);
    expect(ELBOW_OVERLAP).toBe(2);
  });

  it('haut = fragment enrobé dans le clip rigCutBrasHaut, repère épaule inchangé', () => {
    const { haut } = splitBrasSvg(SVG);
    expect(haut).toBe(`<g clip-path="url(#rigCutBrasHaut)">${SVG}</g>`);
    expect(haut).toContain('clip-path="url(#rigCutBrasHaut)"');
    expect(haut).not.toContain('translate'); // haut reste dans le repère épaule
  });

  it('bas = translate(0,-18) + clip rigCutBrasBas, contient le svg d’origine', () => {
    const { bas } = splitBrasSvg(SVG);
    expect(bas).toContain(`translate(0,${-ELBOW_Y})`);
    expect(bas).toContain('translate(0,-18)');
    expect(bas).toContain('clip-path="url(#rigCutBrasBas)"');
    expect(bas).toContain(SVG);
    // le translate ENROBE le clip (rebasage APRÈS clip dans le repère de l'art)
    expect(bas.indexOf('translate')).toBeLessThan(bas.indexOf('clip-path'));
  });

  it('svg vide/absent → aucun enrobage', () => {
    expect(splitBrasSvg('')).toEqual({ haut: '', bas: '' });
    // @ts-expect-error — robustesse à un art absent
    expect(splitBrasSvg(undefined)).toEqual({ haut: '', bas: '' });
  });

  it('idempotence de la source : le svg d’entrée est inclus tel quel, non muté', () => {
    const before = SVG;
    const { haut, bas } = splitBrasSvg(SVG);
    expect(SVG).toBe(before); // string immuable
    expect(haut).toContain(SVG);
    expect(bas).toContain(SVG);
  });

  it('art court (y<=10) : le bas est structurellement clippé à ≥16 (aucun contenu visible en lot 4)', () => {
    // au niveau string on vérifie la STRUCTURE : même un art qui ne descend pas au coude passe par
    // le clip rigCutBrasBas (rect y=16..46) → visuellement vide, mais l'enrobage reste bien formé.
    const court = '<path d="M-4 -2 L4 -2 L4 10 L-4 10 Z" fill="@peau"/>';
    const { bas } = splitBrasSvg(court);
    expect(bas).toContain('clip-path="url(#rigCutBrasBas)"');
    expect(bas).toContain(court);
  });
});
