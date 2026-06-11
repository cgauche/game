import { describe, it, expect } from 'vitest';
import { classifyEnemy } from './rig/enemyProfile';
import { creatureSpeciesScale, bipedSpeciesScale } from './rig/creatures';
import { sizeTokenScale } from './sizeScale';
import { parseSizeLabel, type SizeCategory } from '../engine/size';
import { creatures } from '../data/index';

/** Taille du statbloc (trait « Taille (X) », plage → borne haute), défaut Moyenne. */
function sizeOf(traits: string[] | undefined): SizeCategory {
  for (const t of traits ?? []) {
    const m = t.match(/^Taille\s*\(([^)]+)\)/i);
    if (m) { const s = parseSizeLabel(m[1]); if (s) return s; }
  }
  return 'moyenne';
}
const artScale = (label: string): number =>
  classifyEnemy(label) === 'rig' ? bipedSpeciesScale(label) : creatureSpeciesScale(label);

// GARDE-FOU de la toise (décision utilisateur 2026-06-11) : l'art d'un modèle est dessiné à la
// baseline MOYENNE — son échelle (sl / race.scale / perso.scale) n'exprime que la NUANCE
// intra-catégorie ; c'est la catégorie de Taille (sizeTokenScale) qui agrandit. Avant ce
// recalibrage, le Géant cumulait les deux (art 2.4 × Énorme 2.6 = rendu ×6.2 d'un humain).
describe('toise — échelles de rendu (art = nuance intra-catégorie, la Taille agrandit)', () => {
  it("aucune créature du bestiaire n'exprime sa catégorie via l'échelle d'art (bande 0.5-1.35)", () => {
    for (const c of creatures) {
      const art = artScale(c.label);
      expect(art, `${c.label} (art ${art})`).toBeGreaterThanOrEqual(0.5);
      expect(art, `${c.label} (art ${art})`).toBeLessThanOrEqual(1.35);
    }
  });

  it('échelle finale plafonnée par catégorie (art × Taille ≤ Taille × 1.35)', () => {
    for (const c of creatures) {
      const size = sizeOf(c.traits);
      const fin = artScale(c.label) * sizeTokenScale(size);
      expect(fin, `${c.label} (${size}, final ×${fin.toFixed(2)})`).toBeLessThanOrEqual(sizeTokenScale(size) * 1.35);
    }
  });

  it('ancrages : un cheval (Grande) ~×1.3 humain, un Géant (Énorme) ~×2.4 — plus de ×3/×6', () => {
    expect(creatureSpeciesScale('Cheval de selle') * sizeTokenScale('grande')).toBeLessThanOrEqual(1.5);
    expect(bipedSpeciesScale('Géant') * sizeTokenScale('enorme')).toBeLessThanOrEqual(2.6);
    expect(creatureSpeciesScale('Dragon') * sizeTokenScale('enorme')).toBeLessThanOrEqual(2.6);
  });

  it('la nuance intra-catégorie reste respectée (loup < cheval ; catégorie inchangée)', () => {
    expect(creatureSpeciesScale('Loup')).toBeLessThan(creatureSpeciesScale('Cheval'));
  });
});
