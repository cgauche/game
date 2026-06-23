/**
 * Garde-fou RÈGLE 5 : aucune balise HTML dans les datasets app-owned. Les champs de prose (`desc`,
 * `text`…) sont du **Markdown verbatim** de la source, rendus par `<Prose>` — jamais du HTML. Ce test
 * échoue si une string contient une vraie balise (legacy `<br>`, `<b>`, `<div>`… réintroduits par
 * mégarde ou par un copier-coller depuis l'ancien format). Détecte des tags NOMMÉS connus, pas un
 * simple « < » (formules « PV < 5 » non concernées).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('.', import.meta.url));
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && !f.startsWith('_'));

const HTML_TAG = /<(\/?)(b|i|em|strong|br|p|ul|ol|li|table|thead|tbody|tr|td|th|span|div|h[1-6]|a|code|pre|blockquote|sup|sub|hr)\b[^>]*>/i;

/** Chemins de toutes les strings contenant une balise HTML (chemin lisible → string fautive). */
function htmlStrings(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'string') {
    if (HTML_TAG.test(value)) out.push(`${path} : ${JSON.stringify(value.slice(0, 80))}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => htmlStrings(v, `${path}[${i}]`, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) htmlStrings(v, path ? `${path}.${k}` : k, out);
  }
}

describe('Règle 5 — prose en Markdown, jamais en HTML', () => {
  for (const f of files) {
    it(`${f} : aucune balise HTML`, () => {
      const data = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      const hits: string[] = [];
      htmlStrings(data, '', hits);
      expect(hits, `Balises HTML trouvées (à convertir en Markdown) :\n${hits.join('\n')}`).toEqual([]);
    });
  }
});
