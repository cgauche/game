import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Garde STRUCTURELLE (#1117) — une classe `rm-*` posée dans le markup DOIT avoir une règle CSS.
 * Une classe sans règle ne fait rien : soit le style manque (le rendu ment sur son intention),
 * soit le `className` est mort. Les deux se corrigent, aucun ne se tolère.
 */
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(path.join(process.cwd(), 'src'));
const css = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');

describe('classes rm-* — aucune classe fantôme', () => {
  const used = new Map<string, string>();
  for (const f of files.filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
    const t = fs.readFileSync(f, 'utf8');
    for (const m of t.matchAll(/className="([^"{}]+)"/g))
      for (const c of m[1].split(/\s+/)) if (c.startsWith('rm-') && !used.has(c)) used.set(c, path.relative(process.cwd(), f));
  }

  it('mesure un stock non vide (la garde ne peut pas être vide par accident)', () => {
    expect(used.size).toBeGreaterThan(30);
  });

  /** Recherche SANS regex construite : un sélecteur `.classe` suivi d'un caractère qui termine le nom. */
  const hasRule = (cls: string): boolean => {
    const needle = `.${cls}`;
    for (let i = css.indexOf(needle); i >= 0; i = css.indexOf(needle, i + 1)) {
      const next = css[i + needle.length] ?? ' ';
      if (!/[-\w]/.test(next)) return true;
    }
    return false;
  };

  it('chaque classe rm-* utilisée porte au moins une règle CSS', () => {
    const phantom = [...used].filter(([c]) => !hasRule(c));
    expect(phantom.map(([c, f]) => `${c} (${f})`)).toEqual([]);
  });

  it('la recherche de règle est FERMÉE : un préfixe plus long ne compte pas', () => {
    expect(hasRule('rm-options')).toBe(true);
    expect(hasRule('rm-optio')).toBe(false);
  });
});
