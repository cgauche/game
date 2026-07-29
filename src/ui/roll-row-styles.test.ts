/**
 * Le bloc « dé fixé » d'une rangée de jet est CHARTRÉ dans la feuille partagée, pas hérité de
 * l'ambiance de la coquille qui l'héberge (mesure du juge vision : `.prow-act`/`.prow-fixed-mark`
 * n'avaient AUCUNE règle sur 120 feuilles → même étiquette centrée en modale Corruption, ferrée à
 * gauche en Incantation ; le champ occupait 1/3 d'une grille `repeat(3, 1fr)` détournée).
 *
 * Verrou STRUCTUREL : chaque classe portée par `RollRow`/`ForcedRollPicker` doit avoir au moins une
 * règle avec des déclarations dans `src/ui/styles/`. Même patron que
 * `creator/creator-step-scroll-cue.test.tsx` (jsdom ne calcule pas de layout : on verrouille la
 * DÉCLARATION source, la preuve de rendu vit en recette navigateur).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES = fileURLToPath(new URL('./styles/', import.meta.url));

function cssFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) cssFiles(p, acc);
    else if (e.endsWith('.css')) acc.push(p);
  }
  return acc;
}

// Commentaires NEUTRALISÉS (même précaution que `ui-ratchets`) : un commentaire qui NOMME la classe
// n'est pas une règle — sans ça, la sonde reste verte alors que la déclaration a disparu (mesuré).
const SHEETS = cssFiles(STYLES).map((f) => ({ file: f, css: readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

/** Blocs `{…}` dont le SÉLECTEUR contient la classe, et dont le corps porte au moins une déclaration.
 *  Frontière `(?![\w-])` et non `\b` : `\b` fait passer `.prow-act` pour une règle de `.prow`. */
function rulesFor(cls: string): { file: string; body: string }[] {
  const re = new RegExp(`(^|[,{}])([^{}]*\\.${cls}(?![\\w-])[^{}]*)\\{([^{}]*)\\}`, 'g');
  const found: { file: string; body: string }[] = [];
  for (const { file, css } of SHEETS) {
    for (const m of css.matchAll(re)) {
      if (/[a-z-]+\s*:/.test(m[3])) found.push({ file, body: m[3] });
    }
  }
  return found;
}

describe('rangée de jet — les classes du bloc « dé fixé » sont chartrées (feuille partagée)', () => {
  for (const cls of ['prow', 'prow-act', 'prow-fixed-mark', 'rm-die-pick', 'rm-die-input']) {
    it(`\`.${cls}\` porte au moins une règle CSS`, () => {
      const rules = rulesFor(cls);
      expect(
        rules.length,
        `\`.${cls}\` n'a AUCUNE règle dans src/ui/styles/ — son alignement/sa matière seraient hérités de l'ambiance de la coquille (divergence par écran).`,
      ).toBeGreaterThan(0);
    });
  }

  it('`.prow-act` pose un LAYOUT explicite (jamais un div nu qui suit le flux du parent)', () => {
    const bodies = rulesFor('prow-act').map((r) => r.body).join('\n');
    expect(bodies).toMatch(/display:\s*flex/);
    expect(bodies).toMatch(/align-items:/);
    expect(bodies).toMatch(/text-align:/);
  });

  // Sonde du juge vision, PROMUE : aucun élément de rangée n'hérite du `text-align` de la coquille. Le
  // ferrage se déclare sur le CONTENEUR (`.prow`) — mesuré : marque centrée sous `.test-modal`
  // (`text-align: center`) au-dessus d'un champ ferré à gauche, dans la MÊME rangée.
  it('`.prow` (le conteneur) ferre ses enfants EXPLICITEMENT — sinon l’ambiance de la coquille décide', () => {
    const bodies = rulesFor('prow').map((r) => r.body).join('\n');
    expect(
      bodies,
      '`.prow` sans `text-align` : chaque enfant (marque, issue courte, actions) hérite du centrage de `.test-modal` et diverge de `.roll-modal`.',
    ).toMatch(/text-align:\s*(left|start)/);
  });

  it('`.rm-die-input` est dimensionné à son contenu — jamais une cellule pleine largeur', () => {
    const bodies = rulesFor('rm-die-input').map((r) => r.body).join('\n');
    const width = bodies.match(/width:\s*([^;]+);/)?.[1]?.trim();
    expect(width, '`.rm-die-input` sans `width`').toBeTruthy();
    expect(width, 'un champ de 3 chiffres ne prend pas 100 % de sa rangée').not.toBe('100%');
  });
});
