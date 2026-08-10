/**
 * Règle stricte 5 GARDÉE pour `psychology.json` (#1200) : chaque `desc` est un copié/collé VERBATIM du
 * `Source/`, donc chacun de ses PARAGRAPHES doit se recoller tel quel dans le chapitre qui la porte.
 *
 * Pourquoi paragraphe par paragraphe, et pas la desc entière : une entrée peut être à cheval sur deux
 * folios, et l'extraction Marker sème alors un `<span data-folio="N">` AU MILIEU de la phrase
 * (`prejuge`, `21 - Psychologie.md:48`). Comparer la desc entière n'y prouverait rien ; comparer chaque
 * paragraphe après retrait des seules BALISES d'extraction prouve le recollage réel.
 *
 * Ce que la normalisation s'autorise, et rien d'autre : retirer les `<span>` de pagination et replier
 * les blancs. L'emphase Markdown (`*Peur*`, `**Calme**`) est CONSERVÉE des deux côtés — c'est
 * précisément ce que la règle 5 exige de recoller (« le formatage est conservé en Markdown »), et
 * l'oublier laisserait passer une desc qui aurait perdu ses italiques de règle.
 *
 * Complément de la garde de FOLIO (`book-source-integrity.test.ts`), qui prouve OÙ vit l'entrée : ici
 * on prouve QUE le texte est celui du livre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import psychology from './psychology.json';

const CHAPITRE = fileURLToPath(
  new URL('../../Source/Warhammer v4 - Livre de base version corrigée/21 - Psychologie.md', import.meta.url),
);

/** Retire les balises d'extraction (pagination Marker) et replie les blancs — l'emphase Markdown reste. */
const norm = (s: string): string =>
  s
    .replace(/<span[^>]*>/g, '')
    .replace(/<\/span>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

describe('psychology.json — chaque desc se recolle VERBATIM dans le LDB 21 (règle stricte 5)', () => {
  const source = norm(readFileSync(CHAPITRE, 'utf8'));

  for (const entree of psychology) {
    it(`${entree.id} : chaque paragraphe de la desc est dans le Source`, () => {
      const absents = entree.desc
        .split('\n\n')
        .map((p, i) => ({ i, p: norm(p) }))
        .filter(({ p }) => !source.includes(p))
        // Le rapport porte le PLUS LONG préfixe recollable : il pointe le caractère exact où la desc
        // décroche du livre, au lieu d'un « introuvable » qui laisserait chercher.
        .map(({ i, p }) => {
          let lo = 0;
          let hi = p.length;
          while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (source.includes(p.slice(0, mid))) lo = mid;
            else hi = mid - 1;
          }
          return `paragraphe ${i} décroche à ${lo}/${p.length} : …${p.slice(Math.max(0, lo - 40), lo + 40)}`;
        });
      expect(absents).toEqual([]);
    });
  }
});
