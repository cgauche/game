import { describe, it, expect } from 'vitest';
import { resolveById, resolveSpecies } from './rig/bodyPlan';
import { sizeTokenScale } from './sizeScale';
import { parseSizeLabel, type SizeCategory } from '../engine/size';
import { creatures } from '../data/index';
import type { TraitList } from '../engine/statEntry';

/** Taille du statbloc (trait « Taille (X) », plage → borne haute), défaut Moyenne. */
function sizeOf(traits: TraitList | undefined): SizeCategory {
  for (const t of traits ?? []) {
    if (t.id === 'taille' && t.arg) { const s = parseSizeLabel(t.arg); if (s) return s; }
  }
  return 'moyenne';
}
const artScale = (id: string): number => resolveById(id).scale;

// GARDE-FOU de la toise (décision utilisateur 2026-06-11) : l'art d'un modèle est dessiné à la
// baseline MOYENNE — son échelle (sl / race.scale / perso.scale) n'exprime que la NUANCE
// intra-catégorie ; c'est la catégorie de Taille (sizeTokenScale) qui agrandit. Avant ce
// recalibrage, le Géant cumulait les deux (art 2.4 × Énorme 2.6 = rendu ×6.2 d'un humain).
describe('toise — échelles de rendu (art = nuance intra-catégorie, la Taille agrandit)', () => {
  it("aucune créature du bestiaire n'exprime sa catégorie via l'échelle d'art (bande 0.5-1.35)", () => {
    for (const c of creatures) {
      const art = artScale(c.id);
      expect(art, `${c.label} (art ${art})`).toBeGreaterThanOrEqual(0.5);
      expect(art, `${c.label} (art ${art})`).toBeLessThanOrEqual(1.35);
    }
  });

  it('échelle finale plafonnée par catégorie (art × Taille ≤ Taille × 1.35)', () => {
    for (const c of creatures) {
      const size = sizeOf(c.traits);
      const fin = artScale(c.id) * sizeTokenScale(size);
      expect(fin, `${c.label} (${size}, final ×${fin.toFixed(2)})`).toBeLessThanOrEqual(sizeTokenScale(size) * 1.35);
    }
  });

  it('ancrages : un cheval (Grande) ~×1.3 humain, un Géant (Énorme) ~×2.4 — plus de ×3/×6', () => {
    expect(resolveSpecies('cheval').scale * sizeTokenScale('grande')).toBeLessThanOrEqual(1.5);
    expect(resolveSpecies('geant').scale * sizeTokenScale('enorme')).toBeLessThanOrEqual(2.6);
    expect(resolveSpecies('dragon').scale * sizeTokenScale('enorme')).toBeLessThanOrEqual(2.6);
  });

  it('la nuance intra-catégorie reste respectée (loup < cheval ; catégorie inchangée)', () => {
    expect(resolveSpecies('loup').scale).toBeLessThan(resolveSpecies('cheval').scale);
  });
});
