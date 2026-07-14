import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde structurelle #414 — les rôles ARIA COMPOSITES à roving tabindex (`listbox`/`radiogroup`/
 * `tablist`/`menu`/`grid` — pas les rôles simples `button`/`dialog`/`img`) sont la PROPRIÉTÉ d'une
 * primitive UNIQUE (table OWNERS, cf. CLAUDE.md « Primitives partagées »). Toute pose de ces rôles
 * hors du fichier propriétaire = réinvention présumée du patron déjà composable [arbitrage
 * utilisateur verbatim « Pas de guard contre cette paresse ? », 2026-07-14]. Cliquet PAR FICHIER :
 * BASELINE = stock gelé au moment de la garde, jamais de nouvelle entrée sans migration dédiée.
 */

const UI = fileURLToPath(new URL('.', import.meta.url)); // src/ui/

function walk(dir: string, test: (f: string) => boolean, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, test, acc);
    else if (test(e)) acc.push(p);
  }
  return acc;
}
const rel = (abs: string) => abs.slice(UI.length).split('\\').join('/');

/** Une réf de rôle dans un commentaire (JSDoc, JSX) n'est pas une pose réelle du widget. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const ROLES = ['listbox', 'radiogroup', 'tablist', 'menu', 'grid'] as const;
type CompositeRole = (typeof ROLES)[number];

/** Fichier PROPRIÉTAIRE canonique de chaque rôle composite. */
const OWNERS: Record<CompositeRole, string[]> = {
  listbox: ['GroupedPickGrid.tsx'],
  // `CareerPath.tsx` (#393 P2, 2026-07-14) : CONSÉCRATION documentée — sélecteur de rang (chaîne de
  // médaillons d'évolution de carrière, `onSelect` optionnel), pas une réinvention d'`OptionChooser`
  // (patron géométrique distinct : liens `.cc-link` entre médaillons, pas une grille/segmented control).
  radiogroup: ['creator/CelestialWheel.tsx', 'OptionChooser.tsx', 'CareerPath.tsx'],
  tablist: ['Tabs.tsx'],
  menu: [],
  grid: [],
};

/** Stock hors-propriétaire GELÉ au moment de la garde (#414, 2026-07-14) — ne JAMAIS étendre sans
 *  migration dédiée vers la primitive propriétaire ; cette garde LIT, elle ne migre rien. */
const BASELINE: Record<string, CompositeRole[]> = {
  'CityHubScreen.tsx': ['listbox'],
  'MediaSelect.tsx': ['listbox'],
  'editor/EditorToolbar.tsx': ['menu'],
  // à réconcilier avec GroupedPickGrid après le chrome #414 (fichier chaud, ne pas migrer ici)
  'creator/CharacterCreator.tsx': ['listbox', 'radiogroup'],
};

function rolesIn(src: string): CompositeRole[] {
  const out: CompositeRole[] = [];
  const re = /role=["']([\w-]+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const role = m[1];
    if ((ROLES as readonly string[]).includes(role)) out.push(role as CompositeRole);
  }
  return out;
}

describe('#414 — widgets ARIA composites = propriété des primitives (baseline gelée, croissance bloquée)', () => {
  it('aucun rôle composite hors-propriétaire au-delà du stock gelé', () => {
    const files = walk(UI, (e) => e.endsWith('.tsx') && !e.endsWith('.test.tsx'));
    const offenders: string[] = [];
    for (const f of files) {
      const path = rel(f);
      const src = stripComments(readFileSync(f, 'utf8'));
      for (const role of new Set(rolesIn(src))) {
        if (OWNERS[role].includes(path)) continue;
        if (BASELINE[path]?.includes(role)) continue;
        const owners = OWNERS[role].join(' / ') || 'aucune — à créer avant de poser ce rôle';
        offenders.push(`${path} → role="${role}" — composer la primitive propriétaire (${owners}) au lieu de réécrire le rôle`);
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
