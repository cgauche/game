/**
 * Cliquet décroissant de la dette de doc MANUSCRITE (#903 — toute la documentation est GÉNÉRÉE
 * depuis le code, jamais écrite à la main). Ce lot ne génère rien : il fige la liste des docs
 * encore manuscrits (`manualDocsStock.mjs`) pour qu'un document manuscrit NEUF échoue la CI.
 *
 * Périmètre — `docs/*.md` À PLAT (hors sous-dossiers, `docs/plans/` et `docs/raw/` compris),
 * même frontière que `scripts/docs/check-doc-refs.mjs` (`readdirSync(DOCS_DIR)` non récursif).
 * Détection GÉNÉRÉ — marqueur `GÉNÉRÉ par` en tête de ligne dans les 10 premières lignes du doc ;
 * les deux formes mesurées dans le dépôt sont couvertes : « ⚠️ Fichier GÉNÉRÉ par … » et
 * « GÉNÉRÉ par `npx tsx …` ».
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MANUAL_DOCS_STOCK } from '../../scripts/guards/lib/manualDocsStock.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DOCS_DIR = join(ROOT, 'docs');

const GENERATED_MARKER = /^>\s*(?:⚠️\s*)?(?:Fichier\s+)?GÉNÉRÉ par\b/m;

function isGenerated(text: string): boolean {
  const head = text.split('\n').slice(0, 10).join('\n');
  return GENERATED_MARKER.test(head);
}

function manualDocs(): string[] {
  return readdirSync(DOCS_DIR)
    .filter((f) => f.endsWith('.md'))
    .filter((f) => !isGenerated(readFileSync(join(DOCS_DIR, f), 'utf8')))
    .map((f) => `docs/${f}`);
}

/**
 * Plafond du stock cliqueté. Il vit ICI, dans le test, et NON dans `manualDocsStock.mjs` — sans
 * lui, « le stock ne peut que décroître » n'était qu'un commentaire, et le chemin le plus court
 * pour « solder » un doc manuscrit neuf restait d'ajouter une ligne au stock, CI verte. Toute
 * hausse de ce chiffre modifie CE fichier de test, jamais `manualDocsStock.mjs` seul. Il ne
 * DESCEND qu'en soldant des docs (génération ou suppression), jamais en ajoutant une entrée.
 */
const MANUAL_DOCS_MAX = 22;

describe('cliquet des docs manuscrits — docs/*.md à plat doit se GÉNÉRER, pas s’écrire à la main (#903)', () => {
  const docs = manualDocs();

  it('aucun doc manuscrit NEUF hors du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock', () => {
    const horsStock = docs.filter((d) => !MANUAL_DOCS_STOCK.has(d));
    expect(
      horsStock.map((d) => `${d} est manuscrit et absent du stock — un doc neuf se GÉNÈRE, il ne s’inscrit pas au stock manuel`),
    ).toEqual([]);
  });

  it('le stock cliqueté ne peut que DÉCROÎTRE — aucune entrée désormais GÉNÉRÉE n’y traîne', () => {
    const perimees = [...MANUAL_DOCS_STOCK].filter((d) => !docs.includes(d));
    expect(perimees.map((d) => `retirer "${d}" du stock — il est désormais GÉNÉRÉ (ou n'existe plus)`)).toEqual([]);
  });

  it('le stock cliqueté ne GROSSIT pas — sa taille est plafonnée par le test', () => {
    expect(MANUAL_DOCS_STOCK.size).toBeLessThanOrEqual(MANUAL_DOCS_MAX);
  });
});
