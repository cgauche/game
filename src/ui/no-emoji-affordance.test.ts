import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emojisIn } from '../../scripts/guards/lib/emojiAffordance.mjs';

/**
 * Garde-fou anti-emoji (LOT 4) : les AFFORDANCES de l'UI passent par le registre d'icônes
 * (`src/ui/icons/` + `<Icon id>` / `<IconG id>`), plus jamais par un emoji dans le code ou la
 * donnée — et un emoji de LOG/journal/prose se retire tout autant (texte affiché à l'utilisateur).
 * Couverture EXHAUSTIVE par défaut : ce test de BUILD balaie TOUT `src/` (walk récursif, .ts/.tsx/
 * .json) ; il n'y a PAS de liste opt-in de dossiers (tout nouveau dossier naît couvert). Seules des
 * EXCLUSIONS explicites et justifiées existent (ci-dessous), chacune par NATURE, jamais par état de
 * migration.
 * Mécanique de détection (plages Unicode, glyphes tolérés `✓ ☰ …`, `emojisIn`) :
 * `scripts/guards/lib/emojiAffordance.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // racine du projet (src/ui/ → ../../)
const SRC = join(ROOT, 'src');

/** Exclusions par NATURE (jamais par état de migration) :
 *  - `*.test.*` : les tests portent les emojis de leurs composants non migrés et sont réécrits AVEC
 *    leur composant (ils ne rendent rien à l'utilisateur) ;
 *  - `_registry.generated.ts` : fichiers ÉMIS par scripts/gen-registry.mjs (en-tête « généré ») ;
 *  - `__snapshots__/` : instantanés Vitest générés, non édités à la main. */
const EXCLUDED = (rel: string): boolean =>
  /\.test\.[tj]sx?$/.test(rel) ||
  rel.endsWith('_registry.generated.ts') ||
  rel.includes('__snapshots__/');

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|json)$/.test(e)) files.push(p);
    }
  };
  walk(SRC);
  return files;
}

describe('garde-fou anti-emoji (affordances → registre d’icônes)', () => {
  it('aucun emoji dans TOUT src/ (.ts/.tsx/.json), hors exclusions par nature', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      const hits = emojisIn(readFileSync(f, 'utf8'));
      if (hits.length) offenders.push(`${rel} → ${hits.join(' ')}`);
    }
    expect(offenders, 'Emoji détecté — affordance : <Icon id> (src/ui/icons/) ; log/prose/donnée : texte nu').toEqual([]);
  });
});
