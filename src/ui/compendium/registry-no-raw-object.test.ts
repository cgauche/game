import { describe, it, expect } from 'vitest';
import { CODEX } from './registry';

/**
 * Garde-fou anti-régression de la classe de bug « [object Object] » au Codex.
 *
 * `fact(label, value)` fait `String(value)` (registry.ts:118) : un champ STRUCTURÉ (SpellRange,
 * ManeuverMeasure, WeaponDamageSpec, WeaponRangeSpec…) passé BRUT à `fact()` est stringifié en
 * « [object Object] » à l'écran. Ce test matérialise TOUT le Codex (CODEX est construit au chargement)
 * et échoue si un meta contient cette chaîne. Il a attrapé les sorts (Portée/Cible/Durée) et les
 * manœuvres (Portée). Tout nouveau champ objet DOIT passer par un formateur (formatSpellRange,
 * formatManeuverMeasure, damageString, rangeSpecLabel…) avant `fact()`.
 */
describe('Codex — aucun champ structuré rendu brut', () => {
  it('aucun meta ne produit « [object Object] »', () => {
    const offenders: string[] = [];
    for (const cat of CODEX) {
      for (const item of cat.items) {
        for (const f of item.meta ?? []) {
          if (f.value.includes('[object Object]')) offenders.push(`${cat.label} › ${item.label} › ${f.label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
