import { describe, it, expect } from 'vitest';
import { gods, CULT_KEYS, blessingsOf, miraclesOf, findGodById } from './index';

/** Invariants STRUCTURELS du dataset (pas de longueurs figées : la donnée est éditable au Codex).
 *  Deux familles d'entrées : cultes À PRIÈRES (LDB 41-42 + NADJ — six Bénédictions chacun) et fiches
 *  de SAVEUR (dieux nains/elfes/halflings LDB 36-39, provinciaux LDB 24, Puissances de la Ruine) —
 *  « sans Bénédictions ni Miracles » (LDB 37 l.17 ; LDB 36 l.9). */
describe('Cultes (dataset gods.json, façade data, éditable au Codex)', () => {
  it('clés uniques, desc non vide, source présente', () => {
    expect(new Set(gods.map((g) => g.key)).size).toBe(gods.length);
    for (const g of gods) {
      expect(g.desc, g.key).toBeTruthy();
      expect(g.source?.book, g.key).toBeTruthy();
      expect(g.source?.page, g.key).toBeGreaterThan(0);
    }
  });
  it('cultes à Miracles = cultes à prières : six Bénédictions chacun (LDB 41 « reçoit les SIX »)', () => {
    for (const g of gods.filter((x) => x.miracles.length > 0)) expect(g.blessings, g.key).toHaveLength(6);
  });
  it('fiches de saveur : 0 Bénédiction ET 0 Miracle (LDB 37 l.17 / 36 l.9) — et il en existe', () => {
    const flavor = gods.filter((g) => g.blessings.length === 0);
    expect(flavor.length).toBeGreaterThan(0);
    for (const g of flavor) expect(g.miracles, g.key).toHaveLength(0);
  });
  it('CULT_KEYS = cultes à Bénédictions SEULEMENT (choix « Béni (Au choix) » dérivé de la donnée)', () => {
    expect(CULT_KEYS).toEqual(gods.filter((g) => g.blessings.length > 0).map((g) => g.key).sort());
    expect(CULT_KEYS).toContain('Sigmar');
    expect(CULT_KEYS).toContain('Evawn'); // NADJ : dieux gnomes à prières
    expect(CULT_KEYS).not.toContain('Khorne'); // Puissance de la Ruine = saveur
    expect(CULT_KEYS).not.toContain('Grungni'); // dieu ancêtre nain = saveur
  });
  it('blessingsOf/miraclesOf = IDS de sort (le runtime compare par id) ; culte inconnu → []', () => {
    expect(blessingsOf('Sigmar')).toContain('benediction-de-protection');
    expect(miraclesOf('Sigmar')).toContain('marteau-ardent-de-sigmar'); // LDB : sort d'Invocation (id)
    expect(miraclesOf('Evawn')).toContain('invitation'); // NADJ : colonne god (id)
    expect(blessingsOf('Khaine')).toEqual([]); // fiche de saveur : culte CONNU, 0 Bénédiction
    expect(blessingsOf('Inexistant-xyz')).toEqual([]);
    expect(findGodById('Sigmar')?.title).toBeTruthy();
  });
});
