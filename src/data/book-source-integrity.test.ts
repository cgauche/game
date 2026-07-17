/**
 * Garde d'INTÉGRITÉ de la relation-livre : tout `source.book` porté par une entrée de `src/data/*.json`
 * doit être l'`id` STABLE d'un livre de `books.json` — jamais un libellé ni une abréviation libre.
 * Relation id-pure (i18n-safe) : `books.json` devient la SOURCE DE VÉRITÉ enforced des réfs de livre.
 * Scan file-based de `src/data` (exhaustif, comme `serialize.test.ts`), `src/data` SEUL (pas les worktrees).
 *
 * Volet 2 (#536) — INTÉGRITÉ DU FOLIO : le `book` juste ne prouve pas la `page` juste. La `desc`
 * étant un copié/collé verbatim (règle stricte 5), elle localise l'entrée dans le `Source/` du livre
 * déclaré ; l'encadrement `data-folio` de l'occurrence réfute alors le folio qui ment. Mécanique
 * dans `scripts/guards/lib/folioIntegrity.mjs`, stock gelé dans `folioRatchetStock.mjs`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { books } from './index';
import { auditFolios } from '../../scripts/guards/lib/folioIntegrity.mjs';
import { FOLIO_RATCHET } from '../../scripts/guards/lib/folioRatchetStock.mjs';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const BOOK_IDS = new Set(books.map((b) => b.id));

function collectBooks(o: unknown, acc: Set<string>): void {
  if (o == null || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (const x of o) collectBooks(x, acc); return; }
  const rec = o as Record<string, unknown>;
  if (typeof rec.book === 'string') acc.add(rec.book);
  for (const v of Object.values(rec)) collectBooks(v, acc);
}

describe('relation-livre id-pure — tout source.book est un id de books.json', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'books.json');
  for (const f of files) {
    it(`${f} : source.book ∈ ids de livres`, () => {
      const found = new Set<string>();
      collectBooks(JSON.parse(readFileSync(join(DIR, f), 'utf8')), found);
      expect([...found].filter((b) => !BOOK_IDS.has(b))).toEqual([]);
    });
  }
  it('books.json : ids uniques et non vides', () => {
    const ids = books.map((b) => b.id);
    expect(ids.every((x) => !!x)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/**
 * Plafond du stock cliqueté. Il vit ICI, dans la garde, et NON dans le fichier de stock : sans lui,
 * « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court pour
 * « solder » une régression restait d'ajouter une ligne au stock, CI verte (précédent `reconcile` :
 * 157 dettes affichées, CI verte). Le relever est un geste délibéré, visible en revue — l'inverse
 * d'un append discret. Il ne DESCEND qu'en soldant des folios au Source.
 */
const FOLIO_RATCHET_MAX = 140;

describe('intégrité du folio — source.page pointe sur la page qui porte la desc (#536)', () => {
  const { violations } = auditFolios(DIR);
  const found = new Set(violations.map((v) => v.key));

  it('aucune entrée NEUVE ne déclare un folio réfuté par son Source', () => {
    const nouvelles = violations.filter((v) => !FOLIO_RATCHET.has(v.key));
    expect(
      nouvelles.map((v) => {
        if (v.voie === 'hors-livre') {
          return `${v.key} (${v.book}) déclare p.${v.page}, or le livre s’arrête au folio ${v.max}`;
        }
        const reel = v.ranges
          .map((r) => (r.hi === null ? `${r.lo}+` : r.lo === r.hi ? `${r.lo}` : `${r.lo}-${r.hi}`))
          .join(',');
        return `${v.key} (${v.book}) déclare p.${v.page}, desc trouvée en folio ${reel}`;
      }),
    ).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune clé soldée n’y traîne', () => {
    expect([...FOLIO_RATCHET].filter((k) => !found.has(k))).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par la garde', () => {
    expect(FOLIO_RATCHET.size).toBeLessThanOrEqual(FOLIO_RATCHET_MAX);
  });
});
