import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * CLIQUET — une AFFORDANCE D'INFLUENCE exportée a au moins UN consommateur de PRODUCTION (#1106).
 * Précédent MESURÉ : `ledgerRerollable` (procès-verbal) vivait avec son seul test, zéro appelant —
 * un prédicat d'influence qui ne pilote AUCUN bouton donne l'illusion que la relance existe.
 * Périmètre : les fonctions exportées de `src/` dont le nom dit l'affordance (`*Rerollable`,
 * `can*Reroll`). Un test ne compte PAS comme consommateur.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const AFFORDANCE_RX = /export\s+function\s+([a-zA-Z0-9_]*(?:Rerollable|Reroll(?:able)?))\s*\(/g;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { out.push(...walk(p)); continue; }
    if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

/** Neutralise commentaires (blocs + lignes) : une mention d'un nom DANS SA PROPRE JSDoc n'est pas un
 *  usage — sans ce filtre, le style de documentation canonique du dépôt (une JSDoc qui NOMME la
 *  fonction) suffirait à faire passer une affordance morte pour vivante. */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

/** Noms d'affordance d'influence exportés par `src` (hors tests) — exporté pour la preuve fail-closed. */
export function scanAffordanceNames(src: string): string[] {
  return [...stripComments(src).matchAll(AFFORDANCE_RX)].map((m) => m[1]);
}

/** Occurrences RÉELLES (hors commentaires) d'un nom dans un contenu. */
export function nameOccurrences(src: string, name: string): number {
  return (stripComments(src).match(new RegExp(`\\b${name}\\b`, 'g')) ?? []).length;
}

describe('cliquet — toute affordance d’influence exportée a un consommateur de PRODUCTION (#1106)', () => {
  it('aucune affordance morte (déclarée, testée, jamais appelée par la production)', () => {
    const files = walk(join(ROOT, 'src'));
    const prod = files.filter((f) => !f.includes('.test.'));
    const declared: { name: string; file: string }[] = [];
    for (const f of prod) for (const n of scanAffordanceNames(readFileSync(f, 'utf8'))) declared.push({ name: n, file: relative(ROOT, f).split(sep).join('/') });
    const dead: string[] = [];
    for (const d of declared) {
      const consumers = prod.filter((f) => {
        const rel = relative(ROOT, f).split(sep).join('/');
        if (rel === d.file) return false; // la déclaration elle-même ne compte pas
        return nameOccurrences(readFileSync(f, 'utf8'), d.name) > 0;
      });
      // Un appel DANS le fichier de déclaration compte aussi (usage local d'une primitive exportée) —
      // la DÉCLARATION comptant pour 1, il faut une occurrence de CODE supplémentaire.
      const selfUse = nameOccurrences(readFileSync(join(ROOT, d.file), 'utf8'), d.name) > 1;
      if (!consumers.length && !selfUse) dead.push(`${d.file} — ${d.name}`);
    }
    expect(dead, ['Affordance d’influence SANS consommateur de production (illusion de relance, #1106) :', ...dead].join('\n')).toEqual([]);
  });

  it('FAIL-CLOSED : le scanner reconnaît les deux formes de nom', () => {
    expect(scanAffordanceNames('export function ledgerRerollable(e: NightEntry): boolean {')).toEqual(['ledgerRerollable']);
    expect(scanAffordanceNames('export function canReroll(a: boolean, b: boolean): boolean {')).toEqual(['canReroll']);
    expect(scanAffordanceNames('export function optionValue(base: number): number {')).toEqual([]);
  });

  it('FAIL-CLOSED : une JSDoc qui NOMME la fonction ne vaut pas un usage (la garde n’est pas neutralisable)', () => {
    const morte = `/** \`sondeRerollable\` : prédicat d'influence documenté, jamais appelé. */\nexport function sondeRerollable(e: unknown): boolean { return !!e; }\n`;
    // La mention dans la JSDoc est neutralisée : il ne reste QUE la déclaration → aucun usage.
    expect(nameOccurrences(morte, 'sondeRerollable')).toBe(1);
    // Un appel RÉEL dans le même fichier, lui, compte.
    expect(nameOccurrences(`${morte}const x = sondeRerollable(1);`, 'sondeRerollable')).toBe(2);
    // Une mention en commentaire de LIGNE ne compte pas davantage.
    expect(nameOccurrences(`${morte}// voir sondeRerollable plus haut`, 'sondeRerollable')).toBe(1);
  });
});
