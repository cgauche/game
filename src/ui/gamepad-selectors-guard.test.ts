import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Garde STRUCTURELLE — la manette pilote le DOM par SÉLECTEURS littéraux (`useGamepad.ts`) : aucun
 * typage ne relie ces chaînes au markup. Une classe qui perd son dernier émetteur ne casse rien à la
 * compilation, elle rend une branche INATTEIGNABLE (le contexte visé n'arrive plus jamais, le bouton
 * retombe silencieusement sur l'autre branche). Contrat : tout sélecteur de classe codé dans la
 * couche manette a au moins un `className` de PRODUCTION qui le pose.
 */
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const root = process.cwd();
const files = walk(path.join(root, 'src'));
const pad = fs.readFileSync(path.join(root, 'src', 'ui', 'useGamepad.ts'), 'utf8');

/** Classes POSÉES en production : `className="a b"`, `className={'a'}` et gabarits `` className={`a ${x}`} ``. */
const emitted = new Map<string, string>();
for (const f of files.filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
  const t = fs.readFileSync(f, 'utf8');
  for (const m of t.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\}|\{'([^']*)'\}|\{"([^"]*)"\})/g))
    for (const c of (m[1] ?? m[2] ?? m[3] ?? m[4]).split(/[^-\w]+/))
      if (c && !/^\d/.test(c) && !emitted.has(c)) emitted.set(c, path.relative(root, f));
}

/** Sélecteurs de CLASSE littéraux de la couche manette (les sélecteurs d'attribut ne sont pas visés). */
const targeted = new Map<string, number>();
for (const m of pad.matchAll(/'(\.[^'\n]*)'/g)) {
  for (const c of m[1].matchAll(/\.([a-z][-\w]*)/g))
    if (!targeted.has(c[1])) targeted.set(c[1], pad.slice(0, m.index!).split('\n').length);
}

describe('manette — aucun sélecteur sans émetteur', () => {
  it('mesure un stock non vide (la garde ne peut pas être vide par accident)', () => {
    expect(targeted.size).toBeGreaterThan(0);
    expect(emitted.size).toBeGreaterThan(200);
  });

  it('chaque classe ciblée par `useGamepad.ts` est posée par au moins un composant', () => {
    expect([...targeted].filter(([c]) => !emitted.has(c)).map(([c, l]) => `.${c} (useGamepad.ts:${l})`)).toEqual([]);
  });

  it('le relevé d’émetteurs est FERMÉ (un nom absent du markup n’est pas trouvé)', () => {
    expect(emitted.has('classe-qui-nexiste-pas')).toBe(false);
  });

  it('le scan VOIT la surface visée par la manette (non-vacuité nominative)', () => {
    expect([...targeted.keys()]).toContain('combat-console');
  });
});
